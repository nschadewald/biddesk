import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bidderDetail,
  confirmDocumentValidity,
  confirmPendingPrice,
  discardPendingPrice,
  proposeDocumentValidity,
  getAppState,
  openTender,
  proposePrices,
  readTenders,
  runCheck,
  selectLanguage,
  selectRole,
  setUnitPrices
} from "./store";
import type { AppliedPrice, SuggestionSource } from "./types";

const WS = "66666666-6666-4666-8666-666666666666";

const SOURCE: SuggestionSource = {
  price_book_id: "PB-A-004",
  source_project: "Luegallee 40",
  source_date: "2026-03-14",
  source_position_text: "Grundierung Wandflächen"
};

const position = (oz: string, quantity: number, contingency = false) => ({
  oz,
  text: oz,
  long_text: null,
  quantity,
  unit: "m2",
  category: "wall",
  contingency,
  my_unit_price: null,
  line_total: null,
  set_by: null,
  source: null
});

const detail = {
  ok: true,
  role: "bidder",
  bidder_id: "B-A",
  tender: {
    id: "T-2026-014",
    title: "t",
    client: "c",
    city: "c",
    trade: "painting",
    status: "open",
    due_date: "2026-09-10",
    positions_count: 3,
    my_bid_status: "none"
  },
  positions: [position("01.01", 10), position("02.01", 100), position("04.01", 20, true)],
  required_documents: [
    { doc_type: "tax_clearance", label: "Tax clearance certificate", valid_until: "2026-08-11" }
  ]
};

const applied = (oz: string, unitPrice: number, lineTotal: number): AppliedPrice => ({
  oz,
  unit_price: unitPrice,
  line_total: lineTotal,
  note: null,
  set_by: "agent",
  price_book_id: SOURCE.price_book_id,
  source: SOURCE
});

let writeResponse: unknown;

const checkResponse = {
  ok: true,
  bidder_id: "B-A",
  tender_id: "T-2026-014",
  status: "draft",
  complete: false,
  open_positions: [],
  outliers: [],
  missing_documents: [],
  due_date: "2026-09-10",
  due_in_days: 9,
  totals: { net: 0, contingency: 0, positions_priced: 0, positions_open: 2 },
  positions_priced: 0,
  positions_open: 2,
  undo_available: false,
  warnings: []
};

function stubApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/workspace") {
        return new Response(JSON.stringify({ ok: true, workspace_id: WS, created: true }));
      }
      if (init?.method === "POST" && input.endsWith("/prices")) {
        return new Response(JSON.stringify(writeResponse));
      }
      if (input.startsWith("/api/tenders?") || input === "/api/tenders") {
        return new Response(JSON.stringify({ ok: true, bidder_id: "B-A", tenders: [] }));
      }
      if (input.endsWith("/check")) {
        return new Response(JSON.stringify(checkResponse));
      }
      if (input.includes("/api/documents/")) {
        return new Response(
          JSON.stringify({
            ok: true,
            changed: true,
            doc_type: "tax_clearance",
            label: "Tax clearance certificate",
            previous_valid_until: "2026-08-11",
            valid_until: "2027-08-15"
          })
        );
      }
      return new Response(JSON.stringify(detail));
    }) as unknown as typeof fetch
  );
}

beforeEach(async () => {
  localStorage.clear();
  stubApi();
  await openTender("T-2026-014");
});

