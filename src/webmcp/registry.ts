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
  /** How the browser learned about it: a registration call, or a form. */
  kind: "imperative" | "declarative";
  readOnly: boolean;
};

let registered: ToolDefinition[] = [];
/** Tools the page declares through a form carrying `toolname`. */
let declared: ListedTool[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const registryStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): ToolDefinition[] {
    return registered;
  }
};

/**
 * The tools currently registered. The self-diagnosis counts this at runtime and
 * never a literal: a hard-wired number is a claim that can go stale, and this
 * one contradicts reality the first time a tool is withdrawn.
 *
 * The browser is asked first, because its answer is the one that matters. Our
 * own list is the fallback for builds that do not expose getTools().
 */
function listed(): ListedTool[] {
  return [
    ...registered.map((tool) => ({
      name: tool.name,
      title: tool.title,
      kind: "imperative" as const,
      readOnly: tool.annotations.readOnlyHint === true
    })),
    ...declared
  ];
}

/** The names the browser itself reports, or null when it cannot say. */
export function browserToolNames(): Set<string> | null {
  try {
    const { context } = detectModelContext();
    const fromBrowser = context?.getTools?.();
    if (!Array.isArray(fromBrowser)) return null;
    return new Set(
      fromBrowser
        .map((tool) => (tool as { name?: unknown } | null)?.name)
        .filter((name): name is string => typeof name === "string")
    );
  } catch {
    return null;
  }
}

export function getTools(): ListedTool[] {
  const names = browserToolNames();
  const all = listed();
  return names === null ? all : all.filter((tool) => names.has(tool.name));
}

/**
 * A form on the page carrying `toolname` IS a tool, created by the browser from
 * the markup. Registering it here keeps the self-diagnosis honest: it counts
 * what the page offers, whichever of the two API styles offered it.
 */
export function declareFormTool(tool: Omit<ListedTool, "kind">): () => void {
  // Only where the browser turns a form into a tool. Elsewhere the markup is
  // just a form, the imperative twin is registered instead, and counting it
  // here would make the self-diagnosis claim a tool that does not exist.
  if (!supportsDeclarativeTools()) return () => undefined;

  declared = [
    ...declared.filter((entry) => entry.name !== tool.name),
    { ...tool, kind: "declarative" }
  ];
  emit();
  return () => {
    declared = declared.filter((entry) => entry.name !== tool.name);
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
