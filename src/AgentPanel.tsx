import { useEffect, useState, useSyncExternalStore } from "react";
import { logStore } from "./webmcp/log";
import type { ListedTool } from "./webmcp/registry";
import type { LogEntry } from "./webmcp/types";
import type { WebMCPStatus } from "./webmcp/useWebMCP";

/**
 * The five prompts of the demo run (spec section 12.1). They are the smoke
 * test, the eval cases and the video script at the same time, so they live here
 * in the wording the jury is meant to type.
 */
const EXAMPLE_PROMPTS = [
  "Open tender T-2026-014 and price every position from my price book. Leave anything without a match empty and tell me which ones.",
  "Why is there no price for the radiators?",
  "Run a check on my bid — anything that looks off?",
  "Ask the client whether the scaffolding from the roofing works will still be in place.",
  "Submit the bid."
];

type Props = {
  webmcp: WebMCPStatus;
  onReset: () => void;
  resetting: boolean;
};

/** True on a viewport wide enough for two columns. */
function useWideViewport(): boolean {
  const [wide, setWide] = useState(() => {
    try {
      return window.matchMedia("(min-width: 1024px)").matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia("(min-width: 1024px)");
    } catch {
      return;
    }
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return wide;
}

export default function AgentPanel({ webmcp, onReset, resetting }: Props) {
  const entries = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot, logStore.getSnapshot);
  const wide = useWideViewport();
  const [open, setOpen] = useState<boolean | null>(null);
  // Open where there is room for it, folded away where there is not -- until
  // somebody decides otherwise, and then their decision holds.
  const isOpen = open ?? wide;

  if (!isOpen) {
    return (
      // Folded, but never silent: the self-diagnosis is the entry aid, and a
      // visitor who cannot see it has no way of telling a browser without
      // WebMCP from a page that does nothing. order-first below the breakpoint,
      // because stacked under a fourteen-row table it would be off-screen on
      // arrival.
      <aside className="order-first border-b border-slate-200 px-5 py-3 text-sm lg:order-none lg:w-14 lg:border-b-0 lg:border-l lg:px-3">
        <div className="flex items-center gap-3 lg:flex-col lg:items-stretch">
          <div className="min-w-0 flex-1">
            <SelfDiagnosis webmcp={webmcp} compact />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            Agent panel
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="order-first flex w-full shrink-0 flex-col gap-4 border-b border-slate-200 px-5 py-6 text-sm lg:order-none lg:w-80 lg:border-b-0 lg:border-l">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Agent panel
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-400 hover:text-slate-900"
        >
          Hide
        </button>
      </div>

      <SelfDiagnosis webmcp={webmcp} />

      <section>
        <h3 className="text-xs font-medium text-slate-500">Try these</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <PromptRow key={prompt} prompt={prompt} />
          ))}
        </ul>
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-medium text-slate-500">Live log</h3>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => logStore.clear()}
              className="text-xs text-slate-400 hover:text-slate-900"
            >
              Clear
            </button>
          )}
        </div>

        <ol className="mt-2 flex flex-col gap-1 overflow-y-auto">
          {entries.length === 0 ? (
            <li className="py-2 text-xs text-slate-400">tool calls appear here</li>
          ) : (
            entries.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </ol>

        <p className="mt-3 text-xs text-slate-400">
          This log stays in your browser. Nothing is sent anywhere.
        </p>
      </section>

      <button
        type="button"
        onClick={onReset}
        disabled={resetting}
        className="self-start rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
      >
        {resetting ? "Resetting…" : "Reset demo"}
      </button>
    </aside>
  );
}

