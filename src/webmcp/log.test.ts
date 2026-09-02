import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendLogEntry,
  bindLogToWorkspace,
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
  waited_for_human_ms: 0,
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

  it("says that a proposal is waiting, apart from applied and rejected", () => {
    // Neither a failure nor a write: a price on its row, waiting for a click.
    expect(
      summariseOutput({ ok: true, status: "needs_confirmation", pending: [{ oz: "03.04" }], applied: [], rejected: [] })
    ).toBe("waiting for a person · 1 to confirm");
    expect(
      summariseOutput({ ok: true, status: "needs_confirmation", pending: [{}], applied: [{}, {}], rejected: [{}] })
    ).toBe("waiting for a person · 1 to confirm · 2 applied · 1 rejected");
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

describe("persistence", () => {
  const WS = "77777777-7777-4777-8777-777777777777";
  const KEY = `biddesk.log.${WS}`;

  beforeEach(() => {
    localStorage.clear();
    bindLogToWorkspace(null);
    logStore.clear();
  });

  it("survives a reload of the page, newest first, same ring of 100", async () => {
    bindLogToWorkspace(WS);
    appendLogEntry(entry("get_tender"));
    appendLogEntry(entry("suggest_prices"));
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toHaveLength(2);

    // A reload is a fresh module with nothing in memory. The store binds the
    // workspace again on boot, and the history is back.
    vi.resetModules();
    const fresh = await import("./log");
    expect(fresh.logStore.getSnapshot()).toHaveLength(0);
    fresh.bindLogToWorkspace(WS);

    expect(fresh.logStore.getSnapshot().map((row) => row.tool)).toEqual([
      "suggest_prices",
      "get_tender"
    ]);
  });

  it("is emptied by a reset, in storage too", () => {
    bindLogToWorkspace(WS);
    appendLogEntry(entry("get_tender"));
    expect(localStorage.getItem(KEY)).not.toBeNull();

    logStore.clear();

    expect(logStore.getSnapshot()).toHaveLength(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the log apart per workspace", () => {
    bindLogToWorkspace(WS);
    appendLogEntry(entry("get_tender"));
    bindLogToWorkspace(null);
    logStore.clear();

    bindLogToWorkspace("88888888-8888-4888-8888-888888888888");
    expect(logStore.getSnapshot()).toHaveLength(0);
    // The first workspace's log is untouched.
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toHaveLength(1);
  });

  it("stores no more than the ring holds", () => {
    bindLogToWorkspace(WS);
    for (let i = 0; i < 130; i++) appendLogEntry(entry(`tool_${i}`));
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toHaveLength(100);
  });

  it("starts empty on damaged storage rather than refusing to start", () => {
    localStorage.setItem(KEY, "this is not json");
    expect(() => bindLogToWorkspace(WS)).not.toThrow();
    expect(logStore.getSnapshot()).toHaveLength(0);

    localStorage.setItem(KEY, JSON.stringify([{ nonsense: true }, entry("get_tender")]));
    bindLogToWorkspace(null);
    bindLogToWorkspace(WS);
    // The row without an id is not one of ours; the shaped one is not either,
    // because a stored entry carries an id. Neither gets in.
    expect(logStore.getSnapshot()).toHaveLength(0);
  });

  it("keeps working in a browser that refuses storage", () => {
    const boom = () => {
      throw new Error("localStorage is disabled");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom, clear: boom });

    expect(() => bindLogToWorkspace(WS)).not.toThrow();
    appendLogEntry(entry("get_tender"));
    expect(logStore.getSnapshot()).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

it("says what is in the way of a blocked bid, and does not call it an error", () => {
  const summary = summariseOutput({
    ok: true,
    status: "blocked",
    blockers: [
      { kind: "open_position", oz: "03.04", text: "Radiators" },
      { kind: "document_expired", doc_type: "tax_clearance", label: "Tax clearance certificate", valid_until: "2026-08-12" }
    ],
    summary: { total_net: 13213.5 }
  });
  expect(summary).toBe("blocked · 2 in the way · open_position, document_expired");
  expect(summary).not.toContain("error");
});

it("reads submit_bid's own request for confirmation as waiting, with the total", () => {
  expect(
    summariseOutput({ ok: true, status: "needs_confirmation", summary: { total_net: 13213.5 } })
  ).toBe("waiting for a person · 13213.5 EUR net");
});
