import {
  appendLogEntry,
  capStrings,
  formatClockTime,
  summariseInput,
  summariseOutput,
  takeHumanWait
} from "./log";
import { detectModelContext } from "./modelContext";
import type {
  ModelContextSource,
  ToolDefinition,
  ToolFailure,
  ToolResult,
  WebMCPTool
} from "./types";

/**
 * The central wrapper. Everything the page offers an agent goes through here,
 * so four promises hold for every tool without each tool restating them:
 *
 *  - it never throws; a failure comes back as { ok:false, error, hint },
 *  - its result is plain JSON data, never HTML, markdown or instructions,
 *  - the call appears in the live log with timing and outcome, failures too,
 *  - it is registered under an AbortController, so a block of tools can be
 *    withdrawn again (submit_bid after a bid is handed in) and `toolchange`
 *    fires.
 */

export type ListedTool = {
  name: string;
  title: string;
  /** How the page offered it: a registration call, or a form carrying `toolname`. */
  kind: "imperative" | "declarative";
  readOnly: boolean;
  /**
   * Whether the browser vouches for it. Where the browser lists its tools, that
   * list is the truth and a tool is confirmed by being on it. Where it cannot
   * list them, a registration call that resolved counts -- and a form never
   * does on our word alone. The number in the panel is the number of confirmed
   * tools: a form we merely declared is not a tool an agent has.
   */
  confirmed: boolean;
};

/**
 * Where a form-declared tool stands with the browser.
 *
 *   absent       no form declared (or this browser cannot make a tool of one)
 *   pending      declared; waiting for the browser to list it
 *   confirmed    the browser lists it -- the form IS the tool
 *   unconfirmed  the browser did not list it in time, or cannot list at all;
 *                the imperative twin is registered instead
 *
 * ChatGPT's browser is the case this exists for: the Chromium underneath
 * carries the SubmitEvent extension, so a feature test says "declarative
 * works", but the agent layer never lists the form. The page then believed it
 * offered ten tools and the agent saw nine. A feature test proves the DOM API;
 * only the browser's own list proves that an agent can see the tool.
 */
export type FormToolStatus = "absent" | "pending" | "confirmed" | "unconfirmed";

let registered: ToolDefinition[] = [];
/** Tools the page declares through a form carrying `toolname`. */
let declared: Omit<ListedTool, "confirmed">[] = [];
/** What the browser itself lists, or null when it cannot say. */
let browserNames: Set<string> | null = null;
const formStatus = new Map<string, FormToolStatus>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export const registryStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** A counter, not the list: anything that changes what getTools() says bumps it. */
  getSnapshot(): number {
    return version;
  }
};

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value !== null && typeof value === "object" && "then" in value;

/**
 * Asks the browser what it lists, and remembers the answer.
 *
 * getTools() answers with a Promise in Chrome 152 (docs/07), so the list cannot
 * be read at the moment it is needed. It is read here instead, whenever
 * something may have changed it -- a block registered or withdrawn, a form
 * declared, the browser's own toolchange -- and getTools() below reads the
 * remembered copy. A browser without getTools(), or one whose answer is not a
 * list, leaves null: "cannot say" is a state of its own, not an empty list.
 */
export async function refreshBrowserTools(): Promise<void> {
  let next: Set<string> | null = null;
  try {
    const { context } = detectModelContext();
    const raw: unknown = context?.getTools?.();
    const list = isThenable(raw) ? await raw : raw;
    if (Array.isArray(list)) {
      next = new Set(
        list
          .map((tool) => (tool as { name?: unknown } | null)?.name)
          .filter((name): name is string => typeof name === "string")
      );
    }
  } catch {
    next = null;
  }
  browserNames = next;
  reconcileForms();
  emit();
}

/**
 * Moves declared forms out of "pending" on the strength of the browser's list.
 *
 * A name the browser lists while we hold no imperative tool of that name can
 * only be the form: confirmed. A browser that cannot list at all cannot
 * confirm anything: unconfirmed, and the twin takes over. A browser that lists
 * but has not listed the form yet stays pending; the deadline in
 * declareFormTool decides.
 */
function reconcileForms() {
  for (const [name, status] of formStatus) {
    const twinHeld = registered.some((tool) => tool.name === name);
    if (browserNames === null) {
      if (status === "pending") formStatus.set(name, "unconfirmed");
    } else if (browserNames.has(name) && !twinHeld) {
      formStatus.set(name, "confirmed");
    }
  }
}

