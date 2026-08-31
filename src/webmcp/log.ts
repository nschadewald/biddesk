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
 */
const CAPACITY = 100;
const FOREIGN_TEXT_LIMIT = 120;

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
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
  clear() {
    if (entries.length === 0) return;
    entries = [];
    emit();
  }
};

export function appendLogEntry(entry: Omit<LogEntry, "id">): LogEntry {
  const stored: LogEntry = { ...entry, id: nextId++ };
  // Newest first: the last thing an agent did is the thing a juror looks for.
  entries = [stored, ...entries].slice(0, CAPACITY);
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

  if (record.ok === false) {
    return `error: ${String(record.error ?? "unknown")}`;
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
