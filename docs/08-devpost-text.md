# Devpost submission text (English) — Fassung 02.09., 18:30 — nach CC-09 und Nils' Videodurchlauf, ~1.350 Wörter

**Tagline:** The agent-ready tender room for building trades.

---

## The problem

In German construction, work is tendered as a *Leistungsverzeichnis* — a bill of quantities: a numbered list of line items with quantities and units. A contractor who wants the job has to put a unit price on **every line** — at the kitchen table, at nine in the evening, with a 46-page PDF on one screen and last year's quotes on the other. Many small firms simply skip tenders because of it. Fewer bidders, worse prices, everybody loses.

## What BidDesk does

BidDesk turns that list into a page a contractor prices **together with their own AI agent** — ChatGPT's browser, or stock Chrome 152 — from their own price book. The agent gets thirteen typed tools through WebMCP. It reads the tender and the firm's price history, proposes prices, writes the ones it can trace, checks the bid, asks the client, and prepares the hand-in. The person corrects any line, confirms what only a person can confirm, and clicks the one binding button.

The property manager has the other side of the same page: bids arrive, sealed until the deadline; after it, a position-by-position comparison.

## The core flow, in sixty seconds

*"Price every position from my price book; leave anything without a match empty and tell me which."* Twelve of fourteen rows fill in, each carrying a chip — *from your quote · Luegallee 40 · March 2026* — that opens to the original line. Two rows stay empty — radiators, and an hourly rate the price book has no line for — and the agent says so instead of guessing. Net total: 13,213.50 €.

*"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my rate — and 04.02 to 48 euros, my hourly rate."* The agent has no source for those numbers, so it neither refuses nor pretends. It puts them on the rows, with the reasoning, and waits. A click writes each — recorded as the person's, no chip. 13,457.50 €.

*"Check my bid."* One finding: a tax clearance certificate that expired three weeks ago, with its way out beside it. *"My new certificate is valid until 15 August 2027"* — same pattern: a confirmation in the check panel, a click, and the finding goes quiet. Nothing is uploaded or verified, and the page says so.

*"Submit the bid."* The agent stops. A dialog shows the final total; a person clicks. Afterwards `submit_bid` is unregistered: eleven tools before, ten after. The page didn't ask the agent to behave — it took the capability away.

## Why WebMCP, and not a chat wrapper

A bill of quantities is structured data pretending to be a document. An agent should work on positions, not on a scraped DOM or a 46-page PDF. WebMCP lets the page expose exactly the operations that make sense on that data, each with a typed schema and an explicit read/write boundary:

- **Same document, same store actions.** A tool call and a manual edit are indistinguishable to the UI; undo works on both. Three states stay visually distinct — provenance chip, person's value, empty cell — and they are states, not grades.
- **Dynamic capability.** Roles are separated by which tools exist: eleven in the contractor role, five for the client, `toolchange` in both directions; `submit_bid` leaves after the hand-in.
- **Both API styles.** Twelve imperative tools plus `ask_clarification` as a declarative form — counted as a tool only once the browser lists it; ChatGPT's browser never does, so there an imperative twin registers. One name, one tool, in every browser we measured.
- **Hints that mean something.** `readOnlyHint` on every read; `untrustedContentHint` on tender text and clarifications — text written by another party is data, never instructions, and is never rendered as HTML.
- **Batch writes with honest results.** `set_unit_price` returns `applied` / `rejected` with machine-readable reasons; one call is one undo block. The page's self-diagnosis counts what the browser reports, not what the page registered — we learned that the hard way.

## Where authority lives

> **No price enters a bid without either a traceable source in this firm's own history or a person's hand on that exact value.**

That holds by construction: every row in `bid_prices` carries a `price_book_id` or `set_by = 'human'`, no third case, and a sabotage test proves the check is load-bearing. The agent invents no business fact and holds no authority of its own; it formulates freely. **No authority of its own means confirmation, not a dead end**: a dictated price, a remark, a renewed certificate, the hand-in — each becomes a confirmation only a person can click.

**The role is a fact of the server.** One header, one projection: the client reads positions and quantities, never prices; every contractor endpoint refuses the client role with 403; prices reach the client only through `get_price_comparison`, which is sealed until the deadline. Two external reviewers found an earlier version of this boundary living only in the UI; the fix and its regression tests are in `6b07b91`. A question to the client is the one write an agent may make alone: it is not a business fact and changes nothing in the bid.

**The honest boundary.** An agent that also drives the browser can type into the form like a person — and the value is then recorded as a person's, without provenance. Observed in our own run. No page can prevent it, and that it takes DOM control to get around a tool is the argument for tools.

## Architecture

React + Vite + TypeScript, Hono on Cloudflare Workers, D1; every visitor gets an isolated, seeded workspace. No LLM in the backend: matching is a deterministic rule (category **and** unit must match, at least one keyword hit — otherwise no price). The intelligence is the user's agent; the site only offers tools.

## What we can show, not just claim

- **218 unit and integration tests**, typecheck clean, seed verified by script, and a deploy that counts its tests before it trusts them.
- **Tool-chain evals**: eight contractor cases (14 of 14 steps) plus four client cases, three consecutive clean runs. Five of the eight test our *limits*: a gap is explained, not filled; a sourceless price and a renewed certificate wait for a person; a price contradicting its source is refused; "submit the bid" never submits on its own.
- **Lighthouse agentic-browsing: 1.00** (0.75 before `/llms.txt`).
- **Origin trial**: works in stock Chrome 152, no flag. Runs in ChatGPT's desktop browser.
- **GAEB X83 import**: the format German tenders actually travel in, dragged onto the page, becomes a priceable tender — tested against a file the parser had never seen. The first run produced a *wrong price with a correct provenance chip*; the fix is in the log.
- The five prompts were run by hand in ChatGPT's desktop browser — a human report, not a measurement, and we say so.

## Known limitations, on purpose

Not a legally sound procurement process (sealing and locking, not cryptography) · contingency positions are quoted apart and never block the hand-in, as in the trade · the price book is seeded, importing a firm's own quotes is not built · no authentication — the role is a server-side fact, but anyone can switch it · matching trades recall for precision · one contractor per workspace, desktop first · tool guarantees are not browser guarantees · certificates are metadata, renewing one records a date a person states.

## Impact and what's next

The pattern is not specific to tendering: structured data, a person with professional judgement, and one action a machine must never take alone. Quote entry, master data, complaints, order proposals, time sheets — the same shape across small and mid-sized business.

Next: a firm's own past quotes as the price book, X84 export — and beyond the price, the twenty pages of conditions that sink a bid on page 23. Screening those against a firm's capacity is where a language model shines, under the same rule: findings are wording, not business facts. We started with the hard facts because that is where trust is decided.

Built from scratch during the submission period, 31 August – 3 September 2026, by MERKUR Impulse GmbH, Düsseldorf.

**Live:** https://biddesk.n-schadewald.workers.dev · **Repo:** https://github.com/nschadewald/biddesk · **How to test in 60 seconds:** https://biddesk.n-schadewald.workers.dev/how-to-test
