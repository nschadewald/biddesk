# Devpost submission text (English) — Fassung 02.09., 12:45 — nach CC-05

**Tagline:** The agent-ready tender room for building trades.

---

## What it is

In German construction, work is tendered as a *Leistungsverzeichnis* — a bill of quantities: a numbered list of line items with quantities and units. 320 m² of wall surface. 45 m of handrail. 10 doors. A contractor who wants the job has to put a unit price on **every single line**, and that happens at the kitchen table at nine in the evening, with a 46-page PDF on one screen and a spreadsheet on the other, hunting for what the firm charged for the same work last year.

Many small firms simply skip tenders because of it. Fewer bidders, worse prices for the client. Everybody loses.

BidDesk turns that list into a page a contractor prices **together with their own AI agent**: "price every position from my price book, leave anything without a match empty and tell me which ones." Rows fill in on screen, each carrying the past quote it came from. Where nothing matches, the agent says so instead of guessing — and where a person states a price, it puts it on the row and waits for their click. The human corrects any line. Submitting stops at a dialog only a person can click.

Second role: the property manager sees bids arrive — but, per German procurement law, cannot see prices before the deadline. A sealed counter, not a leaderboard.

---

## 1. Why WebMCP fits this use case

A bill of quantities is **structured data pretending to be a document**. Agents should work on the positions, not on a scraped DOM or a 46-page PDF. WebMCP lets us expose exactly the operations that make sense on that data — read the tender, read the firm's price book, propose prices, apply them, check the bid, ask the client, hand it in — each with a typed schema and an explicit read/write boundary.

The alternative is an agent clicking its way through our UI and guessing what a cell means. That is slower, unreliable, and — for a document that becomes a binding commercial offer — unacceptable.

## 2. How it improves the user experience

The work that vanishes is the *searching*, not the *deciding*. The contractor states an intent in one sentence; the twelve prices that exist in their own history appear in the table, each with "from Luegallee 40, March 2026" attached and clickable back to the original line. The two positions the firm has never priced stay conspicuously empty — "no comparable entry". The contractor says: "set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my rate." The agent has no source for that number, so it neither refuses nor pretends: it puts the price on the row, with the reasoning, and waits. A click writes it — as the person's, with no chip.

Then: "run a check on my bid." An outlier against the firm's own history, an expired tax clearance certificate, days left — each finding with what to do about it. "My new certificate is valid until August 2027": the same pattern, a confirmation in the check panel, a click, and the finding goes quiet. Nothing is uploaded or verified, and the page says so. Then a question to the client without leaving the page. Then "submit the bid" — and the agent stops.

## 3. What humans and agents can do together here

Both drive the **same document through the same store actions**. A tool call and a manual edit are indistinguishable to the UI, and undo works on both. Three states stay visually distinct, and they are states, not grades: a value with a provenance chip (taken from the price book), a value without one (typed by a person), and an empty cell that says why it is empty.

The price book is a screen of its own: every line the matcher can see, grouped by trade and unit, searched with the very normalisation the matcher uses, and a coverage grid whose empty cells are the gaps — `metal / pcs` for this firm, which is why the radiators stay empty. An empty cell links to the positions it would have priced, and to the way out. Switch the contractor in the header and the grid changes with it: same bill of quantities, three different firms, three different sets of gaps.

The division of labour is explicit rather than implied:
- The agent may read everything, propose freely, and write prices it can trace. Anything else — a dictated price, a derived one, a remark, a renewed certificate — becomes a confirmation on the row; a person's click writes it.
- The human may do anything, including things the agent cannot.
- The binding act needs both: the agent prepares and summarises; only a person can hand in.
- After submission `submit_bid` is unregistered — the capability physically leaves the agent's repertoire, and the page's self-diagnosis counts one tool fewer.

## 4. How WebMCP is used

**13 distinct tools**, never all at once: 11 registered in the contractor role, 10 after a bid is handed in, 5 in the client role. Switching roles fires `toolchange` in both directions.

- Registration through one wrapper: `document.modelContext`, falling back to `navigator.modelContext` (the July 2026 draft moved the API; Chrome 152 no longer exposes the old location — we support both anyway).
- `readOnlyHint` on every read tool; `untrustedContentHint` on anything returning text written by another party. Clarification text is truncated to 120 characters in the log, labelled untrusted, and never rendered as HTML.
- Both API styles: twelve imperative tools plus `ask_clarification` as a **declarative form** (`toolname` / `tooldescription` / `toolparamdescription` / `toolautosubmit`). The form counts as a tool only once the browser lists it in `getTools()` — presence of the API is not proof. Chrome 152 lists it about 30 ms after insertion; ChatGPT's browser does not list form-declared tools at all, so there the imperative twin registers after 600 ms of silence. One name, one tool, in every browser we measured.
- The self-diagnosis in the agent panel counts what the browser reports, not what the page registered. We learned that the hard way: `getTools()` returns a promise in Chrome 152, and for three days our own counter had silently fallen back to its own bookkeeping. It now awaits the browser — and says "not confirmed by this browser" when it cannot.
- Batch writes: `set_unit_price` validates each row, writes the valid ones in one atomic D1 batch, and returns `applied` / `rejected` with machine-readable reasons. One call is one block in the change log, and undo takes the block back.
- Registration uses `Promise.allSettled` — one tool the browser rejects does not cost the others.
- Tools never throw. Errors are `{ok:false, error, hint}`; output is plain JSON, never HTML or instructions.
- No LLM in the backend. Price matching is a deterministic, explainable rule: trade category **and** unit of measure must both match, keywords are compared as substrings on normalised text (German compounds: "Schimmelbehandlung" contains "schimmel" and "behandlung"), and at least one keyword must hit. Otherwise: no price. The intelligence is the user's agent; the site only offers tools.

