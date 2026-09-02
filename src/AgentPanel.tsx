import { useState, useSyncExternalStore } from "react";
import { useCopy, type Copy } from "./i18n";
import { useAppState } from "./store";
import { logStore } from "./webmcp/log";
import type { ListedTool } from "./webmcp/registry";
import type { LogEntry } from "./webmcp/types";
import type { WebMCPStatus } from "./webmcp/useWebMCP";

/**
 * The agent panel.
 *
 * The frame around the log is read by a person, so it follows the language --
 * including the example prompts, because somebody working in German types in
 * German and the tools do not care which language the sentence arrived in.
 *
 * The log ROWS do not follow the language. They print what a tool was sent and
 * what it answered, down to the badges and the outcome, and that is tool data:
 * an English name, an English reason, an English error object. Translating it
 * would mean the panel no longer shows what actually crossed the boundary.
 *
 * From 1240 px it is a 352 px column on the right, open by default. Below that
 * it is a section above the status bar, opened from there. The status bar
 * carries the self-diagnosis either way, so the count is never out of sight.
 */

type Props = {
  webmcp: WebMCPStatus;
  wide: boolean;
  onHide: () => void;
  onReset: () => void;
  resetting: boolean;
};

/** The count is what the browser confirms, never a literal. */
const confirmedCount = (webmcp: WebMCPStatus) =>
  webmcp.tools.filter((tool) => tool.confirmed).length;

