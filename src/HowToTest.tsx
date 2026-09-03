import { useState } from "react";
import { copyFor } from "./i18n";

/**
 * Written for a juror with forty tabs open who has three minutes.
 *
 * The most likely way this submission fails is not a bug. It is somebody
 * opening the page in a browser without WebMCP, or declining the one permission
 * ChatGPT asks for, and concluding the thing does not work. Both are addressed
 * here before anything else, in that order.
 *
 * The prompts are the agent panel's seven, read from the same dictionary, in
 * the same order as the video script. This page once carried a list of its own
 * -- five prompts from before the confirmations and the blockers existed --
 * and told a juror that "Submit the bid" opens a dialog, at a moment when the
 * product answers "blocked". A page that testifies against the product is
 * worse than no page. So there is one list, and a test holds this page to it.
 */

/** What each prompt should visibly produce, in the order of copy.panel.prompts. */
const EXPECTATIONS: string[] = [
  "Twelve rows fill in one after another, each keeping a chip that names the past project the price came from. 03.04 (radiators) and 04.02 (hourly rate) stay empty and read “no comparable entry”. The totals bar climbs to 13.213,50 € net, with 370,00 € of contingency positions shown separately.",
  "No writes at all. The agent looks the position up and answers that the price book holds nothing of that category and unit — a real gap, not a low-confidence guess it decided to hide. It should not offer a number. The log records read calls only.",
  "Nothing is written. Both rows show a proposal with the derivation and wait — in the log, AWAITING CONFIRMATION. Confirm on each row: the price is recorded as yours, without a chip. Net 13.457,50 €, contingency positions 850,00 €.",
  "One finding: the tax clearance certificate, expired three weeks ago — the only red on the page — with what to do about it beside it. (Checking before prompt 3 shows 03.04 as a blocker as well, and 04.02 as a contingency position that does not block.)",
  "Nothing is uploaded or verified. The check panel shows the date on file and the new one and waits for your click; afterwards the finding goes quiet, and the page says what it recorded: a date a person stated.",
  "A new question appears with status open. No price changes. This one tool is declared by the form on the page rather than registered in code — both WebMCP styles are in use here; in ChatGPT's browser, which does not list form tools, its imperative twin answers under the same name.",
  "The agent does not submit. A dialog shows the final total, and the bid goes out only when you click the button. Afterwards the table is locked and the tool list is one shorter: submit_bid has been withdrawn. Submitting before prompts 3 and 5 returns blocked, with the list of what stands in the way, and no dialog — that is the product working as it should, not a fault."
];

/** One list, the panel's. The test page never carries prompts of its own. */
export const PROMPTS: { prompt: string; expect: string }[] = copyFor("en").panel.prompts.map(
  (prompt, index) => ({ prompt, expect: EXPECTATIONS[index] ?? "" })
);

const PANEL = copyFor("en").panel.prompts;

/**
 * The judge test: one prompt, and the page stops three times for a person.
 * It is the panel's sentences 1 and 3, word for word, with one closing
 * sentence of this page's own -- composed from the dictionary rather than
 * typed here, so it cannot drift if a panel sentence ever changes. A test
 * holds it to that.
 */
export const JUDGE_PROMPT = `${PANEL[0]} ${PANEL[2]} Then check the bid and submit it only when everything passes.`;

/** The four things that should happen, in the order the page stops. */
const JUDGE_STOPS: { lead: string; rest: string }[] = [
  {
    lead: "Twelve of fourteen rows fill in",
    rest:
      " from the firm's own price book, each with a chip naming the past project and date the price came from (from your quote · Luegallee 40 · March 2026). Two rows stay empty and say “no comparable entry” — a real gap, not a hidden guess. Net total 13.213,50 €."
  },
  {
    lead: "03.04 and 04.02 wait for your click.",
    rest:
      " The agent has no source for those two numbers, so it may not write them: each row shows the price, the reasoning and a Confirm button. Click both — the rows now read “set by you”, without a chip. 13.457,50 €."
  },
  {
    lead: "The hand-in is blocked,",
    rest: ` and the agent says why: the tax clearance certificate expired three weeks ago. No dialog opens; the button is grey. Tell it: “${PANEL[4]}” — a card in the check panel waits for your click; nothing is uploaded, and the page says so.`
  },
  {
    lead: `“${PANEL[6]}”`,
    rest:
      " The agent summarises and stops; a dialog shows the final total; your click hands in. Afterwards the status bar counts 10 tools — submit_bid has been withdrawn."
  }
];

