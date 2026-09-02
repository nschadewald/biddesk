import type { LogEntry } from "./types";

/**
 * The live log. A ring buffer of 100, so a long session cannot fill memory.
 *
 * What it shows on purpose: failed calls, rejected rows and error objects. A
 * log that only shows successes is advertising, not evidence.
 *
 * What it deliberately shortens: bulk payloads are summarised rather than
 * poured out, and text written by other parties is truncated and never
 * rendered as HTML. React escapes by construction; the truncation is what
 * keeps the log readable.
 *
 * It survives a reload. A tester read an empty log after F5 as "my history is
 * gone" while every price was still there, and that reading is fair: the log
 * is the evidence of what the agent did. So it lives in localStorage, keyed by
 * workspace, the same ring of 100. "This log stays in your browser. Nothing is
 * sent anywhere." stays literally true -- it just also stays.
 */
const CAPACITY = 100;
const FOREIGN_TEXT_LIMIT = 120;
const STORAGE_PREFIX = "biddesk.log.";

let entries: LogEntry[] = [];
let nextId = 1;
/** The localStorage key of the workspace this log belongs to, once known. */
let boundKey: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  if (boundKey === null) return;
  try {
    if (entries.length === 0) {
      localStorage.removeItem(boundKey);
      return;
    }
    localStorage.setItem(boundKey, JSON.stringify(entries));
  } catch {
    // Quota, a private window, a browser that refuses storage: the log lives on
    // in memory for this page view, which is what it always did.
  }
}

/** Enough of the shape to be sure a stored row is one of ours and not damage. */
function isLogEntry(value: unknown): value is LogEntry {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "number" &&
    typeof row.time === "string" &&
    typeof row.tool === "string" &&
    (row.access === "read" || row.access === "write") &&
    typeof row.duration_ms === "number" &&
    typeof row.outcome === "string"
  );
}

function restore(key: string): LogEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLogEntry).slice(0, CAPACITY) : [];
  } catch {
    // Damaged or unreadable: start empty rather than refuse to start.
    return [];
  }
}

/**
 * Ties the log to a workspace. What that workspace's log held comes back;
 * everything appended from here on is kept under its key. Called by the store
 * whenever the workspace id changes -- on boot, and again if a swept-up
 * workspace was silently replaced. Entries already in memory are kept on top:
 * they happened in this session, whichever workspace they were made in.
 */
export function bindLogToWorkspace(workspaceId: string | null): void {
  const key = workspaceId === null ? null : `${STORAGE_PREFIX}${workspaceId}`;
  if (key === boundKey) return;
  boundKey = key;
  const merged = [...entries, ...(key === null ? [] : restore(key))].slice(0, CAPACITY);
  // Ids are React keys and nothing more; renumber so two sources cannot clash.
  entries = merged.map((entry, index) => ({ ...entry, id: merged.length - index }));
  nextId = merged.length + 1;
  persist();
  emit();
}

export const logStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): LogEntry[] {
    return entries;
  },
  /** Empties the log, in storage too. A reset must look like a first visit. */
  clear() {
    if (entries.length === 0) {
      persist();
      return;
    }
    entries = [];
    persist();
    emit();
  }
};

export function appendLogEntry(entry: Omit<LogEntry, "id">): LogEntry {
  const stored: LogEntry = { ...entry, id: nextId++ };
  // Newest first: the last thing an agent did is the thing a juror looks for.
  entries = [stored, ...entries].slice(0, CAPACITY);
  persist();
  emit();
  return stored;
}

/**
 * Time a tool spent waiting for a person, kept apart from the time it spent
 * working. `submit_bid` sits in the dialog until somebody decides, and a log
 * that folded that into "duration" would make the application look slow when it
 * was in fact being careful.
 */
let humanWait = 0;

export function recordHumanWait(ms: number) {
  humanWait += ms;
}

