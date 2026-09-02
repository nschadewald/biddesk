import { afterEach, beforeEach, expect, it } from "vitest";
import { logStore } from "./log";
import { getTools, registerToolBlock } from "./registry";
import type { ToolDefinition, WebMCPTool } from "./types";

type Registered = { tool: WebMCPTool; signal?: AbortSignal };

function stubModelContext(where: "document" | "navigator") {
  const seen: Registered[] = [];
  const context = {
    registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }) {
      seen.push({ tool, signal: options?.signal });
      return Promise.resolve();
    }
  };
  Object.defineProperty(where === "document" ? document : navigator, "modelContext", {
    configurable: true,
    value: context
  });
  return seen;
}

function tool(name: string, execute: ToolDefinition["execute"]): ToolDefinition {
  return {
    name,
    title: name,
    description: "test tool",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute
  };
}

// The registry is a module singleton. Every block gets its own controller and
// they are all aborted after each test, which both resets the registry and
// exercises the real withdrawal path.
const controllers: AbortController[] = [];

function newSignal(): AbortSignal {
  const controller = new AbortController();
  controllers.push(controller);
  return controller.signal;
}

beforeEach(() => {
  logStore.clear();
});

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.abort();
  Reflect.deleteProperty(document, "modelContext");
  Reflect.deleteProperty(navigator, "modelContext");
});

it("reports no support, without throwing, when the browser has no model context", async () => {
  const result = await registerToolBlock([tool("noop", async () => ({ ok: true }))], newSignal());
  expect(result).toEqual({ source: "none", supported: false, registered: [], error: null });
  expect(getTools()).toHaveLength(0);
});

it("prefers document.modelContext", async () => {
  const seen = stubModelContext("document");
  const result = await registerToolBlock(
    [tool("list_tenders", async () => ({ ok: true }))],
    newSignal()
  );
  expect(result.source).toBe("document");
  expect(seen.map((item) => item.tool.name)).toEqual(["list_tenders"]);
});

it("falls back to navigator.modelContext", async () => {
  const seen = stubModelContext("navigator");
  const result = await registerToolBlock(
    [tool("list_tenders", async () => ({ ok: true }))],
    newSignal()
  );
  expect(result.source).toBe("navigator");
  expect(seen).toHaveLength(1);
});

it("turns a thrown error into a result object and never rethrows", async () => {
  const seen = stubModelContext("document");
  await registerToolBlock(
    [
      tool("explodes", async () => {
        throw new Error("database on fire");
      })
    ],
    newSignal()
  );

  const output = await seen[0]!.tool.execute({});

  expect(output).toEqual({ ok: false, error: "tool_failed", hint: "database on fire" });
});

it("logs every call with its read/write marker, duration and outcome", async () => {
  const seen = stubModelContext("document");
  await registerToolBlock(
    [
      tool("get_tender", async () => ({ ok: true, positions: [1, 2, 3] })),
      {
        ...tool("set_unit_price", async () => ({ ok: false, error: "sealed", hint: "no" })),
        annotations: { readOnlyHint: false }
      }
    ],
    newSignal()
  );

  await seen[0]!.tool.execute({ tender_id: "T-2026-014" });
  await seen[1]!.tool.execute({});

  const [write, read] = logStore.getSnapshot();
  expect(read?.tool).toBe("get_tender");
  expect(read?.access).toBe("read");
  expect(read?.outcome).toBe("ok");
  expect(read?.outputSummary).toBe("3 positions");
  expect(read?.duration_ms).toBeGreaterThanOrEqual(0);

  // Failures stay visible: a log that only shows successes is advertising.
  expect(write?.access).toBe("write");
  expect(write?.outcome).toBe("error");
  expect(write?.outputSummary).toBe("error: sealed");
});

it("keeps the other tools when the browser refuses one of them", async () => {
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: (tool: WebMCPTool) =>
        tool.name === "bad" ? Promise.reject(new Error("refused")) : Promise.resolve()
    }
  });

  const result = await registerToolBlock(
    [
      tool("good", async () => ({ ok: true })),
      tool("bad", async () => ({ ok: true })),
      tool("also_good", async () => ({ ok: true }))
    ],
    newSignal()
  );

  expect(result.registered).toEqual(["good", "also_good"]);
  expect(result.error).toContain("bad");
  expect(getTools().map((entry) => entry.name)).toEqual(["good", "also_good"]);
});

it("caps foreign text in the log for a tool that declares untrustedContentHint", async () => {
  const seen = stubModelContext("document");
  const long = "z".repeat(400);
  await registerToolBlock(
    [
      {
        ...tool("list_clarifications", async () => ({ ok: true, questions: [{ question: long }] })),
        annotations: { readOnlyHint: true, untrustedContentHint: true }
      }
    ],
    newSignal()
  );

  await seen[0]!.tool.execute({});
  const entry = logStore.getSnapshot()[0]!;

  expect(entry.untrusted).toBe(true);
  // Not even the expanded JSON carries the full text.
  expect(JSON.stringify(entry.output)).not.toContain("z".repeat(200));
});

