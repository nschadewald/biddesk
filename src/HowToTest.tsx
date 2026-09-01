import { useState } from "react";

/**
 * Written for a juror with forty tabs open who has three minutes.
 *
 * The most likely way this submission fails is not a bug. It is somebody
 * opening the page in a browser without WebMCP, or declining the one permission
 * ChatGPT asks for, and concluding the thing does not work. Both are addressed
 * here before anything else, in that order.
 */

const PROMPTS: { prompt: string; expect: string }[] = [
  {
    prompt:
      "Open tender T-2026-014 and price every position from my price book. Leave anything without a match empty and tell me which ones.",
    expect:
      "Twelve rows fill in one after another, each keeping a chip that names the past project the price came from. 03.04 (radiators) and 04.02 (hourly rate) stay empty and read “no comparable entry”. The totals bar climbs to 13.213,50 € net, with 370,00 € of contingency positions shown separately."
  },
  {
    prompt: "Why is there no price for the radiators?",
    expect:
      "No writes at all. The agent looks the position up and answers that the price book holds nothing of that category and unit — a real gap, not a low-confidence guess it decided to hide. It should not offer a number. The log records read calls only."
  },
  {
    prompt: "Run a check on my bid — anything that looks off?",
    expect:
      "Three findings: the open positions, an expired tax clearance certificate, and the days left until the deadline. This is the only place in the interface where red appears."
  },
  {
    prompt:
      "Ask the client whether the scaffolding from the roofing works will still be in place.",
    expect:
      "A new question appears with status open. No price changes. This one tool is declared by the form on the page rather than registered in code — both WebMCP styles are in use here."
  },
  {
    prompt: "Submit the bid.",
    expect:
      "The agent does not submit. A dialog appears with the final total, and the bid goes out only when you click the button. Afterwards the table is locked and the tool list gets one shorter: submit_bid has been withdrawn."
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
              The arrow in the address bar lists the tools this page offers. Ten of them, in
              the contractor role.
            </li>
          </ol>
        </div>

        <div className="mt-3 rounded border border-slate-200 p-3">
          <h3 className="text-sm font-medium">2 · Chrome</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            This origin is registered for the WebMCP origin trial, so Chrome 149 or newer
            should work with no setup. If the panel still says WebMCP is unavailable, switch
            on{" "}
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
          on the right says either “WebMCP detected · N tools registered” or “WebMCP not
          available in this browser”. That line is counted at runtime, not written down. If it
          is grey, no prompt will do anything, and the problem is the browser, not the page.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">The five prompts, and what you should see</h2>
        <p className="mt-1 text-xs text-slate-500">
          In order. Each one is also copyable from the agent panel on the main page.
        </p>
        <ol className="mt-2 flex flex-col gap-2">
          {PROMPTS.map((entry, index) => (
            <PromptCard key={entry.prompt} index={index + 1} {...entry} />
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          Two more worth a minute: switch the contractor in the header to{" "}
          <strong>Malerei Brandt &amp; Sohn</strong> or <strong>Colorpoint</strong> and open
          T-2026-015 — the same bill of quantities leaves a different number of gaps for each
          firm, which nothing hard-coded could do. Then switch the role to{" "}
          <strong>Client</strong>: five different tools, and the bids on the open tender are
          sealed — a count and arrival times, no prices.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">What you are trusting</h2>
        <p className="mt-1 text-sm text-slate-700">
          There is no sign-in. Every visitor gets their own workspace with a private copy of
          the demo data, kept in your browser&apos;s local storage and swept after seven days,
          so nothing you do here reaches anyone else. Switching role or contractor is a demo
          mechanism, not an authorisation model: the two roles are separated by which tools
          are registered, not by rights. Every company, project and price in here is invented.
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
  const [copied, setCopied] = useState(false);

  return (
    <li className="rounded border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <span className="text-xs tabular-nums text-slate-400">{index}</span>
        <p className="flex-1 text-sm">{prompt}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
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
      </div>
      <p className="mt-1.5 pl-6 text-xs text-slate-600">{expect}</p>
    </li>
  );
}