afterEach(async () => {
  await selectLanguage("en");
  await selectRole("bidder");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("unrolls the rows one at a time so the totals bar can be followed", async () => {
  writeResponse = {
    ok: true,
    bidder_id: "B-A",
    tender_id: "T-2026-014",
    applied: [applied("01.01", 2.9, 29), applied("02.01", 8.4, 840)],
    rejected: [],
    totals: { net: 869, contingency: 0, positions_priced: 2, positions_open: 0 }
  };
  vi.useFakeTimers();

  const priced = () =>
    bidderDetail()!.positions.filter((row) => row.my_unit_price !== null).length;

  const call = setUnitPrices("T-2026-014", [], "agent");
  await vi.advanceTimersByTimeAsync(0);
  // One call, but not one jump: the first row is in, the second is not yet.
  expect(priced()).toBe(1);

  await vi.advanceTimersByTimeAsync(80);
  expect(priced()).toBe(2);

  await call;
});

it("sets everything at once when the visitor asked for reduced motion", async () => {
  writeResponse = {
    ok: true,
    bidder_id: "B-A",
    tender_id: "T-2026-014",
    applied: [applied("01.01", 2.9, 29), applied("02.01", 8.4, 840)],
    rejected: [],
    totals: { net: 869, contingency: 0, positions_priced: 2, positions_open: 0 }
  };
  vi.stubGlobal("matchMedia", () => ({ matches: true }));

  await setUnitPrices("T-2026-014", [], "agent");

  expect(
    bidderDetail()!.positions.filter((row) => row.my_unit_price !== null)
  ).toHaveLength(2);
});

it("keeps the source on the row, so the chip survives the write", async () => {
  writeResponse = {
    ok: true,
    bidder_id: "B-A",
    tender_id: "T-2026-014",
    applied: [applied("02.01", 2.9, 290)],
    rejected: [],
    totals: { net: 290, contingency: 0, positions_priced: 1, positions_open: 1 }
  };
  vi.stubGlobal("matchMedia", () => ({ matches: true }));

  await setUnitPrices("T-2026-014", [], "agent");

  const row = bidderDetail()!.positions.find((entry) => entry.oz === "02.01")!;
  expect(row.my_unit_price).toBe(2.9);
  expect(row.set_by).toBe("agent");
  expect(row.source).toEqual(SOURCE);
});

it("keeps refused rows in the row and clears one when it is written later", async () => {
  writeResponse = {
    ok: true,
    bidder_id: "B-A",
    tender_id: "T-2026-014",
    applied: [],
    rejected: [{ oz: "02.01", reason: "price_without_source", hint: "no source" }],
    totals: { net: 0, contingency: 0, positions_priced: 0, positions_open: 2 }
  };
  vi.stubGlobal("matchMedia", () => ({ matches: true }));

  await setUnitPrices("T-2026-014", [], "agent");
  expect(getAppState().rejections["02.01"]?.reason).toBe("price_without_source");

  writeResponse = {
    ok: true,
    bidder_id: "B-A",
    tender_id: "T-2026-014",
    applied: [applied("02.01", 2.9, 290)],
    rejected: [],
    totals: { net: 290, contingency: 0, positions_priced: 1, positions_open: 1 }
  };
  await setUnitPrices("T-2026-014", [], "human");

  expect(getAppState().rejections["02.01"]).toBeUndefined();
});

it("marks the bid a draft as soon as the first row is written", async () => {
  writeResponse = {
    ok: true,
    bidder_id: "B-A",
    tender_id: "T-2026-014",
    applied: [applied("01.01", 2.9, 29)],
    rejected: [],
    totals: { net: 29, contingency: 0, positions_priced: 1, positions_open: 1 }
  };
  vi.stubGlobal("matchMedia", () => ({ matches: true }));

  expect(bidderDetail()!.tender.my_bid_status).toBe("none");
  await setUnitPrices("T-2026-014", [], "agent");

  // Without this the client side would keep saying "no bid yet" while a draft
  // sits on screen.
  expect(bidderDetail()!.tender.my_bid_status).toBe("draft");
});

it("re-reads everything on screen when the language changes, and nothing else", async () => {
  // The texts live in the Worker, so anything already fetched has to come back
  // in the new language. Found the hard way: the client's tender list kept its
  // German titles after a switch to English, because only the open tender was
  // being re-read.
  await selectRole("client");
  await readTenders();
  await runCheck("T-2026-014");

  const fetchMock = globalThis.fetch as unknown as { mock: { calls: [string][] } };
  const before = fetchMock.mock.calls.length;

  await selectLanguage("de");

  const paths = fetchMock.mock.calls.slice(before).map((call) => call[0]);
  expect(paths).toContain("/api/tenders/T-2026-014");
  expect(paths).toContain("/api/tenders");
  expect(paths).toContain("/api/tenders/T-2026-014/check");
  // The proposals are not among them: what a person sees of one is the source
  // chip and the price book line, and neither of those is translated.
  expect(paths.filter((path) => path.includes("/suggestions"))).toEqual([]);
  expect(getAppState().language).toBe("de");
});

it("does not go back to the Worker when the language did not change", async () => {
  const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[] } };
  const before = fetchMock.mock.calls.length;

  await selectLanguage("en");

  expect(fetchMock.mock.calls.length).toBe(before);
});

