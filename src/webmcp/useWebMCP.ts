import { useEffect, useState, useSyncExternalStore } from "react";
import type { Role } from "../types";
import {
  browserToolNames,
  getTools,
  registerToolBlock,
  registryStore,
  supportsDeclarativeTools,
  type ListedTool
} from "./registry";
import {
  askClarificationFallback,
  bidderOnlyTools,
  clientTools,
  sharedTools,
  submitTools
} from "./tools";
import type { ModelContextSource, ToolDefinition } from "./types";

/**
 * Which block belongs to which role. Roles are separated by what is registered,
 * not by permissions: in the bidder role the client tools do not exist at all,
 * so there is nothing for an agent to reach past.
 */
function toolsForRole(role: Role): ToolDefinition[] {
  return role === "bidder"
    ? [...sharedTools, ...bidderOnlyTools]
    : [...sharedTools, ...clientTools];
}

export type WebMCPStatus = {
  supported: boolean;
  source: ModelContextSource;
  error: string | null;
  tools: ListedTool[];
};

/**
 * Registers the blocks that belong to the current role and withdraws them again
 * when it changes, which is what makes `toolchange` fire. One AbortController
 * per block is what makes the withdrawal of submit_bid a two-line change rather
 * than a new mechanism.
 */
export function useWebMCP(role: Role, canSubmit: boolean): WebMCPStatus {
  const [state, setState] = useState<{
    supported: boolean;
    source: ModelContextSource;
    error: string | null;
  }>({ supported: false, source: "none", error: null });

  useEffect(() => {
    const controller = new AbortController();

    void registerToolBlock(toolsForRole(role), controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState({ supported: result.supported, source: result.source, error: result.error });
    });

    return () => controller.abort();
  }, [role]);

  // submit_bid rides on its own controller. Once the bid is handed in the
  // controller aborts, the tool is withdrawn, `toolchange` fires and the
  // self-diagnosis counts one fewer -- and a reset brings it straight back.
  useEffect(() => {
    if (role !== "bidder" || !canSubmit) return;
    const controller = new AbortController();
    void registerToolBlock(submitTools, controller.signal);
    return () => controller.abort();
  }, [role, canSubmit]);

  // ask_clarification is declared by the form on the page. The imperative twin
  // is registered ONLY where a form cannot declare a tool, because one name has
  // to mean one tool. The declarative API extends SubmitEvent, so its presence
  // there is the signal; a browser that also lists its tools confirms it.
  useEffect(() => {
    if (role !== "bidder") return;
    const known = browserToolNames();
    const declarativeWorks =
      supportsDeclarativeTools() && (known === null || known.has("ask_clarification"));
    if (declarativeWorks) return;

    const controller = new AbortController();
    void registerToolBlock(askClarificationFallback, controller.signal);
    return () => controller.abort();
  }, [role]);

  // Re-renders whenever a block is registered or withdrawn, so the count in the
  // panel is read from the registry rather than from a literal.
  useSyncExternalStore(registryStore.subscribe, registryStore.getSnapshot, registryStore.getSnapshot);

  return { ...state, tools: getTools() };
}
