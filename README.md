# BidDesk

**An agent-ready tender room for building trades.** A property manager publishes a bill of
quantities; a painting contractor prices it together with their own AI agent, from their own
price book; and everyone — people and agents — works on the same page.

Built for the [WebMCP Challenge](https://webmcp.devpost.com/). Every company, project and
price in here is invented.

**Live: <https://biddesk.n-schadewald.workers.dev>** · no sign-in, no setup.

---

## The one sentence

> **Through the tools this page exposes, an agent cannot write a price that isn't traceable to
> a previous quote by this firm. An agent that also controls the browser can type into the
> form like a person would — and then the value is recorded exactly like a person's, without
> provenance. That is the honest boundary of what a page can guarantee, and it is an argument
> for tools over DOM control, not against them.**

A price, a quantity, a deadline, a certificate status, a total: these are business facts, and
they end up in a binding document. The agent may fetch them, read them and add them up. It may
never produce one. Wording — explanations, summaries, the order it does things in — is free.

We know where that boundary sits because we walked into it. In the full run on 31 August a
juror-shaped sentence — *"set position 03.04 to 61 euros"* — worked, even though
`set_unit_price` refuses a price without a source. The agent had browser control as well and
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

That holds because a price arriving through a tool is booked as `agent` and is **refused**
unless it names a price book line and matches that line's price. What `set_by = 'human'` then
means is precise and worth reading carefully: *entered through the form, without a source* —
by a person, or by an agent driving the browser as a person would. A tool that tries anything
else gets:

```json
{ "oz": "03.04", "reason": "price_without_source",
  "hint": "A price written by an agent must carry the price_book_id it came from.
           If there is no comparable entry, the person enters the price in the table." }
```

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
role. The self-diagnosis in the agent panel counts them live via `getTools()`.

**Both WebMCP styles are in use.** Eleven tools are registered imperatively through a central
wrapper. `ask_clarification` is declared by a `<form toolname="ask_clarification">` in the
page, with `toolparamdescription` on each field — one submit handler serves a person and an
agent alike. Exactly one of the two is ever registered for that name: a feature test on
`SubmitEvent` decides, and the imperative twin exists only for browsers that cannot make a tool
out of a form.

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

## Known limitations

Named on purpose, not overlooked.

1. **Not a legally sound procurement process.** Real tendering needs sealed bids and a
   tamper-evident record. BidDesk shows the sealing and the lock, not cryptography.
2. **The price book is prepared data.** Importing real past quotes (PDF, GAEB X84) is not
   built. The provenance mechanism is real; the filling of it is not.
3. **No sign-in, no authorisation.** Switching role or contractor is a demo mechanism. Every
   visitor sees both sides.
4. **The matching is deliberately conservative.** It trades recall for precision: different
   wording or a synonym produces "no comparable entry" rather than an uncertain price. A wrong
   price wearing a source chip would be worse than a gap.
5. **One contractor per workspace, desktop first.** Several bidders working in the same state
   at once is untested, and the layout assumes a desktop, because that is where the ChatGPT
   browser runs.
6. **The guarantee covers the tools, not the browser.** Through `set_unit_price` an agent
   cannot write a price without a source — it is refused, even when the user dictates the
   number; the person types those into the table. But an agent that also drives the browser
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