export function takeHumanWait(): number {
  const waited = humanWait;
  humanWait = 0;
  return waited;
}

export function formatClockTime(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

/** Free text from another party, cut to a length the log can carry. */
export function truncateForeignText(text: string): string {
  return text.length <= FOREIGN_TEXT_LIMIT
    ? text
    : `${text.slice(0, FOREIGN_TEXT_LIMIT)}…`;
}

/**
 * Caps every string in a structure. Applied to what an untrusted tool returns
 * BEFORE it is stored, so nothing longer than 120 characters of other people's
 * text ever reaches the panel, not even behind the expander.
 */
export function capStrings(value: unknown): unknown {
  if (typeof value === "string") return truncateForeignText(value);
  if (Array.isArray(value)) return value.map(capStrings);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        capStrings(entry)
      ])
    );
  }
  return value;
}

export function summariseInput(input: unknown): string {
  if (input === undefined || input === null) return "{}";
  if (typeof input !== "object") return truncateForeignText(String(input));

  const parts = Object.entries(input as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (typeof value === "string") return `${key}: ${truncateForeignText(value)}`;
      if (Array.isArray(value)) return `${key}: ${value.length} items`;
      return `${key}: ${JSON.stringify(value)}`;
    });

  return parts.length ? parts.join(" · ") : "{}";
}

/**
 * Bulk results are counted, not listed: `get_price_book` reads as "34 entries",
 * not as 34 rows. Otherwise the log is unreadable and the evidence drowns.
 */
export function summariseOutput(output: unknown): string {
  if (output === null || output === undefined) return "—";
  if (typeof output !== "object") return truncateForeignText(String(output));

  const record = output as Record<string, unknown>;

  // A price proposed without a source is neither written nor refused: it waits
  // on its row for a click. Said as such, apart from applied and rejected.
  if (record.status === "needs_confirmation" && Array.isArray(record.pending)) {
    const parts = [`waiting for a person · ${record.pending.length} to confirm`];
    if (Array.isArray(record.applied) && record.applied.length > 0) {
      parts.push(`${record.applied.length} applied`);
    }
    if (Array.isArray(record.rejected) && record.rejected.length > 0) {
      parts.push(`${record.rejected.length} rejected`);
    }
    return parts.join(" · ");
  }

  // A bid that cannot go out yet is neither written nor refused: the tool
  // names what stands in the way, and the ways out are the check's own.
  if (record.status === "blocked" && Array.isArray(record.blockers)) {
    const kinds = (record.blockers as { kind?: unknown }[])
      .map((blocker) => (typeof blocker.kind === "string" ? blocker.kind : "?"))
      .join(", ");
    return `blocked · ${record.blockers.length} in the way${kinds ? ` · ${kinds}` : ""}`;
  }

  // A tool that asks for a human decision has not failed. It reports what would
  // happen and stops, which is the whole point of the destructive one.
  if (record.needs_confirmation === true || (record.status === "needs_confirmation" && !Array.isArray(record.pending))) {
    const summary = record.summary as { total_net?: unknown } | undefined;
    const total = summary?.total_net;
    return typeof total === "number"
      ? `waiting for a person · ${total} EUR net`
      : "waiting for a person";
  }

  if (record.ok === false) {
    const reason = record.error;
    return `error: ${typeof reason === "string" && reason.length > 0 ? reason : "no reason given"}`;
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === "ok") continue;
    if (Array.isArray(value)) {
      parts.push(`${value.length} ${key}`);
    } else if (value !== null && typeof value === "object") {
      const id = (value as Record<string, unknown>).id;
      parts.push(id === undefined ? key : `${key} ${String(id)}`);
    } else if (typeof value === "string") {
      parts.push(`${key}: ${truncateForeignText(value)}`);
    } else if (value !== null) {
      parts.push(`${key}: ${String(value)}`);
    }
  }

  return parts.length ? parts.slice(0, 4).join(" · ") : "ok";
}