/** The model context we are listening to, so a replaced one is listened to afresh. */
let listeningTo: unknown = null;

/** Hears the browser's own toolchange, so a late listing still counts. */
function listenToBrowser() {
  const { context } = detectModelContext();
  if (!context || context === listeningTo) return;
  const target = context as unknown as {
    addEventListener?: (type: string, listener: () => void) => void;
  };
  if (typeof target.addEventListener !== "function") return;
  try {
    target.addEventListener("toolchange", () => void refreshBrowserTools());
    listeningTo = context;
  } catch {
    // Then the timed checks in declareFormTool are all there is.
  }
}

export function formToolStatus(name: string): FormToolStatus {
  return formStatus.get(name) ?? "absent";
}

/**
 * The tools the page offers, each with the browser's verdict on it.
 *
 * The self-diagnosis counts the confirmed ones at runtime and never a literal:
 * a hard-wired number is a claim that can go stale, and this one contradicts
 * reality the first time a tool is withdrawn -- or, as it turned out, the
 * first time a browser declines to see a form as a tool.
 */
export function getTools(): ListedTool[] {
  const imperative: ListedTool[] = registered.map((tool) => ({
    name: tool.name,
    title: tool.title,
    kind: "imperative",
    readOnly: tool.annotations.readOnlyHint === true,
    confirmed: browserNames === null ? true : browserNames.has(tool.name)
  }));
  // A form's verdict is the status machine's, never a name lookup: once a twin
  // is registered under the same name, the browser's list can no longer say
  // which of the two it means.
  const forms: ListedTool[] = declared.map((tool) => ({
    ...tool,
    confirmed: formStatus.get(tool.name) === "confirmed"
  }));
  // Whatever the browser lists that we never offered is still real to an agent.
  const known = new Set([...registered, ...declared].map((tool) => tool.name));
  const foreign: ListedTool[] =
    browserNames === null
      ? []
      : [...browserNames]
          .filter((name) => !known.has(name))
          .map((name) => ({ name, title: name, kind: "imperative", readOnly: false, confirmed: true }));
  return [...imperative, ...forms, ...foreign];
}

/**
 * Chrome 152 lists a form's tool roughly 30 ms after the form enters the DOM,
 * and fires toolchange when it does (measured, docs/07). These are the points
 * at which the browser is asked again; after the last one, silence counts as no.
 */
const SETTLE_MS = [150, 300, 600] as const;

/**
 * A form on the page carrying `toolname` MAY be a tool -- it is one where the
 * browser makes it one, and the only proof of that is the browser listing it.
 * Declaring it here starts that wait. Until the browser answers, the form is
 * pending: not counted, and not yet replaced by its imperative twin either,
 * because registering the twin while the browser is about to list the form
 * would collide (Chrome refuses a duplicate name outright).
 */
export function declareFormTool(tool: Omit<ListedTool, "kind" | "confirmed">): () => void {
  // Where the browser cannot make a tool out of a form at all, the markup is
  // just a form and the twin is registered without further ado.
  if (!supportsDeclarativeTools()) return () => undefined;

  declared = [
    ...declared.filter((entry) => entry.name !== tool.name),
    { ...tool, kind: "declarative" }
  ];
  formStatus.set(tool.name, "pending");
  emit();

  listenToBrowser();
  void refreshBrowserTools();
  const timers = SETTLE_MS.map((ms, index) =>
    setTimeout(() => {
      void refreshBrowserTools().then(() => {
        const last = index === SETTLE_MS.length - 1;
        if (last && formStatus.get(tool.name) === "pending") {
          formStatus.set(tool.name, "unconfirmed");
          emit();
        }
      });
    }, ms)
  );

  return () => {
    for (const timer of timers) clearTimeout(timer);
    declared = declared.filter((entry) => entry.name !== tool.name);
    formStatus.delete(tool.name);
    emit();
  };
}

/**
 * Whether this browser understands a form that declares a tool. The declarative
 * API extends SubmitEvent, so its presence there is the honest signal -- more
 * reliable than guessing from getTools(), which not every build exposes.
 */
export function supportsDeclarativeTools(): boolean {
  try {
    return (
      typeof SubmitEvent !== "undefined" &&
      ("respondWith" in SubmitEvent.prototype || "agentInvoked" in SubmitEvent.prototype)
    );
  } catch {
    return false;
  }
}

