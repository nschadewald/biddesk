import { useEffect, useState, useSyncExternalStore } from "react";
import type { Role } from "../types";
import {
  formToolStatus,
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

  // Re-renders whenever anything the registry knows changes: a block registered
  // or withdrawn, the browser's list refreshed, a form confirmed or given up on.
  useSyncExternalStore(registryStore.subscribe, registryStore.getSnapshot, registryStore.getSnapshot);
  const form = formToolStatus("ask_clarification");

  // ask_clarification is declared by the form on the page, and the form IS the
  // tool wherever the browser CONFIRMS it by listing it. The imperative twin is
  // registered where the browser cannot make a tool of a form at all, and where
  // it could but did not list this one in time -- ChatGPT's browser carries the
  // SubmitEvent extension underneath yet never lists the form, and a feature
  // test alone had us offering ten tools while the agent saw nine. One name,
  // one tool: while the browser is still deciding, nothing is registered, so
  // the twin can never land beside the form (Chrome refuses the duplicate).
  useEffect(() => {
    if (role !== "bidder") return;
    const twinNeeded = !supportsDeclarativeTools() || form === "unconfirmed";
    if (!twinNeeded) return;

    const controller = new AbortController();
    void registerToolBlock(askClarificationFallback, controller.signal);
    return () => controller.abort();
  }, [role, form]);

  return { ...state, tools: getTools() };
}
