import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getAppState } from "../store";
import {
  allTools,
  askClarificationFallback,
  bidderOnlyTools,
  clientTools,
  sharedTools,
  submitTools
} from "./tools";

const WS = "44444444-4444-4444-8444-444444444444";

const listTenders = allTools.find((tool) => tool.name === "list_tenders")!;
const getTender = allTools.find((tool) => tool.name === "get_tender")!;
const setUnitPrice = allTools.find((tool) => tool.name === "set_unit_price")!;
const setDocumentValidity = allTools.find((tool) => tool.name === "set_document_validity")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

const detail = (id: string) => ({
  ok: true,
  bidder_id: "B-A",
  tender: {
    id,
    title: "Staircase painting works",
    title_de: "Malerarbeiten Treppenhaus",
    client: "Rheinpark Property Management",
    city: "Düsseldorf",
    trade: "painting",
    status: "open",
    due_date: "2026-09-10",
    positions_count: 1,
    my_bid_status: "none"
  },
  positions: [
    {
      oz: "01.01",
      text: "Site setup",
      text_de: "Baustelleneinrichtung",
      long_text: null,
      long_text_de: null,
      quantity: 1,
      unit: "psch",
      category: "prep",
      contingency: false,
      my_unit_price: null,
      line_total: null
    }
  ],
  required_documents: [
    { doc_type: "tax_clearance", label: "Tax clearance certificate", label_de: "U", valid_until: "2026-08-11" },
    { doc_type: "liability_insurance", label: "Liability insurance", valid_until: "2027-03-20" }
  ]
});

let requests: string[] = [];
let bodies: unknown[] = [];

beforeEach(() => {
  requests = [];
  bodies = [];
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      requests.push(input);
      if (typeof init?.body === "string") bodies.push(JSON.parse(init.body));
      if (input === "/api/workspace") {
        return json({ ok: true, workspace_id: WS, created: true }, 201);
      }
      if (input.endsWith("/prices")) {
        // The Worker's answer to a sourced row: written, with its source.
        const sent = JSON.parse(String(init?.body)) as { prices: { oz: string; unit_price: number; price_book_id?: string }[] };
        return json({
          ok: true,
          bidder_id: "B-A",
          tender_id: "T-2026-014",
          applied: sent.prices.map((row) => ({
            oz: row.oz,
            unit_price: row.unit_price,
            line_total: row.unit_price,
            note: null,
            set_by: "agent",
            price_book_id: row.price_book_id ?? null,
            source: { price_book_id: row.price_book_id, source_project: "Luegallee 40", source_date: "2026-03-14", source_position_text: "x" }
          })),
          rejected: [],
          totals: { net: 480, contingency: 0, positions_priced: 1, positions_open: 0 }
        });
      }
      if (input.startsWith("/api/tenders/")) {
        const id = decodeURIComponent(input.slice("/api/tenders/".length));
        return id === "T-2026-999"
          ? json({ ok: false, error: "tender_not_found", hint: `No tender ${id} in this workspace.` }, 404)
          : json(detail(id));
      }
      return json({ ok: true, bidder_id: "B-A", tenders: [detail("T-2026-014").tender] });
    }) as unknown as typeof fetch
  );
});

afterEach(async () => {
  const { closeCheck, discardDocumentValidity, discardPendingPrice } = await import("../store");
  discardPendingPrice("01.01");
  discardDocumentValidity("tax_clearance");
  closeCheck();
  vi.unstubAllGlobals();
});

it("declares titles, closed schemas and a description for every field", () => {
  for (const tool of allTools) {
    expect(tool.title.length).toBeGreaterThan(0);
    expect(tool.inputSchema.additionalProperties).toBe(false);
    for (const property of Object.values(tool.inputSchema.properties)) {
      expect((property as { description?: string }).description).toBeTruthy();
    }
  }
});

