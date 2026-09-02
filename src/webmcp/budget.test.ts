import { writeFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import evalsRaw from "../../evals/bidder.evals.json?raw";
import seedRaw from "../../seed/seed.json?raw";
import { findMatch, hasComparableShape } from "../matching";
import { allTools, clientSharedTools } from "./tools";

/**
 * The tool budget, measured rather than promised.
 *
 * An agent reads every description on every turn and every answer it asked
 * for; what it reads costs context, and context it has spent on us it cannot
 * spend on the person. Two reviews on 2 September counted eight of thirteen
 * descriptions above 500 characters and two answers above 1,500. The rule now:
 * a description says purpose, when, visible effect and boundary in at most
 * 500 characters; a parameter description in at most 150; and an answer
 * carries what the agent acts on -- item, text, quantity, unit, price, source
 * id, project and date -- not what the chip on the row shows.
 *
 * The answers are measured against the real seed: the fourteen positions of
 * T-2026-014, Farbwerk Meier's twelve price book lines, the twelve prices the
 * demo writes in E1. Where fourteen priced positions are the data, the compact
 * form is the budget, and the ceiling here is the measured size with a margin
 * -- so the test turns red the day a field creeps back in, not the day the
 * seed grows a position.
 */

const seed = JSON.parse(seedRaw) as {
  tenders: {
    id: string;
    positions: {
      oz: string;
      text_en: string;
      text_de: string;
      quantity: number;
      unit: string;
      category: string;
      contingency: boolean;
      long_text_en: string | null;
      long_text_de: string | null;
    }[];
  }[];
  price_book: {
    bidder_id: string;
    category: string;
    unit: string;
    keywords: string[];
    unit_price: number;
    source_project: string;
    source_date: string;
    source_position_text: string;
  }[];
};

const evals = JSON.parse(evalsRaw) as {
  name: string;
  expectedCall: { functionName: string; arguments: Record<string, unknown> }[];
}[];

const WS = "88888888-8888-4888-8888-888888888888";
const TENDER = seed.tenders.find((tender) => tender.id === "T-2026-014")!;

/** Meier's price book with the ids the seed builder assigns: PB-A-001 upwards. */
const PRICE_BOOK = seed.price_book
  .filter((entry) => entry.bidder_id === "B-A")
  .map((entry, index) => ({ ...entry, id: `PB-A-${String(index + 1).padStart(3, "0")}` }));

/** The twelve rows E1 writes, as the source of a priced tender. */
const E1_PRICES = (
  evals
    .find((entry) => entry.name.startsWith("E1"))!
    .expectedCall.find((call) => call.functionName === "set_unit_price")!.arguments.prices as {
    oz: string;
    unit_price: number;
    price_book_id: string;
  }[]
);

function apiPositions(priced: boolean) {
  return TENDER.positions.map((position) => {
    const written = priced ? E1_PRICES.find((row) => row.oz === position.oz) : undefined;
    const entry = written ? PRICE_BOOK.find((line) => line.id === written.price_book_id)! : null;
    return {
      oz: position.oz,
      text: position.text_en,
      long_text: position.long_text_en,
      quantity: position.quantity,
      unit: position.unit,
      category: position.category,
      contingency: position.contingency,
      my_unit_price: written?.unit_price ?? null,
      line_total: written ? Math.round(written.unit_price * position.quantity * 100) / 100 : null,
      set_by: written ? "agent" : null,
      note: null,
      source: entry
        ? {
            price_book_id: entry.id,
            source_project: entry.source_project,
            source_date: entry.source_date,
            source_position_text: entry.source_position_text
          }
        : null
    };
  });
}

const REQUIRED_DOCUMENTS = [
  { doc_type: "trade_registration", label: "Trade registration", valid_until: "2027-09-01" },
  { doc_type: "liability_insurance", label: "Liability insurance", valid_until: "2027-03-20" },
  { doc_type: "reference_project", label: "Reference project", valid_until: "2027-10-06" },
  { doc_type: "tax_clearance", label: "Tax clearance certificate", valid_until: "2026-08-13" }
];

const detail = (priced: boolean) => ({
  ok: true,
  role: "bidder",
  bidder_id: "B-A",
  tender: {
    id: "T-2026-014",
    title: "Staircase painting works – Rheinallee 12",
    client: "Rheinpark Property Management",
    city: "Düsseldorf",
    trade: "painting",
    status: "open",
    due_date: "2026-09-12",
    positions_count: 14,
    my_bid_status: priced ? "draft" : "none"
  },
  positions: apiPositions(priced),
  required_documents: REQUIRED_DOCUMENTS
});

/** The Worker's own proposals, computed the Worker's way, with the wording the chip shows. */
function apiSuggestions() {
  return TENDER.positions.map((position) => {
    const match = findMatch(PRICE_BOOK, position);
    if (match === null) {
      return {
        oz: position.oz,
        unit_price: null,
        matched_terms: 0,
        matched_on: hasComparableShape(PRICE_BOOK, position) ? ["category", "unit"] : [],
        based_on: null,
        reason: "no comparable entry in your price book"
      };
    }
    const terms = match.matchedKeywords.length;
    return {
      oz: position.oz,
      unit_price: match.entry.unit_price,
      matched_terms: terms,
      matched_on: ["category", "unit"],
      based_on: {
        price_book_id: match.entry.id,
        source_project: match.entry.source_project,
        source_date: match.entry.source_date,
        source_position_text: match.entry.source_position_text
      },
      reason:
        terms === 1
          ? "Same category and unit; one search term matched."
          : `Same category and unit; ${terms} search terms matched.`
    };
  });
}

/** The check after E1: two open positions, one expired certificate, the sentences the page writes. */
const CHECK_AFTER_E1 = {
  ok: true,
  bidder_id: "B-A",
  tender_id: "T-2026-014",
  status: "draft",
  complete: false,
  open_positions: ["03.04", "04.02"],
  outliers: [],
  missing_documents: [
    { doc_type: "tax_clearance", label: "Tax clearance certificate", valid_until: "2026-08-13", reason: "expired" }
  ],
  due_date: "2026-09-12",
  due_in_days: 9,
  totals: { net: 13213.5, contingency: 370, positions_priced: 11, positions_open: 1 },
  positions_priced: 11,
  positions_open: 1,
  undo_available: true,
  warnings: [
    "1 position without a price: 03.04.",
    "1 contingency position without a price: 04.02. These are quoted separately and do not count towards the total.",
    "Tax clearance certificate expired on 2026-08-13."
  ],
  actions: [
    { finding: "open_position", oz: "03.04", action: "no entry for metal/pcs — set the price yourself, or ask your agent to derive one; you confirm it." },
    { finding: "open_position", oz: "04.02", action: "no entry for labour/h — set the price yourself, or ask your agent to derive one; you confirm it." },
    { finding: "document", doc_type: "tax_clearance", action: "tell your agent the new expiry date — you confirm it on the page — or upload a current certificate." }
  ],
  blockers: [
    { kind: "open_position", oz: "03.04", text: "Radiators incl. pipes, two coats" },
    { kind: "document_expired", doc_type: "tax_clearance", label: "Tax clearance certificate", valid_until: "2026-08-13" }
  ]
};

let priced = false;

beforeEach(() => {
  priced = false;
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
      if (input === "/api/workspace") return json({ ok: true, workspace_id: WS, created: true });
      if (input.startsWith("/api/price-book")) {
        const params = new URL(`https://x${input}`).searchParams;
        let entries = PRICE_BOOK;
        const category = params.get("category");
        const unit = params.get("unit");
        if (category) entries = entries.filter((entry) => entry.category === category);
        if (unit) entries = entries.filter((entry) => entry.unit === unit);
        return json({ ok: true, bidder_id: "B-A", entries });
      }
      if (input.endsWith("/suggestions")) {
        return json({ ok: true, bidder_id: "B-A", tender_id: "T-2026-014", suggestions: apiSuggestions() });
      }
      if (input.endsWith("/check")) return json(CHECK_AFTER_E1);
      if (input.startsWith("/api/clarifications")) return json({ ok: true, questions: [] });
      if (input.startsWith("/api/tenders/")) return json(detail(priced));
      return json({ ok: true, role: "bidder", bidder_id: "B-A", tenders: [detail(false).tender] });
    }) as unknown as typeof fetch
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const tool = (name: string) => allTools.find((entry) => entry.name === name)!;
const size = (value: unknown) => JSON.stringify(value).length;

/**
 * The ceilings. 1,500 is the target and holds where the data lets it; where
 * the data is fourteen positions of a real bill of quantities with their
 * prices, the compact form IS the budget, and the ceiling is the measured
 * size with a small margin -- red the day a field creeps back in, not the day
 * a text in the seed grows a word.
 */
const CEILING = {
  get_tender_unpriced: 2600,
  get_tender_priced: 4000,
  get_price_book_summary: 1500,
  get_price_book_filtered: 1500,
  suggest_prices: 3500,
  check_bid: 1500
} as const;

/** The sizes this run measured, kept for the write-up when BUDGET_REPORT names a file. */
const measured: Record<string, number> = {};
const measure = (key: keyof typeof CEILING, value: unknown) => {
  measured[key] = size(value);
  if (process.env.BUDGET_REPORT) {
    writeFileSync(process.env.BUDGET_REPORT, JSON.stringify(measured, null, 2));
  }
  expect(measured[key], `${key}: ${measured[key]} > ${CEILING[key]}`).toBeLessThanOrEqual(CEILING[key]);
};

it("keeps every description at 500 characters or fewer, in both roles", () => {
  for (const entry of [...allTools, ...clientSharedTools]) {
    expect(entry.description.length, `${entry.name}: ${entry.description.length}`).toBeLessThanOrEqual(500);
    // And still says when to reach for it, in a word a test can find.
    expect(entry.description, entry.name).toMatch(/\bUse\b/);
  }
});

it("keeps every parameter description at 150 characters or fewer", () => {
  for (const entry of [...allTools, ...clientSharedTools]) {
    const properties = entry.inputSchema.properties as Record<
      string,
      { description?: string; items?: { properties?: Record<string, { description?: string }> } }
    >;
    for (const [name, property] of Object.entries(properties)) {
      expect((property.description ?? "").length, `${entry.name}.${name}`).toBeLessThanOrEqual(150);
      for (const [nested, inner] of Object.entries(property.items?.properties ?? {})) {
        expect((inner.description ?? "").length, `${entry.name}.${name}.${nested}`).toBeLessThanOrEqual(150);
      }
    }
  }
});

it("get_tender: fourteen unpriced positions, no empty price fields, no long text", async () => {
  const result = await tool("get_tender").execute({ tender_id: "T-2026-014" });
  const positions = result.positions as Record<string, unknown>[];
  expect(positions).toHaveLength(14);
  for (const position of positions) {
    expect(Object.keys(position).sort()).toEqual(["category", "contingency", "oz", "quantity", "text", "unit"]);
  }
  expect((result.required_documents as Record<string, unknown>[])[0]).toEqual({
    doc_type: "trade_registration",
    valid_until: "2027-09-01"
  });
  measure("get_tender_unpriced", result);
});

it("get_tender: twelve priced positions carry price, source id, project and date -- not the original line", async () => {
  priced = true;
  const result = await tool("get_tender").execute({ tender_id: "T-2026-014" });
  const positions = result.positions as Record<string, unknown>[];
  const first = positions.find((position) => position.oz === "01.01")!;
  expect(first).toEqual({
    oz: "01.01",
    text: TENDER.positions[0]!.text_en,
    quantity: 1,
    unit: "psch",
    category: "prep",
    contingency: false,
    my_unit_price: 480,
    price_book_id: "PB-A-001",
    source_project: PRICE_BOOK[0]!.source_project,
    source_date: PRICE_BOOK[0]!.source_date
  });
  expect(JSON.stringify(result)).not.toContain("source_position_text");
  expect(JSON.stringify(result)).not.toContain("line_total");
  measure("get_tender_priced", result);
});

it("get_tender: long text only on request", async () => {
  const without = await tool("get_tender").execute({ tender_id: "T-2026-014" });
  const withText = await tool("get_tender").execute({ tender_id: "T-2026-014", include_long_text: true });
  expect(JSON.stringify(without)).not.toContain("long_text");
  expect(JSON.stringify(withText)).toContain("long_text");
});

it("get_price_book: without a filter, the shape of the book, not its rows", async () => {
  const result = await tool("get_price_book").execute({});
  expect(result.entries_total).toBe(12);
  expect(result).not.toHaveProperty("entries");
  const groups = result.groups as { category: string; unit: string; entries: number }[];
  expect(groups.reduce((sum, group) => sum + group.entries, 0)).toBe(12);
  // The radiators gap, as a shape: no metal per piece.
  expect(groups.some((group) => group.category === "metal" && group.unit === "pcs")).toBe(false);
  measure("get_price_book_summary", result);
});

it("get_price_book: with a filter, the lines without the original wording", async () => {
  const result = await tool("get_price_book").execute({ category: "wall" });
  const entries = result.entries as Record<string, unknown>[];
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(Object.keys(entry).sort()).toEqual(
      ["category", "id", "keywords", "source_date", "source_project", "unit", "unit_price"]
    );
  }
  measure("get_price_book_filtered", result);
  // The unit filter reaches the Worker as a query parameter.
  await tool("get_price_book").execute({ unit: "m2" });
  const calls = (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((call) => call[0]);
  expect(calls.some((path) => path.includes("unit=m2"))).toBe(true);
});

it("suggest_prices: twelve proposals and two gaps, each with its source id, project and date", async () => {
  const result = await tool("suggest_prices").execute({ tender_id: "T-2026-014" });
  const suggestions = result.suggestions as { oz: string; unit_price: number | null; based_on: Record<string, unknown> | null }[];
  expect(suggestions.filter((entry) => entry.unit_price === null).map((entry) => entry.oz)).toEqual(["03.04", "04.02"]);
  expect(suggestions[0]!.based_on).toEqual({
    price_book_id: "PB-A-001",
    source_project: PRICE_BOOK[0]!.source_project,
    source_date: PRICE_BOOK[0]!.source_date
  });
  expect(JSON.stringify(result)).not.toContain("source_position_text");
  measure("suggest_prices", result);
});

it("check_bid: the findings, the numbers and the actions -- not the warnings that repeat them", async () => {
  const result = await tool("check_bid").execute({ tender_id: "T-2026-014" });
  expect(result).not.toHaveProperty("warnings");
  expect(result).not.toHaveProperty("positions_priced");
  expect(result.totals).toEqual({ net: 13213.5, contingency: 370, positions_priced: 11, positions_open: 1 });
  expect((result.actions as unknown[]).length).toBe(3);
  expect((result.blockers as unknown[]).length).toBe(2);
  measure("check_bid", result);
});