function toFailure(caught: unknown): ToolFailure {
  if (caught instanceof Error) {
    return {
      ok: false,
      error: "tool_failed",
      // The message, never a stack trace: stacks leak internal paths.
      hint: caught.message
    };
  }
  return { ok: false, error: "tool_failed", hint: "The tool could not complete." };
}

/**
 * Wraps a definition so the promises above hold. The returned object is what
 * the browser sees.
 */
function wrap(definition: ToolDefinition): WebMCPTool {
  const access = definition.annotations.readOnlyHint === true ? "read" : "write";
  const untrusted = definition.annotations.untrustedContentHint === true;

  return {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    annotations: definition.annotations,
    async execute(input: unknown) {
      const startedAt = Date.now();
      takeHumanWait();
      let output: ToolResult;

      try {
        output = await definition.execute(input);
      } catch (caught) {
        output = toFailure(caught) as unknown as ToolResult;
      }

      const waited = takeHumanWait();

      appendLogEntry({
        time: formatClockTime(new Date()),
        tool: definition.name,
        access,
        untrusted,
        duration_ms: Math.max(0, Date.now() - startedAt - waited),
        waited_for_human_ms: waited,
        outcome:
          output?.needs_confirmation === true
            ? "needs_confirmation"
            : output?.ok === false
              ? "error"
              : "ok",
        inputSummary: summariseInput(input),
        outputSummary: summariseOutput(output),
        input,
        // Foreign text is capped before it is stored, never after.
        output: untrusted ? capStrings(output) : output
      });

      return output;
    }
  };
}

export type RegistrationResult = {
  source: ModelContextSource;
  supported: boolean;
  registered: string[];
  error: string | null;
};

/**
 * Registers a block of tools. `signal` withdraws the whole block at once, which
 * is how the role switch and the withdrawal of submit_bid are built.
 */
export async function registerToolBlock(
  requested: ToolDefinition[],
  signal: AbortSignal
): Promise<RegistrationResult> {
  const { context, source } = detectModelContext();

  if (!context) {
    return { source, supported: false, registered: [], error: null };
  }

  let definitions = [...requested];
  let registrationError: string | null = null;
  const wrapped = definitions.map(wrap);
  // Per-tool registration is the current shape; provideContext is the older,
  // page-wide one. Which of the two we used decides how abort undoes it.
  const perTool = typeof context.registerTool === "function";

  try {
    if (perTool) {
      // allSettled, not all: a browser that refuses one tool must not cost us
      // the other nine.
      const outcomes = await Promise.allSettled(
        wrapped.map((tool) => context.registerTool?.(tool, { signal }))
      );
      const refused = outcomes.flatMap((outcome, index) =>
        outcome.status === "rejected" ? [definitions[index]!.name] : []
      );
      if (refused.length > 0) {
        definitions = definitions.filter((tool) => !refused.includes(tool.name));
        registrationError = `The browser refused ${refused.join(", ")}.`;
      }
    } else if (typeof context.provideContext === "function") {
      await context.provideContext({ tools: [...registered.map(wrap), ...wrapped] });
    } else {
      return {
        source,
        supported: false,
        registered: [],
        error: "The browser exposes a model context without a way to register tools."
      };
    }
  } catch (caught) {
    return {
      source,
      supported: true,
      registered: [],
      error: caught instanceof Error ? caught.message : "Tool registration failed."
    };
  }

  if (signal.aborted) {
    return { source, supported: true, registered: [], error: null };
  }

  // Idempotent: React re-runs effects in strict mode, and a block that lands
  // twice must not be counted twice.
  registered = [
    ...registered.filter((tool) => !definitions.some((candidate) => candidate.name === tool.name)),
    ...definitions
  ];
  emit();
  // What the browser lists is the truth for the self-diagnosis; ask it now that
  // it has had the block.
  listenToBrowser();
  await refreshBrowserTools();

  signal.addEventListener(
    "abort",
    () => {
      registered = registered.filter(
        (tool) => !definitions.some((candidate) => candidate.name === tool.name)
      );
      emit();
      // Aborting the signal is what withdraws a per-tool registration. The
      // page-wide one has to be restated with whatever is left.
      if (!perTool) {
        void context.provideContext?.({ tools: registered.map(wrap) });
      }
      void refreshBrowserTools();
    },
    { once: true }
  );

  return {
    source,
    supported: true,
    registered: definitions.map((tool) => tool.name),
    error: registrationError
  };
}