describe("a price with no source", () => {
  const written = (calls: unknown[][]) =>
    calls
      .filter((call) => String(call[0]).endsWith("/prices"))
      .map((call) => JSON.parse(String((call[1] as RequestInit).body)) as {
        set_by: string;
        prices: Record<string, unknown>[];
      });

  it("waits on the row and writes nothing until a person clicks", async () => {
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    const before = written(fetchMock.mock.calls).length;

    const { pending, rejected } = await proposePrices("T-2026-014", [
      { oz: "01.01", unit_price: 61, price_book_id: null, note: "derived" }
    ]);

    expect(rejected).toEqual([]);
    // Quantity 10 in this fixture, so the line the person is asked about is 610.
    expect(pending).toEqual([
      { oz: "01.01", unit_price: 61, line_total: 610, current_unit_price: null, rationale: "derived" }
    ]);
    expect(getAppState().pendingPrices["01.01"]).toBeDefined();
    expect(written(fetchMock.mock.calls).length).toBe(before);
    expect(bidderDetail()!.positions[0]!.my_unit_price).toBeNull();

    discardPendingPrice("01.01");
    expect(getAppState().pendingPrices["01.01"]).toBeUndefined();
  });

  it("is written by the click as the person's, note included, and undo will know it", async () => {
    await proposePrices("T-2026-014", [
      { oz: "01.01", unit_price: 61, price_book_id: null, note: "derived" }
    ]);
    writeResponse = {
      ok: true,
      bidder_id: "B-A",
      tender_id: "T-2026-014",
      applied: [
        { oz: "01.01", unit_price: 61, line_total: 610, note: "derived", set_by: "human", price_book_id: null, source: null }
      ],
      rejected: [],
      totals: { net: 610, contingency: 0, positions_priced: 1, positions_open: 1 }
    };
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };

    await confirmPendingPrice("01.01");

    // One write, through the same route as a value typed into the table: the
    // Worker books it as human and logs it as a block of its own.
    const sent = written(fetchMock.mock.calls).at(-1)!;
    expect(sent.set_by).toBe("human");
    expect(sent.prices).toEqual([{ oz: "01.01", unit_price: 61, note: "derived" }]);
    expect(sent.prices[0]).not.toHaveProperty("price_book_id");

    const row = bidderDetail()!.positions[0]!;
    expect(row).toMatchObject({ my_unit_price: 61, set_by: "human", source: null, note: "derived" });
    expect(getAppState().pendingPrices["01.01"]).toBeUndefined();
  });

  it("can carry only a remark: the price stays, the note is set", async () => {
    // Start from a price the person set.
    writeResponse = {
      ok: true,
      bidder_id: "B-A",
      tender_id: "T-2026-014",
      applied: [{ oz: "01.01", unit_price: 61, line_total: 610, note: null, set_by: "human", price_book_id: null, source: null }],
      rejected: [],
      totals: { net: 610, contingency: 0, positions_priced: 1, positions_open: 1 }
    };
    await setUnitPrices("T-2026-014", [{ oz: "01.01", unit_price: 61 }], "human");

    const { pending } = await proposePrices("T-2026-014", [
      { oz: "01.01", unit_price: 61, price_book_id: null, note: "own calculation" }
    ]);
    expect(pending[0]).toMatchObject({ unit_price: 61, current_unit_price: 61, rationale: "own calculation" });

    writeResponse = {
      ...(writeResponse as object),
      applied: [{ oz: "01.01", unit_price: 61, line_total: 610, note: "own calculation", set_by: "human", price_book_id: null, source: null }]
    };
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    await confirmPendingPrice("01.01");

    const sent = written(fetchMock.mock.calls).at(-1)!;
    expect(sent.prices).toEqual([{ oz: "01.01", unit_price: 61, note: "own calculation" }]);
    const row = bidderDetail()!.positions[0]!;
    expect(row.my_unit_price).toBe(61);
    expect(row.note).toBe("own calculation");
    expect(row.set_by).toBe("human");
  });
});

describe("a document date stated in the chat", () => {
  const documentWrites = (calls: unknown[][]) =>
    calls
      .filter((call) => String(call[0]).includes("/api/documents/"))
      .map((call) => [String(call[0]), JSON.parse(String((call[1] as RequestInit).body))]);

  it("waits for the person and writes nothing, with a check open so the finding and the way out stand together", async () => {
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    const before = documentWrites(fetchMock.mock.calls).length;

    const pending = await proposeDocumentValidity("tax_clearance", "2027-08-15");

    expect(pending).toEqual({
      doc_type: "tax_clearance",
      label: "Tax clearance certificate",
      previous_valid_until: "2026-08-11",
      valid_until: "2027-08-15"
    });
    expect(getAppState().pendingDocuments.tax_clearance).toBeDefined();
    expect(getAppState().check).not.toBeNull();
    expect(documentWrites(fetchMock.mock.calls).length).toBe(before);
    expect(bidderDetail()!.required_documents[0]!.valid_until).toBe("2026-08-11");
  });

  it("is written by the click, and the document on file follows at once", async () => {
    await proposeDocumentValidity("tax_clearance", "2027-08-15");
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };

    const result = await confirmDocumentValidity("tax_clearance");

    expect(result).toMatchObject({ changed: true, valid_until: "2027-08-15" });
    expect(documentWrites(fetchMock.mock.calls).at(-1)).toEqual([
      "/api/documents/tax_clearance",
      { valid_until: "2027-08-15" }
    ]);
    expect(bidderDetail()!.required_documents[0]!.valid_until).toBe("2027-08-15");
    expect(getAppState().pendingDocuments.tax_clearance).toBeUndefined();
  });
});