it("cuts thirteen distinct tools into the blocks each role registers", () => {
  const names = (tools: typeof allTools) => tools.map((tool) => tool.name);

  expect(names(allTools)).toHaveLength(13);
  expect(new Set(names(allTools)).size).toBe(13);

  // Bidder: three shared, six of its own, ask_clarification (declared by the
  // form; this list holds its fallback twin) and submit_bid on its own
  // controller. Eleven -- and ten once the bid is handed in, because only
  // submit_bid goes: set_document_validity is master data and stays.
  expect(
    names([...sharedTools, ...bidderOnlyTools, ...askClarificationFallback, ...submitTools])
  ).toHaveLength(11);
  expect(names([...sharedTools, ...bidderOnlyTools, ...askClarificationFallback])).toHaveLength(10);
  expect(names(bidderOnlyTools)).toContain("set_document_validity");

  // Client: three shared plus two of its own. Five.
  expect(names([...sharedTools, ...clientTools])).toEqual([
    "list_tenders",
    "get_tender",
    "list_clarifications",
    "get_price_comparison",
    "answer_clarification"
  ]);

  expect(submitTools).toHaveLength(1);
  expect(askClarificationFallback).toHaveLength(1);
});

it("keeps the client out of the bidder tools and the bidder out of the client tools", () => {
  const bidderNames = [
    ...sharedTools,
    ...bidderOnlyTools,
    ...askClarificationFallback,
    ...submitTools
  ].map((tool) => tool.name);
  const clientNames = [...sharedTools, ...clientTools].map((tool) => tool.name);

  // Roles are separated by what exists, not by what is permitted.
  expect(bidderNames).not.toContain("get_price_comparison");
  expect(bidderNames).not.toContain("answer_clarification");
  expect(clientNames).not.toContain("set_unit_price");
  expect(clientNames).not.toContain("submit_bid");
  expect(clientNames).not.toContain("suggest_prices");
});

it("says in get_price_comparison that open bids are sealed", () => {
  const compare = clientTools.find((tool) => tool.name === "get_price_comparison")!;
  expect(compare.description).toContain("sealed");
  expect(compare.description).toContain("no prices at all");
  expect(compare.annotations.readOnlyHint).toBe(true);
});

it("says in answer_clarification that the answer reaches every bidder", () => {
  const answer = clientTools.find((tool) => tool.name === "answer_clarification")!;
  expect(answer.description).toContain("EVERY bidder");
  expect(answer.annotations.readOnlyHint).toBe(false);
});

it("marks the reading tools read-only and the writing tools not", () => {
  const all = allTools;
  const readOnly = all
    .filter((tool) => tool.annotations.readOnlyHint === true)
    .map((tool) => tool.name);
  const writing = all
    .filter((tool) => tool.annotations.readOnlyHint !== true)
    .map((tool) => tool.name);

  expect([...readOnly].sort()).toEqual([
    "check_bid",
    "get_price_book",
    "get_price_comparison",
    "get_tender",
    "list_clarifications",
    "list_tenders",
    "suggest_prices"
  ]);
  expect([...writing].sort()).toEqual([
    "answer_clarification",
    "ask_clarification",
    "set_document_validity",
    "set_unit_price",
    "submit_bid",
    "undo_last_change"
  ]);
});

it("declares untrustedContentHint on the tool that returns other people's text", () => {
  const withForeignText = allTools
    .filter((tool) => tool.annotations.untrustedContentHint === true)
    .map((tool) => tool.name);
  expect(withForeignText).toEqual(["list_clarifications"]);
});

it("marks submit_bid as destructive and says a person has to confirm it", () => {
  const submit = submitTools[0]!;
  expect(submit.annotations.destructiveHint).toBe(true);
  expect(submit.description).toContain("does NOT submit");
  expect(submit.description).toContain("only when a person clicks");
});

it("tells the agent that suggest_prices only proposes and names what applies it", () => {
  const suggest = allTools.find((tool) => tool.name === "suggest_prices")!;
  // Without this, prompt 1 ends at "here are the prices" and the table stays empty.
  expect(suggest.description).toContain("ONLY PROPOSES");
  expect(suggest.description).toContain("set_unit_price");
  expect(suggest.description).toContain("based_on.price_book_id");
});

