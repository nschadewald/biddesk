# -*- coding: utf-8 -*-
"""Prueft: (1) SQL laeuft, (2) GAEB deckt sich mit seed.json, (3) die Luecken sind genau die gewollten."""
import json, io, sqlite3, re, sys, xml.etree.ElementTree as ET
d = json.load(io.open("seed.json", encoding="utf-8")); ok = True
def check(label, cond, info=""):
    global ok
    print(("  OK   " if cond else "  FAIL ") + label + ((" – " + info) if info else ""))
    ok = ok and cond

print("1) SQL gegen frische SQLite-Datenbank")
con = sqlite3.connect(":memory:")
con.executescript(io.open("schema.sql", encoding="utf-8").read())
con.executescript(io.open("seed.sql", encoding="utf-8").read().replace("{{WS}}", "ws-test"))
n = lambda t: con.execute("SELECT COUNT(*) FROM " + t).fetchone()[0]
check("Tenders", n("tenders") == 3, "%d" % n("tenders"))
check("Positionen", n("positions") == 25, "%d" % n("positions"))
check("Preisbuch", n("price_book") == 34, "%d" % n("price_book"))
check("Angebote (abgegeben)", n("bids") == 5 and n("bid_prices") == 43, "%d Angebote / %d Preise" % (n("bids"), n("bid_prices")))
t14bids = con.execute("SELECT COUNT(*) FROM bids WHERE tender_id='T-2026-014'").fetchone()[0]
check("Zwei versiegelte Konkurrenzangebote auf T-2026-014 (Zaehler springt auf 3)", t14bids == 2, "%d" % t14bids)
own = con.execute("SELECT COUNT(*) FROM bids WHERE tender_id='T-2026-014' AND bidder_id='B-A'").fetchone()[0]
check("Farbwerk Meier hat auf T-2026-014 NOCH KEIN Angebot (das legt die Demo an)", own == 0)
check("Rueckfragen", n("clarifications") == 2)
exp = con.execute("SELECT COUNT(*) FROM bidder_documents WHERE bidder_id='B-A' AND valid_until < date('now')").fetchone()[0]
check("Genau EIN abgelaufener Nachweis bei B-A (check_bid-Szene)", exp == 1, "%d" % exp)
due = con.execute("SELECT julianday(due_date)-julianday('now') FROM tenders WHERE id='T-2026-014'").fetchone()[0]
check("Frist Haupt-Tender liegt nach dem Jurierungsende 21.09.", due > 9, "in %.0f Tagen" % due)

print("2) GAEB gegen seed.json")
NS = "{http://www.gaeb.de/GAEB_DA_XML/DA83/3.2}"
root = ET.parse("gaeb/T-2026-014.x83").getroot()
items = root.iter(NS + "Item")
gaeb = [(i.findtext(NS+"Qty"), i.findtext(NS+"QU"), i.find(NS+"Provis") is not None) for i in items]
t14 = [t for t in d["tenders"] if t["id"] == "T-2026-014"][0]["positions"]
check("Positionsanzahl", len(gaeb) == len(t14), "%d vs %d" % (len(gaeb), len(t14)))
U = {"m2":"m2","m":"m","pcs":"St","psch":"psch","h":"h"}
check("Mengen und Einheiten identisch",
      all(float(g[0]) == p["quantity"] and g[1] == U[p["unit"]] for g, p in zip(gaeb, t14)))
check("Bedarfspositionen markiert",
      [g[2] for g in gaeb] == [p["contingency"] for p in t14],
      "%d markiert" % sum(1 for g in gaeb if g[2]))

print("3) Deterministischer Matcher – erzeugt der Seed genau die gewollten Luecken?")
def norm(s):
    return s.lower().replace("ä","ae").replace("ö","oe").replace("ü","ue").replace("ß","ss")

def match(bidder, pos):
    """Finale Regel (31.08.): Kategorie UND Einheit muessen passen, Keyword-Treffer per TEILSTRING
       (deutsche Komposita!), mindestens EIN Treffer noetig. high >=2, medium =1, sonst none."""
    txt = norm(pos["text_de"])
    cands = [e for e in d["price_book"]
             if e["bidder_id"] == bidder and e["category"] == pos["category"] and e["unit"] == pos["unit"]]
    best, bh = None, 0
    for e in cands:
        h = sum(1 for k in e["keywords"] if norm(k) in txt)
        if h > bh: best, bh = e, h
    if best is None or bh == 0:
        return "none", None
    return ("high" if bh >= 2 else "medium"), best

res = {p["oz"]: match("B-A", p)[0] for p in t14}
gaps = sorted(oz for oz, c in res.items() if c == "none")
want = sorted(d["deliberate_gaps"]["positions"])
check("Luecken bei B-A sind genau %s" % want, gaps == want, "gefunden: %s" % gaps)
check("Mindestens 8 Positionen mit hoher Konfidenz",
      sum(1 for c in res.values() if c == "high") >= 8,
      "high=%d medium=%d none=%d" % tuple(sum(1 for c in res.values() if c == k)
                                          for k in ("high","medium","none")))
tot = sum(pp["quantity"] * match("B-A", pp)[1]["unit_price"]
          for pp in t14 if match("B-A", pp)[0] != "none" and not pp["contingency"])
check("Nettosumme nach Prompt 1 ist 13213.50 EUR", abs(tot - 13213.50) < 0.01, "%.2f" % tot)
full = {b["id"]: sorted(oz for oz, c in {p["oz"]: match(b["id"], p)[0] for p in t14}.items() if c == "none")
        for b in d["bidders"]}
print("     Luecken je Bieter:", full)
print("\n" + ("ALLES GRUEN" if ok else "FEHLER – siehe oben"))
sys.exit(0 if ok else 1)