Stack: React + Vite + TypeScript, Hono on Cloudflare Workers, D1. No login — every visitor gets an isolated, seeded workspace and a reset button.

---

## What we can show, not just claim

- **Evals**: eight contractor-side cases, 14 of 14 tool-chain steps, plus the client-role run — three clean consecutive runs. Five of the eight test our *limits* rather than our successes: a gap must be explained, not filled; a price without a source must wait for a person, and so must a renewed certificate; a price that contradicts the source it names must be refused; and "submit the bid" must not submit.
- The eval run **found three real bugs** in the declarative path that were invisible on our test browser — including a missing `toolautosubmit` that made clarifications silently do nothing.
- **Lighthouse agentic-browsing: 1.00** — 0.75 on the first run with every tool-related audit passing (accessibility tree, registered tools, schema validity); the missing quarter was a missing `/llms.txt`.
- **Origin trial**: works in stock Chrome 152 with no flag.
- **GAEB DA XML import**: a bill of quantities in the file format German tenders actually travel in, dragged onto the page, becomes a priceable tender — tested with a file the parser had never seen: namespace prefixes on every element, three levels of nesting, different unit spellings, one item without an outline text, no `Provis` marker anywhere. Nine of nine positions, quantities with German decimal commas, units normalised, contingency items recognised from the section heading alone. No code change.

### Why we tested against a stranger's file

The first import run "passed" — and produced a **wrong price carrying a correct provenance chip**, the one outcome this product exists to prevent. Real bills of quantities group wall and ceiling work under one heading ("Wand- und Deckenflächen"). Our category derivation read the heading, found "Decken", and gave a wall position the ceiling price: 9.10 € instead of 8.40 €. Traceable, explainable, wrong.

It could not have surfaced on our own sample files, because our own headings are tidy. The position text now decides alone; the heading is consulted only when the text yields nothing. This was the third bug of the same family — each one found by testing against something unfamiliar rather than against ourselves.

## An honest boundary we measured

Our first draft of the central claim was "the agent cannot write a price that is not traceable — by construction." Then a test run in ChatGPT's browser set a price we were sure it could not set. The database showed why: twelve rows written through the tool as `agent`, each with a price-book id — and eleven minutes later, in a block of its own, one row as `human` with no source. The agent had *typed into the form*, as a person would, because it also controlled the browser.

So the precise claim is — the rule first, then its boundary:

> **No price enters a bid without either a traceable source in this firm's own history or a person's hand on that exact value.**

> Through the tools this page exposes, an agent cannot write a price that isn't traceable to a previous quote by this firm. An agent that also controls the browser can type into the form like a person would — and then the value is recorded exactly like a person's, without provenance. That is the honest boundary of what a page can guarantee, and it is an argument for tools over DOM control, not against them.

## Known limitations (deliberate)

1. Not a legally sound procurement process — real tendering needs sealed bids and a tamper-proof record; we show status and locking, not cryptography.
2. The price book is seeded data. The provenance mechanism is real; the filling of it is not.
3. No authentication. Roles are separated by *which tools are registered*, not by permissions — a demo trust model, and a stronger WebMCP demonstration than a login.
4. Matching is deliberately conservative: it trades recall for precision. A wrong price carrying a provenance chip would be worse than a gap.
5. An agent cannot enter a price of its own — but it can propose one. A dictated or derived price becomes a confirmation on the row, with the agent's rationale; the person's click writes it, as theirs, with no source. No authority of its own means confirmation, not a dead end — the same pattern as submitting.
6. See the boundary above: tool guarantees are not browser guarantees.
7. Certificates are metadata — a label and an expiry date. Renewing one through the chat records the date a person states and confirms; nothing is uploaded or verified, and the confirmation says so in plain words.

## What's next

Real historical quotes instead of a seeded price book — importing a firm's past bids from PDF or GAEB X84 is the step that turns this from a demonstration into something a contractor could use on Monday. Beyond that: X84 export of the finished bid and a paste-in import for firms whose software predates GAEB.

And beyond the price: a tender is also twenty pages of conditions, deadlines and qualification requirements — the two lines on page 23 that sink a bid. Screening those against a firm's capacity and material lead times is where a language model actually shines, and it fits the same rule: findings are wording, not business facts, and nothing enters the bid without a person. We started with the hard facts on purpose, because that is where trust is decided — an agent that invents nothing at the price is one you will believe about the risk.

Built from scratch during the submission period, 31 August – 3 September 2026, by MERKUR Impulse GmbH, Düsseldorf.
