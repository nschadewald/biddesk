import { useEffect, useState, useSyncExternalStore } from "react";
import type { Role } from "../types";
import { getTools, registerToolBlock, registryStore } from "./registry";
import { bidderReadTools } from "./tools";
import type { ModelContextSource, ToolDefinition } from "./types";

/** Which block belongs to which role. The client block arrives with its tools. */
function toolsForRole(role: Role): ToolDefinition[] {
  return role === "bidder" ? bidderReadTools : [];
}

export type WebMCPStatus = {
  supported: boolean;
  source: ModelContextSource;
  error: string | null;
  tools: ToolDefinition[];
};

/**
 * Registers the block that belongs to the current role, and withdraws it again
 * when the role changes. One AbortController per block is what makes the later
 * withdrawal of submit_bid a two-line change rather than a new mechanism.
 */
export function useWebMCP(role: Role): WebMCPStatus {
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

  // Re-renders whenever a block is registered or withdrawn, so the count in the
  // panel is read from the registry rather than from a literal.
  useSyncExternalStore(registryStore.subscribe, registryStore.getSnapshot, registryStore.getSnapshot);

  return { ...state, tools: getTools() };
}