it("says in the description when to use it and what it does on screen", () => {
  expect(getTender.description).toContain("Visible effect");
  expect(getTender.description).toContain("Use it");
  expect(listTenders.description).toContain("Use it");
  // A read tool must not claim it changes the screen.
  expect(listTenders.description).toContain("does not open a tender on screen");
});

it("list_tenders passes its filters through as query parameters", async () => {
  const result = await listTenders.execute({ status: "open", city: "Düsseldorf" });
  expect(result.ok).toBe(true);
  const call = requests.find((path) => path.startsWith("/api/tenders?"))!;
  expect(call).toContain("status=open");
  expect(call).toContain(encodeURIComponent("Düsseldorf"));
});

it("rejects an unknown status instead of guessing one", async () => {
  const result = await listTenders.execute({ status: "expired" });
  expect(result).toEqual({
    ok: false,
    error: "invalid_input",
    hint: "status must be one of open, closed, all."
  });
});

it("holds to additionalProperties:false and names the offending argument", async () => {
  const result = await listTenders.execute({ limit: 5 });
  expect(result.ok).toBe(false);
  expect(result.error).toBe("invalid_input");
  expect(String(result.hint)).toContain("limit");
});

it("get_tender opens the tender on screen and returns the bill of quantities", async () => {
  const result = await getTender.execute({ tender_id: "T-2026-015" });

  expect(result.ok).toBe(true);
  expect(result.id).toBe("T-2026-015");
  expect(Array.isArray(result.positions)).toBe(true);
  expect(Array.isArray(result.required_documents)).toBe(true);
  // The visible effect the description promises: the store now holds it.
  expect(getAppState().tenderId).toBe("T-2026-015");
  expect(getAppState().detail?.tender.id).toBe("T-2026-015");
});

it("requires tender_id rather than falling back to a default", async () => {
  const result = await getTender.execute({});
  expect(result).toEqual({
    ok: false,
    error: "invalid_input",
    hint: "tender_id is required and must be a non-empty string."
  });
});

it("passes the machine-readable error code on when a tender does not exist", async () => {
  const result = await getTender.execute({ tender_id: "T-2026-999" });
  expect(result.ok).toBe(false);
  expect(result.error).toBe("tender_not_found");
});

it("puts a price without a source on the row to be confirmed, and writes nothing", async () => {
  await getTender.execute({ tender_id: "T-2026-014" });
  const before = requests.length;

  const result = await setUnitPrice.execute({
    tender_id: "T-2026-014",
    prices: [{ oz: "01.01", unit_price: 61, rationale: "derived with the person" }]
  });

  // Not written, not refused: waiting. The second half of the submit_bid pattern.
  expect(result).toMatchObject({
    ok: true,
    status: "needs_confirmation",
    applied: [],
    rejected: [],
    pending: [
      { oz: "01.01", unit_price: 61, line_total: 61, current_unit_price: null, rationale: "derived with the person" }
    ]
  });
  // Nothing went to the Worker -- no bid_prices row, no change_log block.
  expect(requests.slice(before).filter((path) => path.endsWith("/prices"))).toEqual([]);
  expect(getAppState().pendingPrices["01.01"]).toMatchObject({ unit_price: 61 });
});

it("sends sourced rows to the Worker and keeps the sourceless ones on the page, in one call", async () => {
  await getTender.execute({ tender_id: "T-2026-014" });

  const result = await setUnitPrice.execute({
    tender_id: "T-2026-014",
    prices: [
      { oz: "01.01", unit_price: 480, price_book_id: "PB-A-001" },
      { oz: "01.02", unit_price: 3.5, rationale: "own calculation" }
    ]
  });

  const sent = bodies.find((body) => (body as { prices?: unknown }).prices) as {
    prices: { oz: string }[];
    set_by: string;
  };
  // Only the sourced row travelled, and it travelled as the agent's.
  expect(sent.prices.map((row) => row.oz)).toEqual(["01.01"]);
  expect(sent.set_by).toBe("agent");
  expect((result.applied as { oz: string }[]).map((row) => row.oz)).toEqual(["01.01"]);
  // 01.02 is not a position of this one-row tender: judged by the same rules
  // as a write, so it comes back under rejected, not under pending -- and with
  // nothing left pending, the call reads as applied.
  expect(result.rejected).toEqual([
    expect.objectContaining({ oz: "01.02", reason: "unknown_position" })
  ]);
  expect(result).toMatchObject({ status: "applied", pending: [] });
});

