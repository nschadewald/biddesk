import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendLogEntry,
  capStrings,
  logStore,
  summariseInput,
  summariseOutput,
  truncateForeignText
} from "./log";

const entry = (tool: string) => ({
  time: "12:00:00",
  tool,
  access: "read" as const,
  untrusted: false,
  duration_ms: 1,
  outcome: "ok" as const,
  inputSummary: "{}",
  outputSummary: "ok",
  input: {},
  output: { ok: true }
});

beforeEach(() => {
  logStore.clear();
});

describe("ring buffer", () => {
  it("keeps the newest 100 entries and drops the rest", () => {
    for (let index = 0; index < 130; index += 1) appendLogEntry(entry(`tool_${index}`));
    const entries = logStore.getSnapshot();
    expect(entries).toHaveLength(100);
    expect(entries[0]?.tool).toBe("tool_129");
    expect(entries.at(-1)?.tool).toBe("tool_30");
  });

  it("notifies subscribers", () => {
    let calls = 0;
    const unsubscribe = logStore.subscribe(() => {
      calls += 1;
    });
    appendLogEntry(entry("list_tenders"));
    unsubscribe();
    appendLogEntry(entry("get_tender"));
    expect(calls).toBe(1);
  });
});

describe("summaries", () => {
  it("counts bulk results instead of pouring them out", () => {
    const entries = Array.from({ length: 34 }, (_, index) => ({ id: index }));
    expect(summariseOutput({ ok: true, entries })).toBe("34 entries");
  });

  it("shows failures rather than hiding them", () => {
    expect(summariseOutput({ ok: false, error: "tender_not_found", hint: "no" })).toBe(
      "error: tender_not_found"
    );
  });

  it("caps every string in what an untrusted tool returned, before it is stored", () => {
    const long = "y".repeat(300);
    const capped = capStrings({
      questions: [{ id: "Q-001", question: long, answer: null, nested: { note: long } }]
    }) as { questions: { question: string; answer: null; nested: { note: string } }[] };

    expect(capped.questions[0]!.question).toHaveLength(121);
    expect(capped.questions[0]!.nested.note).toHaveLength(121);
    expect(capped.questions[0]!.answer).toBeNull();
  });

  it("cuts free text from other parties to 120 characters", () => {
    const long = "x".repeat(500);
    expect(truncateForeignText(long)).toHaveLength(121);
    expect(truncateForeignText(long).endsWith("…")).toBe(true);
  });

  it("describes arguments without dumping them", () => {
    expect(summariseInput({ tender_id: "T-2026-014" })).toBe("tender_id: T-2026-014");
    expect(summariseInput({ prices: [1, 2, 3] })).toBe("prices: 3 items");
    expect(summariseInput(undefined)).toBe("{}");
  });
});

describe("reset", () => {
  it("empties the log, so a second demo run starts like a first visit", async () => {
    appendLogEntry(entry("get_tender"));
    expect(logStore.getSnapshot()).toHaveLength(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        new Response(
          JSON.stringify(
            input === "/api/workspace"
              ? { ok: true, workspace_id: "55555555-5555-4555-8555-555555555555", created: true }
              : {
                  ok: true,
                  bidder_id: "B-A",
                  tender: {
                    id: "T-2026-014",
                    title: "t",
                    title_de: "t",
                    client: "c",
                    city: "c",
                    trade: "painting",
                    status: "open",
                    due_date: "2026-09-10",
                    positions_count: 0,
                    my_bid_status: "none"
                  },
                  positions: [],
                  required_documents: []
                }
          )
        )
      ) as unknown as typeof fetch
    );

    const { resetDemo } = await import("../store");
    await resetDemo();

    expect(logStore.getSnapshot()).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
