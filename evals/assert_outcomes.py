"""Checks what the eval cases produced, not just that the calls went through.

`webmcp-evals smoke` verifies the tool chain: the named tools exist on the live
page and accept the arguments. It does not look at what came back. Spec section 6
asks for both -- the expected tool chain AND the expected visible result -- so
this runs the official smoke command, reads the outputs it printed, and asserts
the result of every case.

Run:  python evals/assert_outcomes.py [--url https://...]

Needs a WebMCP-capable Chrome (149+). No API key and no model: the smoke command
executes the authored calls directly.
"""

import json
import re
import subprocess
import sys

URL = "https://biddesk.n-schadewald.workers.dev"
if "--url" in sys.argv:
    URL = sys.argv[sys.argv.index("--url") + 1]

sys.stdout.reconfigure(encoding="utf-8")
ok = True


def check(label, cond, detail=""):
    global ok
    ok = ok and bool(cond)
    print(("  OK   " if cond else "  FEHLT ") + label + ((" - " + str(detail)) if detail else ""))


print("Running webmcp-evals smoke against %s ..." % URL)
run = subprocess.run(
    [
        "npx", "--yes", "webmcp-evals@latest", "smoke",
        "-u", URL,
        "-e", "evals/bidder.evals.json",
        "--chrome-channel", "chrome",
        "-v",
    ],
    capture_output=True, text=True, encoding="utf-8", errors="replace", shell=True,
)
raw = re.sub(r"\x1b\[[0-9;]*m", "", run.stdout + run.stderr)

# Each verbose step prints the case, the tool, and then its output as JSON.
steps = []
current = None
for line in raw.splitlines():
    m = re.search(r'Case "(.+?)" Step \d+/\d+: Calling tool "(.+?)"', line)
    if m:
        current = {"case": m.group(1), "tool": m.group(2), "output": None}
        steps.append(current)
        continue
    m = re.search(r"└─ PASS: Output: (.*)$", line)
    if m and current is not None:
        try:
            current["output"] = json.loads(m.group(1))
        except json.JSONDecodeError:
            current["output"] = {"_unparsed": m.group(1)[:200]}

summary = re.search(r"Passed steps: (\d+)/(\d+) across (\d+) case", raw)
print()
print("Tool chain (webmcp-evals smoke): %s" % (summary.group(0) if summary else "no summary found"))
if summary:
    check("every authored call executed on the live page", summary.group(1) == summary.group(2))

def out(case_prefix, tool):
    for step in steps:
        if step["case"].startswith(case_prefix) and step["tool"] == tool:
            return step["output"]
    return None


print()
print("Visible outcome, case by case")

e1 = out("E1", "set_unit_price")
check("E1 · twelve rows written, none refused",
      e1 and len(e1["applied"]) == 12 and e1["rejected"] == [],
      e1 and (len(e1["applied"]), len(e1["rejected"])))
check("E1 · net 13.213,50 EUR, contingency 370,00 EUR shown apart",
      e1 and abs(e1["totals"]["net"] - 13213.50) < 0.01
      and abs(e1["totals"]["contingency"] - 370.00) < 0.01,
      e1 and (e1["totals"]["net"], e1["totals"]["contingency"]))
check("E1 · eleven of twelve billable positions priced, one left open",
      e1 and e1["totals"]["positions_priced"] == 11 and e1["totals"]["positions_open"] == 1)
check("E1 · every written row carries the price book line it came from",
      e1 and all(row["price_book_id"] and row["set_by"] == "agent" for row in e1["applied"]))

e1s = out("E1", "suggest_prices")
gaps = [x["oz"] for x in e1s["suggestions"] if x["unit_price"] is None] if e1s else None
check("E1 · exactly two positions get no proposal: 03.04 and 04.02", gaps == ["03.04", "04.02"], gaps)

e2 = out("E2", "suggest_prices")
radiators = e2["suggestions"][0] if e2 else None
check("E2 · the radiators get no price and no source",
      radiators and radiators["unit_price"] is None and radiators["based_on"] is None
      and radiators["matched_terms"] == 0)
check("E2 · and the reason says so in words",
      radiators and radiators["reason"] == "no comparable entry in your price book",
      radiators and radiators["reason"])
e2b = out("E2", "get_price_book")
check("E2 · the price book has metal work, but none priced per piece",
      e2b and all(e["category"] == "metal" for e in e2b["entries"])
      and not any(e["unit"] == "pcs" for e in e2b["entries"]),
      e2b and [(e["id"], e["unit"]) for e in e2b["entries"]])

e3 = out("E3", "check_bid")
check("E3 · names both open positions", e3 and e3["open_positions"] == ["03.04", "04.02"],
      e3 and e3["open_positions"])
check("E3 · finds the expired tax clearance certificate",
      e3 and [d["doc_type"] for d in e3["missing_documents"]] == ["tax_clearance"]
      and e3["missing_documents"][0]["reason"] == "expired",
      e3 and [(d["doc_type"], d["reason"]) for d in e3["missing_documents"]])
check("E3 · reports the days left until the deadline",
      e3 and isinstance(e3["due_in_days"], int), e3 and e3["due_in_days"])