it("refuses a rationale longer than 240 characters before anything happens", async () => {
  await getTender.execute({ tender_id: "T-2026-014" });
  const before = requests.length;

  const result = await setUnitPrice.execute({
    tender_id: "T-2026-014",
    prices: [{ oz: "01.01", unit_price: 61, rationale: "x".repeat(241) }]
  });

  expect(result).toMatchObject({ ok: false, error: "invalid_input" });
  expect(requests.length).toBe(before);
  expect(getAppState().pendingPrices["01.01"]).toBeUndefined();
});

it("relays a document date for the person to confirm, and writes nothing", async () => {
  await getTender.execute({ tender_id: "T-2026-014" });
  const before = requests.length;

  const result = await setDocumentValidity.execute({
    doc_type: "tax_clearance",
    valid_until: "2027-08-15"
  });

  // The third way: neither written nor refused. The page has not seen the
  // certificate, so all it can do is put the date in front of the person.
  expect(result).toEqual({
    ok: true,
    status: "needs_confirmation",
    pending: [
      {
        doc_type: "tax_clearance",
        label: "Tax clearance certificate",
        previous_valid_until: "2026-08-11",
        valid_until: "2027-08-15"
      }
    ]
  });
  expect(requests.slice(before).filter((path) => path.includes("/api/documents"))).toEqual([]);
  expect(getAppState().pendingDocuments.tax_clearance).toMatchObject({ valid_until: "2027-08-15" });
});

it("refuses a date in the past, with a hint, and puts nothing in front of the person", async () => {
  await getTender.execute({ tender_id: "T-2026-014" });
  const before = requests.length;

  const result = await setDocumentValidity.execute({
    doc_type: "tax_clearance",
    valid_until: "2020-01-01"
  });

  expect(result).toMatchObject({ ok: false, error: "date_in_the_past" });
  expect(String((result as { hint: string }).hint)).toContain("in the past");
  expect(requests.length).toBe(before);
  expect(getAppState().pendingDocuments.tax_clearance).toBeUndefined();
});

it("does nothing when the date is already on file: no error, no confirmation", async () => {
  await getTender.execute({ tender_id: "T-2026-014" });
  const before = requests.length;

  // A document that is still valid, restated with the date already on file.
  // (Restating an EXPIRED document's own date is a date in the past, and says so.)
  const result = await setDocumentValidity.execute({
    doc_type: "liability_insurance",
    valid_until: "2027-03-20"
  });

  expect(result).toMatchObject({ ok: true, status: "unchanged", valid_until: "2027-03-20" });
  expect(String((result as { note: string }).note)).toContain("already valid until 2027-03-20");
  expect(requests.length).toBe(before);
  expect(getAppState().pendingDocuments.liability_insurance).toBeUndefined();
});

it("refuses a document type it does not know, naming the ones it does", async () => {
  const result = await setDocumentValidity.execute({
    doc_type: "iso_9001",
    valid_until: "2027-08-15"
  });
  expect(result).toMatchObject({ ok: false, error: "invalid_input" });
  expect(String((result as { hint: string }).hint)).toContain("tax_clearance");
  // And the schema says the same, so an agent never has to guess a spelling.
  const property = setDocumentValidity.inputSchema.properties.doc_type as { enum: string[] };
  expect(property.enum).toEqual([
    "trade_registration",
    "liability_insurance",
    "reference_project",
    "tax_clearance"
  ]);
});

it("says in its description what it does not do", () => {
  const description = setDocumentValidity.description.toLowerCase();
  expect(description).toContain("nothing is uploaded");
  expect(description).toContain("nothing is verified");
  expect(description).toContain("undo_last_change does not cover it");
  expect(description).toContain("after the bid is handed in");
});