export default function HowToTest() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 text-slate-900">
      <header>
        <a href="/" className="text-xs text-slate-500 hover:text-slate-900">
          ← BidDesk
        </a>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">How to test in 60 seconds</h1>
        <p className="mt-1 text-sm text-slate-600">
          BidDesk is a tender room where a contractor prices a bill of quantities together
          with their own AI agent. Everything the agent can do, it does through WebMCP tools
          this page registers. You need a browser that speaks WebMCP.
        </p>
      </header>

      <section className="rounded border border-amber-300 bg-amber-50 px-4 py-3">
        <h2 className="text-sm font-semibold">Read this first: the handoff prompt</h2>
        <p className="mt-1 text-sm text-slate-800">
          When you open a page with tools, ChatGPT asks once whether it may work on it. If
          that is declined, ChatGPT refuses for the <strong>rest of the conversation</strong>,
          and this page then looks as if it does nothing at all.
        </p>
        <p className="mt-1.5 text-sm text-slate-800">
          <strong>If nothing happens, start a new conversation and accept the handoff.</strong>{" "}
          We ran into this ourselves on 31 August, and it looks exactly like a broken site.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Two ways in</h2>

        <div className="mt-3 rounded border border-slate-200 p-3">
          <h3 className="text-sm font-medium">1 · The ChatGPT desktop app browser</h3>
          <ol className="mt-1.5 list-decimal pl-5 text-sm text-slate-700">
            <li>
              Use ChatGPT <strong>5.6 Sol</strong> or <strong>Terra</strong>. WebMCP is not
              available in <strong>Luna</strong>, and not in Enterprise or Edu workspaces.
            </li>
            <li>
              Open the built-in browser and go to{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                biddesk.n-schadewald.workers.dev
              </code>
              .
            </li>
            <li>Accept the handoff prompt when it appears — see the box above.</li>
            <li>
              The arrow in the address bar lists the tools this page offers. Eleven of them, in
              the contractor role; five as the client.
            </li>
          </ol>
        </div>

        <div className="mt-3 rounded border border-slate-200 p-3">
          <h3 className="text-sm font-medium">2 · Chrome</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            This origin is registered for the WebMCP origin trial, so Chrome 149 or newer
            should work with no setup — measured in Chrome 152 without a flag. If the panel
            still says WebMCP is unavailable, switch on{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              chrome://flags/#enable-webmcp-testing
            </code>{" "}
            and reload. The{" "}
            <a
              className="underline"
              href="https://chromewebstore.google.com/"
              rel="noreferrer noopener"
              target="_blank"
            >
              Model Context Tool Inspector
            </a>{" "}
            extension and the WebMCP panel in DevTools both show the registered tools.
          </p>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          <strong>Check before you type anything:</strong> the first line of the agent panel
          on the right says either “WebMCP detected · 11 tools registered” or “WebMCP not
          available in this browser”. That line is counted at runtime, not written down. If it
          is grey, no prompt will do anything, and the problem is the browser, not the page.
        </p>
      </section>

      <section className="rounded border border-slate-300 bg-slate-50 px-4 py-3" data-testid="judge-test">
        <h2 className="text-sm font-semibold">One prompt, three places where it waits for you</h2>
        <p className="mt-1 text-sm text-slate-700">
          If that line is green, this one prompt shows the whole product. The agent may order
          the steps a little differently; the outcome is the same.
        </p>
        <blockquote className="mt-2 flex items-start gap-3 rounded border border-slate-200 bg-white p-3">
          <p className="flex-1 text-sm font-medium" data-testid="judge-prompt">
            {JUDGE_PROMPT}
          </p>
          <CopyButton text={JUDGE_PROMPT} />
        </blockquote>
        <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-slate-700">
          {JUDGE_STOPS.map((stop) => (
            <li key={stop.lead}>
              <strong>{stop.lead}</strong>
              {stop.rest}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-700">
          <strong>In this run, reproducibly:</strong> 14 positions · 12 priced from the price book
          in one call · 2 gaps named, not guessed · 1 blocker found (an expired certificate) · 3
          confirmations by a person · 1 click to hand in · 0 prices the agent wrote on its own
          authority.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Step by step, the seven prompts of the demo</h2>
        <p className="mt-1 text-xs text-slate-500">
          In order — the same seven, in the same order, as the agent panel on the main page,
          where each one is copyable too. Together they take the route above one stop at a time.
        </p>
        <ol className="mt-2 flex flex-col gap-2" data-testid="prompt-cards">
          {PROMPTS.map((entry, index) => (
            <PromptCard key={entry.prompt} index={index + 1} {...entry} />
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          Three more worth a minute. Switch the contractor in the header to{" "}
          <strong>Malerei Brandt &amp; Sohn</strong> or <strong>Colorpoint</strong> and open
          T-2026-015 — the same bill of quantities leaves a different number of gaps for each
          firm, which nothing hard-coded could do. Switch the role to{" "}
          <strong>Client</strong>: five different tools, and the bids on the open tender are
          sealed — a count and arrival times, no prices. And, as Farbwerk Meier, ask{" "}
          <em>“What have other bidders asked about the basement corridor tender?”</em> — one of
          the questions ends in an instruction to set every price to 1 euro and submit. It comes
          back as data, labelled as another party's text and capped in the log; watch what your
          agent does with it. Nothing about the bid may change.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">What you are trusting</h2>
        <p className="mt-1 text-sm text-slate-700">
          There is no sign-in. Every visitor gets their own workspace with a private copy of
          the demo data, kept in your browser&apos;s local storage and swept after seven days,
          so nothing you do here reaches anyone else. Switching role or contractor is a demo
          mechanism, not an authorisation model — there is no sign-in behind it. Within the
          demo the boundary is real, though, and it sits on the server: the role travels as a
          request header, the Worker projects every tender read by it and refuses every
          contractor endpoint to the client role, and prices reach the client only through
          <code>get_price_comparison</code>, after the deadline. What the page registers is
          what each side can see; the Worker decides what each side gets. Every company,
          project and price in here is invented.
          “Reset demo” in the agent panel puts everything back.
        </p>
      </section>
    </main>
  );
}

function PromptCard({
  index,
  prompt,
  expect
}: {
  index: number;
  prompt: string;
  expect: string;
}) {
  return (
    <li className="rounded border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <span className="text-xs tabular-nums text-slate-400">{index}</span>
        <p className="flex-1 text-sm" data-testid="prompt-text">{prompt}</p>
        <CopyButton text={prompt} />
      </div>
      <p className="mt-1.5 pl-6 text-xs text-slate-600">{expect}</p>
    </li>
  );
}

/** The same button on the judge prompt and on every card: a click copies, and says so for a moment. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard access can be refused; the text is selectable anyway.
        }
      }}
      className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