export default function AgentPanel({ webmcp, wide, onHide, onReset, resetting }: Props) {
  const copy = useCopy();
  const entries = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot, logStore.getSnapshot);
  // The prompts, the explainer and the tool count change together with the
  // role: a client is not invited to price anything.
  const { role } = useAppState();
  const prompts = role === "client" ? copy.panel.promptsClient : copy.panel.prompts;
  const roleNote = role === "client" ? copy.panel.roleNoteClient : copy.panel.roleNoteBidder;

  return (
    <aside
      className={
        wide
          ? "flex w-[352px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line px-5 py-5 text-sm"
          : "flex max-h-[50vh] shrink-0 flex-col gap-5 overflow-y-auto border-t border-line px-5 py-5 text-sm"
      }
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium text-navy">{copy.panel.title}</h2>
        <button type="button" onClick={onHide} className="text-xs text-ink-muted hover:text-ink">
          {copy.panel.hide}
        </button>
      </div>

      <SelfDiagnosis webmcp={webmcp} copy={copy} />

      <section>
        <h3 className="eyebrow">{copy.panel.tryThese}</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {prompts.map((prompt) => (
            <PromptRow key={prompt} prompt={prompt} copiedLabel={copy.panel.copied} />
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-subtle">{roleNote}</p>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex items-baseline justify-between">
          <h3 className="eyebrow">{copy.panel.liveLog}</h3>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => logStore.clear()}
              className="text-xs text-ink-muted hover:text-ink"
            >
              {copy.panel.clear}
            </button>
          )}
        </div>

        <ol className="mt-1 flex flex-col">
          {entries.length === 0 ? (
            <li className="py-2 text-xs text-ink-subtle">{copy.panel.logEmpty}</li>
          ) : (
            entries.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </ol>

        <p className="mt-3 text-xs text-ink-subtle">{copy.panel.logStaysHere}</p>
      </section>

      <button
        type="button"
        onClick={onReset}
        disabled={resetting}
        className="btn-ghost btn-sm self-start"
      >
        {resetting ? copy.panel.resetting : copy.panel.reset}
      </button>
    </aside>
  );
}

/**
 * The status bar: the self-diagnosis, the last thing the agent did, and the
 * way to the panel. Always on screen, 44 px, below everything else.
 */
export function StatusBar({
  webmcp,
  open,
  onToggle
}: {
  webmcp: WebMCPStatus;
  open: boolean;
  onToggle: () => void;
}) {
  const copy = useCopy();
  const entries = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot, logStore.getSnapshot);
  const last = entries[0];
  const detected = webmcp.supported && webmcp.error === null;

  return (
    <footer className="flex h-11 shrink-0 items-center gap-4 border-t border-line bg-white px-6 text-xs">
      <span className="flex items-center gap-2 whitespace-nowrap text-ink">
        <span
          aria-hidden="true"
          className={detected ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-ink-subtle"}
        />
        {detected ? copy.panel.detected(confirmedCount(webmcp)) : copy.panel.notAvailable}
      </span>
      {last && (
        <span className="hidden min-w-0 flex-1 truncate font-mono text-[11px] text-ink-subtle md:inline">
          {last.time} {last.tool} · {last.outputSummary}
        </span>
      )}
      <button type="button" onClick={onToggle} className="btn-ghost btn-sm ml-auto">
        {open ? copy.panel.hide : copy.panel.show}
      </button>
    </footer>
  );
}

function SelfDiagnosis({ webmcp, copy }: { webmcp: WebMCPStatus; copy: Copy }) {
  // The count is read from the registry at runtime, never written down here:
  // a hard-wired number is wrong the first time a tool is withdrawn. And it is
  // the count of what the BROWSER confirms -- a form we declared but the browser
  // never listed is shown below, marked, and left out of the number.
  const count = confirmedCount(webmcp);

  if (webmcp.supported && webmcp.error === null) {
    return (
      <section>
        <p className="flex items-center gap-2 text-sm text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
          {copy.panel.detected(count)}
        </p>
        <ToolNames tools={webmcp.tools} copy={copy} />
      </section>
    );
  }

  return (
    <section className="card bg-elev px-3 py-2">
      <p className="text-sm text-ink">{copy.panel.notAvailable}</p>
      {webmcp.error && <p className="mt-1 text-xs text-ink-muted">{webmcp.error}</p>}
      <p className="mt-1.5 text-xs text-ink-muted">{copy.panel.twoWays}</p>
      <ul className="mt-1 list-disc pl-4 text-xs text-ink-muted">
        <li>{copy.panel.wayChatGpt}</li>
        <li>
          {copy.panel.wayChromeBefore}{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] text-ink">
            chrome://flags/#enable-webmcp-testing
          </code>
          {copy.panel.wayChromeAfter}
        </li>
      </ul>
      <p className="mt-1.5 text-xs text-ink-subtle">{copy.panel.readableWithout}</p>
    </section>
  );
}

function ToolNames({ tools, copy }: { tools: ListedTool[]; copy: Copy }) {
  if (tools.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {tools.map((tool) => (
        <li
          key={`${tool.kind}:${tool.name}`}
          className={
            tool.confirmed
              ? "rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink"
              : "rounded-md border border-dashed border-line-strong bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
          }
          title={tool.title}
        >
          {tool.name}
          {tool.readOnly && (
            <span className="ml-1 font-sans text-[10px] uppercase text-ink-subtle">
              {copy.panel.badgeRead}
            </span>
          )}
          {tool.kind === "declarative" && tool.confirmed && (
            // Declared by a form in the page rather than by a registration
            // call, and the browser lists it. Both API styles, side by side.
            <span className="ml-1 font-sans text-[10px] uppercase text-ink-subtle">
              {copy.panel.badgeForm}
            </span>
          )}
          {!tool.confirmed && (
            // Offered by the page, not vouched for by this browser. Said in
            // words and kept out of the number above.
            <span className="ml-1 font-sans text-[10px] text-ink-muted">
              {tool.kind === "declarative"
                ? copy.panel.badgeUnconfirmedForm
                : copy.panel.badgeUnconfirmed}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The sentence is the button: a click copies it, and says so for a moment. */
function PromptRow({ prompt, copiedLabel }: { prompt: string; copiedLabel: string }) {
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
        className="w-full rounded-md border border-line px-3 py-2 text-left text-xs leading-relaxed text-ink hover:border-line-strong hover:bg-elev"
      >
        {copied ? copiedLabel : prompt}
      </button>
    </li>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  // A request for a person's click is the most important line the product
  // writes; it is the one line set in navy. Blocked and failed are stated in
  // words, in the same quiet badge as read and write: not red -- red belongs
  // to the check result alone, and it keeps its meaning there only because it
  // appears nowhere else.
  const waiting = entry.outcome === "needs_confirmation";

  return (
    <li className="border-b border-line py-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left"
      >
        <span className="font-mono text-xs text-ink">{entry.tool}</span>
        {waiting ? (
          <span className="badge badge-navy">awaiting confirmation</span>
        ) : entry.outcome === "ok" ? (
          <span className="badge">{entry.access}</span>
        ) : (
          <span className="badge">{entry.outcome === "blocked" ? "blocked" : "failed"}</span>
        )}
        {entry.untrusted && (
          // Returns text written by other parties. Capped at 120 characters
          // before it was stored, and printed, never rendered as markup.
          <span className="badge">untrusted content</span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-subtle">
          {entry.time} · {entry.duration_ms} ms
          {entry.waited_for_human_ms > 0 && (
            // Kept apart from the tool's own time: waiting for a person is not
            // the application being slow, it is the application being careful.
            <span> + {(entry.waited_for_human_ms / 1000).toFixed(1)} s waiting for a person</span>
          )}
        </span>
      </button>
      <p className="text-xs text-ink-muted">
        <span className="text-ink-subtle">in </span>
        {entry.inputSummary}
      </p>
      <p className={waiting ? "text-xs font-medium text-ink" : "text-xs text-ink-muted"}>
        <span className="font-normal text-ink-subtle">out </span>
        {entry.outputSummary}
      </p>
      {expanded && (
        // Text from other parties is data. It is printed, never interpreted:
        // React escapes it and no branch of this panel renders HTML.
        <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-elev p-2 font-mono text-[10px] leading-relaxed text-ink">
          {JSON.stringify({ input: entry.input, output: entry.output }, null, 2)}
        </pre>
      )}
    </li>
  );
}