it("does not log a request for confirmation as a failure", async () => {
  const seen = stubModelContext("document");
  await registerToolBlock(
    [
      {
        ...tool("submit_bid", async () => ({
          ok: false,
          needs_confirmation: true,
          summary: { total_net: 13213.5 }
        })),
        annotations: { readOnlyHint: false, destructiveHint: true }
      }
    ],
    newSignal()
  );

  await seen[0]!.tool.execute({ tender_id: "T-2026-014", confirm: false });
  const entry = logStore.getSnapshot()[0]!;

  // submit_bid with confirm:false did exactly what it should. Calling that a
  // failure would make the safest path through the application look broken.
  expect(entry.outcome).toBe("needs_confirmation");
  expect(entry.outputSummary).toBe("waiting for a person · 13213.5 EUR net");
  expect(entry.outputSummary).not.toContain("error");
});

it("names a failure that arrived without a reason instead of calling it unknown", async () => {
  const seen = stubModelContext("document");
  await registerToolBlock([tool("odd", async () => ({ ok: false }))], newSignal());

  await seen[0]!.tool.execute({});
  expect(logStore.getSnapshot()[0]!.outputSummary).toBe("error: no reason given");
});

it("withdraws the whole block when its controller aborts", async () => {
  stubModelContext("document");
  const controller = new AbortController();
  await registerToolBlock(
    [tool("a", async () => ({ ok: true })), tool("b", async () => ({ ok: true }))],
    controller.signal
  );
  expect(getTools().map((entry) => entry.name)).toEqual(["a", "b"]);

  controller.abort();
  expect(getTools()).toHaveLength(0);
});

it("counts a block only once when React registers it twice", async () => {
  stubModelContext("document");
  const definitions = [tool("a", async () => ({ ok: true }))];
  await registerToolBlock(definitions, newSignal());
  await registerToolBlock(definitions, newSignal());
  expect(getTools()).toHaveLength(1);
});

it("lists a tool declared by a form beside the registered ones", async () => {
  const { declareFormTool } = await import("./registry");
  // jsdom has no declarative form API, so stand one in: a form is a tool only
  // where the browser makes it one.
  Object.defineProperty(SubmitEvent.prototype, "respondWith", {
    configurable: true,
    value: () => undefined
  });
  stubModelContext("document");
  await registerToolBlock([tool("get_tender", async () => ({ ok: true }))], newSignal());
  const undeclare = declareFormTool({
    name: "ask_clarification",
    title: "Ask the client",
    readOnly: false
  });

  const listed = getTools();
  expect(listed.map((entry) => entry.name)).toEqual(["get_tender", "ask_clarification"]);
  expect(listed.find((entry) => entry.name === "ask_clarification")?.kind).toBe("declarative");
  expect(listed.find((entry) => entry.name === "get_tender")?.kind).toBe("imperative");
  // Listed, but this stub browser cannot list its tools, so it cannot vouch for
  // the form: shown, and not counted.
  await Promise.resolve();
  expect(getTools().find((entry) => entry.name === "ask_clarification")?.confirmed).toBe(false);
  expect(getTools().find((entry) => entry.name === "get_tender")?.confirmed).toBe(true);

  undeclare();
  expect(getTools().map((entry) => entry.name)).toEqual(["get_tender"]);
  Reflect.deleteProperty(SubmitEvent.prototype, "respondWith");
});

it("does not list a form as a tool in a browser that cannot declare one", async () => {
  const { declareFormTool, supportsDeclarativeTools } = await import("./registry");
  expect(supportsDeclarativeTools()).toBe(false);

  stubModelContext("document");
  await registerToolBlock([tool("get_tender", async () => ({ ok: true }))], newSignal());
  declareFormTool({ name: "ask_clarification", title: "Ask", readOnly: false });

  // Counting it would claim a tool the browser never created.
  expect(getTools().map((entry) => entry.name)).toEqual(["get_tender"]);
});

it("reports the time a person took separately from the tool's own time", async () => {
  const { recordHumanWait } = await import("./log");
  const seen = stubModelContext("document");
  await registerToolBlock(
    [
      tool("submit_bid", async () => {
        recordHumanWait(4200);
        return { ok: true };
      })
    ],
    newSignal()
  );

  await seen[0]!.tool.execute({});
  const entry = logStore.getSnapshot()[0]!;

  expect(entry.waited_for_human_ms).toBe(4200);
  // Waiting for a person is not the application being slow.
  expect(entry.duration_ms).toBeLessThan(4200);
});

it("trusts the browser's own getTools over our bookkeeping", async () => {
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: () => Promise.resolve(),
      // The browser confirms only one of the two.
      getTools: () => [{ name: "a" }]
    }
  });

  await registerToolBlock(
    [tool("a", async () => ({ ok: true })), tool("b", async () => ({ ok: true }))],
    newSignal()
  );

  // Both are shown -- b was registered, after all -- but only a is vouched for.
  expect(getTools().map((entry) => [entry.name, entry.confirmed])).toEqual([
    ["a", true],
    ["b", false]
  ]);
});

it("awaits a getTools that answers with a Promise, as Chrome 152 does", async () => {
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: () => Promise.resolve(),
      // Not an array: a Promise of one. Array.isArray on this was the old
      // mistake, and it silently fell back to our own bookkeeping.
      getTools: () => Promise.resolve([{ name: "a" }, { name: "from_elsewhere" }])
    }
  });

  await registerToolBlock([tool("a", async () => ({ ok: true }))], newSignal());

  expect(getTools().map((entry) => [entry.name, entry.confirmed])).toEqual([
    ["a", true],
    // Listed by the browser though never offered by us: real to an agent, so
    // real to the count.
    ["from_elsewhere", true]
  ]);
});