function SelfDiagnosis({ webmcp, compact = false }: { webmcp: WebMCPStatus; compact?: boolean }) {
  // The count is read from the registry at runtime, never written down here:
  // a hard-wired number is wrong the first time a tool is withdrawn.
  const count = webmcp.tools.length;

  if (webmcp.supported && webmcp.error === null) {
    return (
      <section className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
        <p className="text-xs font-medium text-emerald-900">
          WebMCP detected · {count} {count === 1 ? "tool" : "tools"} registered
        </p>
        {!compact && <ToolNames tools={webmcp.tools} />}
      </section>
    );
  }

  if (compact) {
    return (
      <section className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
        <p className="text-xs font-medium text-slate-900">
          WebMCP not available in this browser
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          Open the panel, or see{" "}
          <a className="underline" href="/how-to-test">
            how to test
          </a>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-900">WebMCP not available in this browser</p>
      {webmcp.error && <p className="mt-1 text-xs text-slate-600">{webmcp.error}</p>}
      <p className="mt-1.5 text-xs text-slate-600">Two ways to get it:</p>
      <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
        <li>Open this page in the ChatGPT desktop app browser.</li>
        <li>
          Or use Chrome and switch on{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700">
            chrome://flags/#enable-webmcp-testing
          </code>
          , then reload.
        </li>
      </ul>
      <p className="mt-1.5 text-xs text-slate-500">
        Everything on this page stays readable without WebMCP. Only the tools are missing.
      </p>
    </section>
  );
}

function ToolNames({ tools }: { tools: ListedTool[] }) {
  if (tools.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {tools.map((tool) => (
        <li
          key={tool.name}
          className="rounded border border-emerald-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-emerald-900"
          title={tool.title}
        >
          {tool.name}
          {tool.readOnly && (
            <span className="ml-1 font-sans text-[10px] uppercase text-emerald-700">read</span>
          )}
          {tool.kind === "declarative" && (
            // Declared by a form in the page rather than by a registration
            // call. Both API styles, side by side, in the same list.
            <span className="ml-1 font-sans text-[10px] uppercase text-emerald-700">form</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PromptRow({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard access can be refused. The text is selectable either way.
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={copy}
        className="w-full rounded border border-slate-200 px-2 py-1.5 text-left text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
      >
        {copied ? "Copied" : prompt}
      </button>
    </li>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="border-b border-slate-100 pb-1">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-baseline gap-2 py-1 text-left text-xs"
      >
        <span className="font-mono text-[11px] text-slate-400">{entry.time}</span>
        <span className="font-mono text-[11px] text-slate-900">{entry.tool}</span>
        {entry.outcome !== "ok" && (
          // Not red. Red belongs to the check result alone, and it only keeps
          // its meaning there because it appears nowhere else. The outcome is
          // stated in words, and the reason stands in the output line.
          <span className="rounded border border-slate-300 px-1 text-[10px] uppercase text-slate-600">
            {entry.outcome === "needs_confirmation" ? "awaiting confirmation" : "failed"}
          </span>
        )}
        <span className="rounded border border-slate-200 px-1 text-[10px] uppercase text-slate-500">
          {entry.access}
        </span>
        {entry.untrusted && (
          // Returns text written by other parties. Capped at 120 characters
          // before it was stored, and printed, never rendered as markup.
          <span className="rounded border border-slate-200 px-1 text-[10px] uppercase text-slate-500">
            untrusted content
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-slate-400">
          {entry.duration_ms} ms
          {entry.waited_for_human_ms > 0 && (
            // Kept apart from the tool's own time: waiting for a person is not
            // the application being slow, it is the application being careful.
            <span className="ml-1 text-slate-500">
              + {(entry.waited_for_human_ms / 1000).toFixed(1)} s waiting for a person
            </span>
          )}
        </span>
      </button>
      <p className="pl-1 text-[11px] text-slate-500">
        <span className="text-slate-400">in </span>
        {entry.inputSummary}
      </p>
      <p className="pl-1 text-[11px] text-slate-500">
        <span className="text-slate-400">out </span>
        {entry.outputSummary}
      </p>
      {expanded && (
        // Text from other parties is data. It is printed, never interpreted:
        // React escapes it and no branch of this panel renders HTML.
        <pre className="mt-1 max-h-56 overflow-auto rounded bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-700">
          {JSON.stringify({ input: entry.input, output: entry.output }, null, 2)}
        </pre>
      )}
    </li>
  );
}
