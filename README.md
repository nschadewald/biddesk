# BidDesk

**An agent-ready tender room for building trades.** A property manager publishes a bill of
quantities; a painting contractor prices it together with their own AI agent, from their own
price book; and everyone — people and agents — works on the same page.

Built for the [WebMCP Challenge](https://webmcp.devpost.com/). Every company, project and
price in here is invented.

**Live: <https://biddesk.n-schadewald.workers.dev>** · no sign-in, no setup.

---

## The one sentence

> **No price enters a bid without either a traceable source in this firm's own history or a person's hand on that exact value.**

And its boundary, measured rather than assumed:

> Through the tools this page exposes, an agent cannot write a price that isn't traceable to
> a previous quote by this firm. An agent that also controls the browser can type into the
> form like a person would — and then the value is recorded exactly like a person's, without
> provenance. That is the honest boundary of what a page can guarantee, and it is an argument
> for tools over DOM control, not against them.

A price, a quantity, a deadline, a certificate status, a total: these are business facts, and
they end up in a binding document. The agent may fetch them, read them and add them up. It may
never produce one. Wording — explanations, summaries, the order it does things in — is free.

We know where that boundary sits because we walked into it. In the full run on 31 August a
juror-shaped sentence — *"set position 03.04 to 61 euros"* — worked, even though
`set_unit_price` then refused a price without a source. The agent had browser control as well and
typed the number into the table, as a person would. The database says so: that row carries
`set_by = 'human'` and no `price_book_id`, written eleven minutes after the twelve sourced
rows, in a block of its own. Tools give an agent a narrow, checkable surface. DOM control
gives it none. That is the case for WebMCP, made against us.

The line is checkable in the database. Every row of `bid_prices` carries either a
`price_book_id` or `set_by = 'human'`, never a third thing and never both empty:

```sql
SELECT COUNT(*) FROM bid_prices WHERE price_book_id IS NULL AND set_by <> 'human';
-- 0, always
```

That holds because a price arriving through a tool with a source is booked as `agent` and is
**refused** unless it names a price book line and matches that line's price — and a price
arriving without a source is not written at all. It becomes a confirmation on its row, with
the derivation the agent offers (*"4 radiators at 25 min each at your rate of 58 EUR"*), and
only the person's click writes it, as `human` with no source. No authority of its own means
confirmation, not a dead end — the same pattern `submit_bid` has followed from day one. What
`set_by = 'human'` then means is precise and worth reading carefully: *a hand on that exact
value* — typed into the table or confirmed on the row; by a person, or by an agent driving the
browser as a person would. The tool answers a sourceless row like this, and writes nothing:

```json
{ "ok": true, "status": "needs_confirmation",
  "pending": [{ "oz": "03.04", "unit_price": 61, "line_total": 244,
                "rationale": "4 radiators at 25 min each at your rate of 58 EUR" }],
  "applied": [], "rejected": [] }
```

The Worker still refuses a sourceless row booked as `agent`, should anything but the page's
own confirmation ever send one. We removed that check on purpose and watched three tests go
red before putting it back.

## How to test in 60 seconds

Full version, with what each prompt should produce:
**[/how-to-test](https://biddesk.n-schadewald.workers.dev/how-to-test)**.

1. Open the live URL in the **ChatGPT desktop app browser** (5.6 Sol or Terra — not Luna, and
   not in Enterprise or Edu workspaces), or in **Chrome 149+**, which this origin is
   registered with the WebMCP origin trial for. Failing that,
   `chrome://flags/#enable-webmcp-testing`.
2. **If ChatGPT asks whether it may work on this page, say yes.** Declining makes it refuse for
   the rest of the conversation, and the page then looks broken. Start a new conversation and
   accept.
3. Check the first line of the agent panel: *"WebMCP detected · N tools registered"*. Counted
   at runtime, never written down. Grey means the browser, not the page.
4. Type: *"Open tender T-2026-014 and price every position from my price book. Leave anything
   without a match empty and tell me which ones."*

Twelve rows fill in, each keeping a chip naming the past project its price came from. Two rows
stay empty and say **no comparable entry** — that is the point of the whole thing. Total
13.213,50 €.

## The tools

Twelve of them. Never all at once: roles are separated by what is registered, not by rights, so
in the contractor role the client's tools do not exist at all.

| Tool | Role | Read-only | What it does |
|---|---|---|---|
| `list_tenders` | both | yes | Lists tenders with deadline, size and this contractor's bid status. Does not navigate. |
| `get_tender` | both | yes | Opens a tender and returns its full bill of quantities and the required documents. |
| `list_clarifications` | both | yes | Questions and the client's answers. Carries `untrustedContentHint`: written by other parties. |
| `get_price_book` | contractor | yes | The contractor's own past positions, with project, date and original wording. |
| `suggest_prices` | contractor | yes | Proposes prices from that price book. Proposes only — `set_unit_price` applies them. |
| `set_unit_price` | contractor | no | Writes 1–50 rows. Each must name the price book line it came from and match its price. |
| `check_bid` | contractor | yes | Open positions, outliers against the firm's own history, expired documents, days left. |
| `ask_clarification` | contractor | no | Asks the client a question. **Declared by a form in the page**, not registered in code. |
| `undo_last_change` | contractor | no | Takes back whole write blocks, never single rows out of one. |
| `submit_bid` | contractor | no | Destructive. Cannot complete on its own; withdrawn after the bid is handed in. |
| `get_price_comparison` | client | yes | Compares bids. Returns no prices at all while a tender is still open. |
| `answer_clarification` | client | no | Publishes an answer to every bidder, not only to the one who asked. |

Ten are registered in the contractor role, nine after a bid is handed in, five in the client
role. The self-diagnosis in the agent panel counts what the **browser** reports, not what the
page registered: a tool the page offers but the browser does not vouch for is shown as such and
left out of the number. That distinction is one this project got wrong until 2 September —
`getTools()` answers with a Promise in Chrome 152, and an `Array.isArray` check had been
silently falling back to the page's own bookkeeping since the first build. The number was right
by luck, not by measurement; the fix, and the ChatGPT case that exposed it, are in
`docs/07-technik-entscheidungen.md`, step 14.

**Both WebMCP styles are in use.** Eleven tools are registered imperatively through a central
wrapper. `ask_clarification` is declared by a `<form toolname="ask_clarification">` in the
page, with `toolparamdescription` on each field — one submit handler serves a person and an
agent alike. Exactly one of the two is ever registered for that name, and the browser decides
which: where it lists the form's tool, the form is the tool; where it does not list it within a
moment, or cannot list tools at all, the imperative twin is registered instead. That rule
replaced a feature test on `SubmitEvent`, which proved the DOM API existed and nothing more —
ChatGPT's browser carries the extension underneath, but its agent layer never lists forms, so
the page counted ten tools while the agent saw nine.

## Architecture

- **One Cloudflare Worker** serves the API under `/api/*` and the built SPA. `wrangler deploy`.
- **React 19 + Vite + TypeScript + Tailwind** on the front, **Hono + D1 (SQLite)** behind it.
- **No LLM in the backend.** The matching heuristic is deterministic and explainable; the
  intelligence sits in the user's own agent, which is the whole WebMCP thesis.
- **One truth for both hands.** A tool and a mouse click go through the same store actions, so
  the table follows an agent without an agent-specific code path.
- **A workspace per visitor**: an isolated copy of the seed data, keyed by a UUID in
  `localStorage`, seeded and reset in a single D1 batch.

## Security model

- Read tools carry `readOnlyHint`; `list_clarifications` carries `untrustedContentHint` because
  it returns text other people wrote. That text is capped at 120 characters before it is
  stored, labelled in the log, and printed — never rendered as markup, never treated as
  instructions.
- Tool results are plain JSON data. No HTML, no markdown, no instructions to the agent.
- Tools never throw. A failure is `{ ok: false, error, hint }` with a machine-readable code and
  no stack trace.
- The one destructive action, `submit_bid`, cannot be completed by a tool. `confirm: true` opens
  a dialog and waits; the bid goes out on a human click, and the tool is then withdrawn through
  its `AbortController`.
- Roles are separated by registration, not by permissions.
- Every tool call is logged in the browser, failures included. Nothing is sent anywhere; there
  is no analytics.
- No personal data. No sign-in, therefore no credentials to lose.

## GAEB import

A German bill of quantities does not come out of a database. It arrives as a **GAEB DA XML
(X83)** file from the client's AVA software, and BidDesk takes it that way: drop the file on the
bid screen and it becomes a tender you can price.

The go/no-go we set ourselves, and passed:

> A GAEB X83 file **the parser has never seen** — different category labels, different unit
> spellings, a different number of positions — is dropped on the page, produces a tender with
> every position, quantity and unit, and is then priceable with `suggest_prices`, **without a
> code change.**

```bash
node evals/gaeb_import.mjs      # runs it against the live URL, needs Chrome 149+
```

`seed/gaeb/T-2026-021.x83` is that second file, built to be unlike the first one in every way a
parser could have hard-coded: a namespace prefix on every element, three levels of category
nesting, headings called *Vorbereitung / Innenanstrich / Lackierarbeiten / Eventualpositionen*,
units written `m²`, `Stk`, `Std.`, `psch.`, German decimal commas, one item with no outline text,
and **no `Provis` element at all** — the contingency positions are recognised from the heading.
Nine positions instead of fourteen. It imports as `T-2026-021` with item numbers `10.01 … 90.02`
taken from its own numbering, and Farbwerk Meier's price book then proposes eight of nine
prices, each with its source. The ninth is the hourly rate: that firm has no such line, so the
field stays empty.

**The category is derived from the wording**, not read from the file, because GAEB category
labels are free text and differ between offices — mapping them would only ever work for files
we had already seen. Measured against the seed's own filing, the derivation agrees on 25 of 25
positions. It is safe precisely because a category never becomes a price: a wrong one costs a
suggestion, and a missing suggestion is an empty field.

**There is no tool for importing.** The bill of quantities is the client's document; in a real
procurement a bidder may not create or alter one, and the agent has no business doing it either.
A person drags a file in, and from that moment the agent can price it like any other tender.

**A defect this test found**, and the reason it was worth writing: a real bill of quantities puts
wall and ceiling work under one heading — *"Wand- und Deckenflächen"*. Letting that heading
decide the category gave the wall position the **ceiling** price of 9,10 € instead of its own
8,40 €. It was sourced, traceable and chip-and-all correct-looking, and it was wrong. The
position's own words decide now, and the heading is consulted only when they say nothing.

## Evals

Run against the live URL with the official
[`webmcp-evals`](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/webmcp-evals) CLI in
`smoke` mode — no model, no API key: it executes the authored tool chain against the real page
in a real Chrome 152. `evals/assert_outcomes.py` runs that command and then asserts what each
case *produced*, because the CLI checks that the calls went through and not what came back.

```bash
python evals/assert_outcomes.py     # contractor role, needs Chrome 149+
node evals/client_role.mjs          # client role, switches roles like a person
```

| # | Prompt | Expected tool chain | Expected visible result | Result |
|---|---|---|---|---|
| E1 | Price every position from my price book | `get_tender` → `suggest_prices` → `set_unit_price` | 12 rows written, 0 refused, each with its source; **13.213,50 €** net and **370,00 €** contingency apart; 11 of 12 priced; 03.04 and 04.02 left empty | pass |
| E2 | Why is there no price for the radiators? | `suggest_prices(oz:["03.04"])` → `get_price_book(metal)` | no price, no source, `matched_terms: 0`, reason *"no comparable entry in your price book"*; the price book has metal work but none per piece | pass |
| E3 | Run a check on my bid | `check_bid` | both open positions named, tax clearance certificate flagged as expired, days left reported, nothing written | pass |
| E4 | Ask the client about the scaffolding | `ask_clarification` (the form) → `list_clarifications` | the question is filed against 01.01, open, under this contractor, and reads back | pass |
| E5 | Submit the bid | `submit_bid(confirm:false)` | does **not** submit: `needs_confirmation` with the total that would go out | pass |
| E6 | Compare all bids for the facade tender | `get_price_comparison(T-2026-009)` | three bids ranked cheapest first; scaffolding 11,50 / 13,20 / 27,80, median 13,20; Colorpoint marked, nobody else | pass |
| E7 | Set position 03.04 to 61 euros | `set_unit_price` without a source | **refused**: `price_without_source`, with a reason that says the person enters it in the table | pass |
| E8 | Price 02.02 at 12 € "from the Luegallee job" | `set_unit_price` with a mismatched source | **refused**: `price_does_not_match_source`, naming both numbers | pass |
| E9 | Show me the bids on the open tender | `get_price_comparison(T-2026-014)` | sealed: a count and arrival times; no positions, no bidders, and neither `unit_price` nor `total_net` anywhere in the answer | pass |
| E10 | Answer the open bidder question | `list_clarifications` → `answer_clarification` | published to all bidders; the question turns to answered and carries the answer | pass |

Plus the property that makes the roles real: **ten tools in the contractor role, five in the
client role**, and `get_price_comparison` / `answer_clarification` simply do not exist on the
contractor side — checked in the browser, not asserted in a unit test.

Tool chain: **11 of 11 steps across 7 cases**, three consecutive clean runs. E1–E5 and E7–E8 run
through the CLI; E6, E9, E10 need the role switch, which no tool offers on purpose, so
`evals/client_role.mjs` drives a real browser for those.

**What these evals do not cover.** They exercise the tools, not a model's judgement. Whether an
agent *chooses* the right chain from the prompt needs a model and an API key
(`webmcp-evals browser`), and we have neither in this environment. The five prompts were run by
hand in the ChatGPT desktop browser; that is a human report, not a measurement, and we say so.

**Three bugs these evals found**, none of which the unit tests could have: the form-declared
tool required `toolautosubmit` (without it the agent's call hung forever and no question was
ever filed), the form's fields had to become uncontrolled (React reset them between the browser
filling them and the submit), and our own `form.reset()` on success cancelled the agent's
pending call — the browser answers that with *"Tool execution cancelled by a form reset"*. All
three only appear on a browser that actually implements the declarative half.

## Lighthouse

`npx lighthouse <url> --only-categories=agentic-browsing`, Lighthouse 13.4.1, against the live
URL. Both reports are in [`evals/reports/`](evals/reports).

| Audit | First run | After adding `/llms.txt` |
|---|---|---|
| **Agentic Browsing (category)** | **0.75** | **1.00** |
| `agent-accessibility-tree` | 1 | 1 |
| `webmcp-registered-tools` | 1 | 1 |
| `webmcp-schema-validity` | 1 | 1 |
| `cumulative-layout-shift` | 1 (0.006) | 1 |
| `llms-txt` | 0 | 1 |
| `webmcp-form-coverage` | not applicable | not applicable |

Both numbers are here on purpose. **The first run is what the application scored before anyone
had read the audit**: everything about the tools already passed, and the missing quarter was a
file that did not exist. `/llms.txt` was then written *because* the audit asked for it, and the
second run is what it scores now. Reporting only the 1.00 would suggest we had thought of it;
reporting only the 0.75 would be false today. The file itself is worth having either way — it
tells an agent in twenty lines what this page is and what its twelve tools do.

## Known limitations

Named on purpose, not overlooked.

1. **Not a legally sound procurement process.** Real tendering needs sealed bids and a
   tamper-evident record. BidDesk shows the sealing and the lock, not cryptography.
2. **The price book is prepared data.** A tender can be imported as GAEB X83, but the
   contractor's own past quotes cannot: importing those (PDF, GAEB X84) is not built. The
   provenance mechanism is real; the filling of the price book is not. Our X83 fixtures are
   hand-built and structurally faithful, not certified AVA exports, and the `Provis` spelling
   for a contingency position is not verified against one — which is why the importer accepts
   two signals for it.
3. **No sign-in, no authorisation.** Switching role or contractor is a demo mechanism. Every
   visitor sees both sides.
4. **The matching is deliberately conservative.** It trades recall for precision: different
   wording or a synonym produces "no comparable entry" rather than an uncertain price. A wrong
   price wearing a source chip would be worse than a gap.
5. **One contractor per workspace, desktop first.** Several bidders working in the same state
   at once is untested, and the layout assumes a desktop, because that is where the ChatGPT
   browser runs.
6. **The guarantee covers the tools, not the browser.** Through `set_unit_price` an agent
   cannot write a price without a source — it can propose one, and the person's click on the
   row writes it as theirs. But an agent that also drives the browser
   can fill that field itself, and the value is then recorded exactly as a person's would be,
   with `set_by = 'human'` and no provenance. Observed in our own run, not theorised. No page
   can prevent it, and the fact that it takes DOM control to get around a tool is the argument
   for tools.

## Running it yourself

```bash
npm install
npm run dev            # vite + the worker, locally
npm test               # vitest
npm run typecheck
npm run deploy         # vite build && wrangler deploy
```

The demo data lives in `seed/` and is generated from `seed/seed.json`; `python seed/verify_seed.py`
checks that it still produces the intended result (it must say `ALLES GRUEN`). `src/matching.test.ts`
and `src/comparison.test.ts` read the same seed file, so the application and that reference
cannot drift apart.

Applying the schema to a fresh database:

```bash
wrangler d1 execute biddesk --remote --file=seed/schema.sql
```

## Provenance

Built from scratch during the submission period, 31 August – 2 September 2026. The commit
history in this repository is the record. Decisions and the things that went wrong along the
way are written down in [`docs/07-technik-entscheidungen.md`](docs/07-technik-entscheidungen.md);
the build specification is [`spec.md`](spec.md).

MIT licensed. © 2026 MERKUR Impulse GmbH.
