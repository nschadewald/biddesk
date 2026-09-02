/**
 * The experimental WebMCP surface, as far as this application relies on it.
 * The draft of 21 July 2026 moved the entry point from `navigator` to
 * `document`; Chrome 149-156 serves both, so both are probed.
 */

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  /** Set on anything that returns text written by another party. */
  untrustedContentHint?: boolean;
};

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

/** What a tool hands back. Data only. Never HTML, never markdown, never prose. */
export type ToolResult = Record<string, unknown>;

export type ToolFailure = {
  ok: false;
  error: string;
  hint: string;
};

/** A tool definition as this application writes it, before registration. */
export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
  execute(input: unknown): Promise<ToolResult>;
};

/** The shape handed to the browser. */
export type WebMCPTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
  execute(input: unknown): Promise<unknown>;
};

export type ModelContext = {
  registerTool?(tool: WebMCPTool, options?: { signal?: AbortSignal }): Promise<void> | void;
  provideContext?(context: { tools: WebMCPTool[] }): Promise<void> | void;
  getTools?(): unknown;
};

export type ModelContextSource = "document" | "navigator" | "none";

export type LogEntry = {
  id: number;
  /** Local wall-clock time, HH:MM:SS. */
  time: string;
  tool: string;
  /** Read tools carry readOnlyHint; everything else writes. */
  access: "read" | "write";
  duration_ms: number;
  /** Time the call spent waiting for a person to confirm. Reported apart. */
  waited_for_human_ms: number;
  /**
   * `needs_confirmation` is neither: submit_bid with confirm:false did exactly
   * what it should and is waiting for a person. Logging that as a failure
   * would make the safest path through the application look broken.
   * `blocked` is neither as well: the bid cannot go out yet, the tool said
   * why, and nothing was written -- not a failure, not a write, not a wait.
   */
  outcome: "ok" | "error" | "needs_confirmation" | "blocked";
  /** The tool returns text written by other parties. Capped and labelled. */
  untrusted: boolean;
  inputSummary: string;
  outputSummary: string;
  input: unknown;
  output: unknown;
};