check("E3 · reads only: status still draft", e3 and e3["status"] == "draft")

# The form-derived tool answers the caller with the browser's own placeholder
# ("pending form submission"), so the proof that it worked is to read the
# question back through an imperative tool in the same case.
e4 = out("E4", "ask_clarification")
check("E4 · the form tool is callable by an agent", e4 is not None, e4)
ASKED = "Will the scaffolding from the roofing works still be in place during our works?"
e4b = out("E4", "list_clarifications")
# Exact text: the seed already holds a similar question, so a substring match
# would pass even if nothing had been filed.
asked = [q for q in (e4b["questions"] if e4b else []) if q["question"] == ASKED]
check("E4 · the question really landed, read back through list_clarifications",
      len(asked) == 1 and len(e4b["questions"]) == 3,
      e4b and (len(e4b["questions"]), len(asked)))
check("E4 · it is filed against the position, open, under this bidder",
      asked and asked[0]["status"] == "open" and asked[0]["oz"] == "01.01"
      and asked[0]["bidder"] == "Farbwerk Meier GmbH",
      asked and (asked[0]["oz"], asked[0]["status"], asked[0]["bidder"]))

e5 = out("E5", "submit_bid")
check("E5 · confirm:false does NOT submit, it asks",
      e5 and e5["ok"] is False and e5["needs_confirmation"] is True)
check("E5 · and reports the total that would go out",
      e5 and abs(e5["summary"]["total_net"] - 13213.50) < 0.01, e5 and e5["summary"]["total_net"])

# The dictated price is neither written nor refused: it waits on its row for
# the person's click. The click itself is not an eval case -- a model cannot
# press a button on the page -- it is covered by a UI test (App.test.tsx).
e6 = out("E6", "set_unit_price")
check("E6 · a dictated price with no source waits for the person",
      e6 and e6["ok"] is True and e6["status"] == "needs_confirmation",
      e6 and (e6.get("ok"), e6.get("status")))
check("E6 · nothing written, nothing refused: the row is pending, with its rationale",
      e6 and e6["applied"] == [] and e6["rejected"] == []
      and [(p["oz"], p["unit_price"], p["line_total"]) for p in e6["pending"]] == [("03.04", 61, 244)]
      and e6["pending"][0]["rationale"] == "4 radiators at 25 min each at your rate of 58 EUR",
      e6 and (e6["applied"], e6["rejected"], e6["pending"]))
e6c = out("E6", "check_bid")
check("E6 · and the bid is untouched: net still 13.213,50 EUR, 03.04 still open",
      e6c and abs(e6c["totals"]["net"] - 13213.50) < 0.01 and "03.04" in e6c["open_positions"],
      e6c and (e6c["totals"]["net"], e6c["open_positions"]))
check("E6 · the check names a way out for the open position, in the page's words",
      e6c and any(a["finding"] == "open_position" and a.get("oz") == "03.04"
                  and "you confirm it" in a["action"] for a in e6c.get("actions", [])),
      e6c and [a["action"] for a in e6c.get("actions", []) if a.get("oz") == "03.04"])

# The third way. A renewed certificate stated in the chat is relayed, not
# recorded: the page has not seen it, so it asks the person to confirm -- and
# says so. The click is a UI test (App.test.tsx), not an eval case.
e7 = out("E7", "set_document_validity")
check("E7 · a stated expiry date waits for the person",
      e7 and e7["ok"] is True and e7["status"] == "needs_confirmation",
      e7 and (e7.get("ok"), e7.get("status")))
check("E7 · the pending row names the document, the date on file and the new one",
      e7 and len(e7["pending"]) == 1 and e7["pending"][0]["doc_type"] == "tax_clearance"
      and e7["pending"][0]["valid_until"] == "2027-08-15"
      and e7["pending"][0]["previous_valid_until"] is not None
      and e7["pending"][0]["previous_valid_until"] < "2027-08-15",
      e7 and e7["pending"])
e7c = out("E7", "check_bid")
check("E7 · nothing written: the check still reports the certificate as expired",
      e7c and [(d["doc_type"], d["reason"]) for d in e7c["missing_documents"]] == [("tax_clearance", "expired")],
      e7c and [(d["doc_type"], d["reason"]) for d in e7c["missing_documents"]])
check("E7 · and its way out says to tell the agent the date and confirm on the page",
      e7c and any(a["finding"] == "document" and a.get("doc_type") == "tax_clearance"
                  and "tell your agent the new expiry date" in a["action"] for a in e7c.get("actions", [])),
      e7c and [a["action"] for a in e7c.get("actions", []) if a.get("doc_type") == "tax_clearance"])

e8 = out("E8", "set_unit_price")
check("E8 · a price that contradicts its source is refused",
      e8 and e8["applied"] == [] and e8["rejected"][0]["reason"] == "price_does_not_match_source",
      e8 and e8["rejected"])
check("E8 · and the reason names both numbers",
      e8 and "8.4" in e8["rejected"][0]["hint"] and "12" in e8["rejected"][0]["hint"],
      e8 and e8["rejected"][0]["hint"])

print()
print("ALLES GRUEN" if ok else "NICHT GRUEN")
sys.exit(0 if ok else 1)
