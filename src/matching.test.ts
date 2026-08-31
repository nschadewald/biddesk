import { describe, expect, it } from "vitest";
import seedRaw from "../seed/seed.json?raw";
import { findMatch, hasComparableShape, normalise, type PriceBookEntry } from "./matching";

/**
 * The agreement with seed/verify_seed.py, checked against the seed itself
 * rather than against a copy of the numbers. If the rule here and the rule
 * there ever drift apart, this fails.
 */

type SeedPosition = {
  oz: string;
  text_de: string;
  quantity: number;
  unit: string;
  category: string;
  contingency: boolean;
};

const seed = JSON.parse(seedRaw) as {
  tenders: { id: string; positions: SeedPosition[] }[];
  price_book: (Omit<PriceBookEntry, "id"> & { bidder_id: string })[];
  deliberate_gaps: {
    bidder: string;
    positions: string[];
    secondary_tender: { tender: string; expect: Record<string, number> };
  };
};

/** The Worker reads the price book ordered by id, which is the seed order. */
function priceBookOf(bidder: string): PriceBookEntry[] {
  return seed.price_book
    .filter((entry) => entry.bidder_id === bidder)
    .map((entry, index) => ({
      ...entry,
      id: `PB-${bidder.slice(-1)}-${String(index + 1).padStart(3, "0")}`
    }));
}

const t14 = seed.tenders.find((tender) => tender.id === "T-2026-014")!.positions;
const meier = priceBookOf("B-A");
const results = t14.map((position) => ({ position, match: findMatch(meier, position) }));

describe("normalisation", () => {
  it("lower-cases and unfolds the umlauts", () => {
    expect(normalise("Wandflächen WEISS")).toBe("wandflaechen weiss");
    expect(normalise("Größe Öl Übung")).toBe("groesse oel uebung");
  });
});

describe("the rule", () => {
  it("matches keywords inside German compounds, not as whole words", () => {
    const mould = t14.find((position) => position.oz === "04.01")!;
    const match = findMatch(meier, mould)!;
    // "Schimmelbehandlung" contains "schimmel" and "behandlung".
    expect(match.matchedKeywords.sort()).toEqual(["behandlung", "schimmel"]);
  });

  it("refuses to fall back to a line that only shares the unit", () => {
    const radiators = t14.find((position) => position.oz === "03.04")!;
    expect(radiators.category).toBe("metal");
    expect(radiators.unit).toBe("pcs");
    // A door costs 148 EUR and is wood/pcs. That must not become a radiator price.
    expect(findMatch(meier, radiators)).toBeNull();
    expect(hasComparableShape(meier, radiators)).toBe(false);
  });

  it("needs at least one keyword hit, even with category and unit in place", () => {
    const entries: PriceBookEntry[] = [
      {
        id: "PB-X-001",
        category: "prep",
        unit: "m2",
        keywords: ["reinigen"],
        unit_price: 3.2,
        source_project: "Somewhere",
        source_date: "2026-01-20",
        source_position_text: "Altanstrich reinigen"
      }
    ];
    const position = { category: "prep", unit: "m2", text_de: "Etwas ganz anderes" };
    expect(findMatch(entries, position)).toBeNull();
    // The shape was there; only the wording did not match.
    expect(hasComparableShape(entries, position)).toBe(true);
  });

  it("keeps the earlier entry when two match equally often", () => {
    const entries: PriceBookEntry[] = [
      {
        id: "PB-X-001",
        category: "wall",
        unit: "m2",
        keywords: ["anstrich"],
        unit_price: 10,
        source_project: "First",
        source_date: "2026-01-20",
        source_position_text: "first"
      },
      {
        id: "PB-X-002",
        category: "wall",
        unit: "m2",
        keywords: ["anstrich"],
        unit_price: 99,
        source_project: "Second",
        source_date: "2026-02-20",
        source_position_text: "second"
      }
    ];
    expect(findMatch(entries, { category: "wall", unit: "m2", text_de: "Anstrich" })?.entry.id).toBe(
      "PB-X-001"
    );
  });
});

describe("Farbwerk Meier on T-2026-014", () => {
  it("proposes a price for exactly 12 of the 14 positions", () => {
    expect(results.filter((row) => row.match !== null)).toHaveLength(12);
  });

  it("leaves exactly the two deliberate gaps, and they are 03.04 and 04.02", () => {
    const gaps = results.filter((row) => row.match === null).map((row) => row.position.oz);
    expect(gaps).toEqual(["03.04", "04.02"]);
    expect(gaps).toEqual(seed.deliberate_gaps.positions);
  });

  it("has 11 proposals on two or more terms and exactly one on a single term", () => {
    const counts = results
      .filter((row) => row.match !== null)
      .map((row) => row.match!.matchedKeywords.length);
    expect(counts.filter((count) => count >= 2)).toHaveLength(11);
    expect(counts.filter((count) => count === 1)).toHaveLength(1);
  });

  it("adds up to 13.213,50 EUR net, with 370,00 EUR of contingency alongside", () => {
    const total = (contingency: boolean) =>
      results
        .filter((row) => row.match !== null && row.position.contingency === contingency)
        .reduce((carry, row) => carry + row.position.quantity * row.match!.entry.unit_price, 0);

    expect(total(false)).toBeCloseTo(13213.5, 2);
    expect(total(true)).toBeCloseTo(370, 2);
  });
});

describe("the same bill of quantities, other bidders", () => {
  const gapsIn = (tenderId: string, bidder: string) =>
    seed.tenders
      .find((tender) => tender.id === tenderId)!
      .positions.filter((position) => findMatch(priceBookOf(bidder), position) === null)
      .map((position) => position.oz);

  it("produces different gaps on the main tender, which nothing hard-coded could do", () => {
    expect(gapsIn("T-2026-014", "B-A")).toEqual(seed.deliberate_gaps.positions);
    expect(gapsIn("T-2026-014", "B-B")).toEqual([]);
    expect(gapsIn("T-2026-014", "B-C")).toHaveLength(7);
  });

  it("shows three different pictures on the second tender too", () => {
    // The bidder switch is demonstrated on T-2026-015: on the main tender the
    // other two have already handed in, so their table is locked and the
    // difference is not on screen. seed.json states the expectation.
    const { tender, expect: wanted } = seed.deliberate_gaps.secondary_tender;
    for (const [bidder, count] of Object.entries(wanted)) {
      expect(gapsIn(tender, bidder)).toHaveLength(count);
    }
  });
});
