import { expect, it } from "vitest";
import seedRaw from "../seed/seed.json?raw";
import { normalise } from "./matching";
import { cellKey, coverageAxes, coverageCounts, groupEntries, searchEntries } from "./priceBook";
import type { PriceBookRow } from "./types";

/**
 * The price book screen, computed from the seed rather than from copied
 * numbers: if the seed changes, these expectations change with it, and a
 * screen that disagreed with the matcher would show up here.
 */
type SeedEntry = Omit<PriceBookRow, "id"> & { bidder_id: string };

const seed = JSON.parse(seedRaw) as {
  tenders: { id: string; positions: { category: string; unit: string }[] }[];
  price_book: SeedEntry[];
};

/** The Worker numbers the entries per bidder in seed order: PB-A-001, PB-A-002, ... */
function bookOf(bidder: string): PriceBookRow[] {
  const letter = bidder.split("-")[1]!;
  return seed.price_book
    .filter((entry) => entry.bidder_id === bidder)
    .map((entry, index) => ({ ...entry, id: `PB-${letter}-${String(index + 1).padStart(3, "0")}` }));
}

const positions = seed.tenders.flatMap((tender) => tender.positions);

it("builds the matrix axes from the data, never from a list in the code", () => {
  const axes = coverageAxes(bookOf("B-A"), positions);
  const expectedCategories = [
    ...new Set([...bookOf("B-A"), ...positions].map((row) => row.category))
  ].sort();
  expect(axes.categories).toEqual(expectedCategories);
  expect(axes.units).toEqual([...new Set([...bookOf("B-A"), ...positions].map((r) => r.unit))].sort());

  // Take a shape out of both sources and it leaves the matrix; bring a unit in
  // through a tender (a GAEB import, say) and it appears.
  const without = coverageAxes(
    bookOf("B-A").filter((row) => row.category !== "labour"),
    positions.filter((row) => row.category !== "labour")
  );
  expect(without.categories).not.toContain("labour");
  const withKilo = coverageAxes(bookOf("B-A"), [...positions, { category: "prep", unit: "kg" }]);
  expect(withKilo.units).toContain("kg");
});

it("shows the radiators gap: metal per piece is empty for Farbwerk Meier", () => {
  const counts = coverageCounts(bookOf("B-A"));
  // The gap of prompt 2, as a cell: no key, not a zero.
  expect(counts.get(cellKey("metal", "pcs"))).toBeUndefined();
  expect(counts.has(cellKey("metal", "pcs"))).toBe(false);
  // And the same cell is filled for Brandt & Sohn, who have no gaps.
  expect(coverageCounts(bookOf("B-B")).get(cellKey("metal", "pcs"))).toBeGreaterThan(0);
});

it("changes list and matrix with the contractor", () => {
  const [a, b, c] = [bookOf("B-A"), bookOf("B-B"), bookOf("B-C")];
  expect(a.length).not.toBe(c.length);
  expect(coverageCounts(a).size).not.toBe(coverageCounts(c).size);
  // The seed says who has how much; the screen must say the same.
  expect(a.length + b.length + c.length).toBe(seed.price_book.length);
  expect(groupEntries(a).flatMap((group) => group.units).flatMap((unit) => unit.entries)).toHaveLength(
    a.length
  );
});

it("searches with the matcher's own normalise, so the screen and the agent agree", () => {
  const book = bookOf("B-A");
  const hits = searchEntries(book, "schimmel");
  expect(hits.length).toBeGreaterThan(0);
  for (const hit of hits) {
    const haystack = [hit.source_position_text, ...hit.keywords].map(normalise).join(" ");
    expect(haystack).toContain("schimmel");
  }
  // Case and umlauts go through the same normalisation as a position's text.
  expect(searchEntries(book, "SCHIMMEL")).toEqual(hits);
  expect(searchEntries(book, "Gerüst").length).toBe(searchEntries(book, "geruest").length);
  expect(searchEntries(book, "")).toHaveLength(book.length);
  expect(searchEntries(book, "zzz-nothing-here")).toEqual([]);
});

it("groups by category, then unit, in seed order", () => {
  const groups = groupEntries(bookOf("B-A"));
  expect(groups.map((group) => group.category)).toEqual(
    [...groups.map((group) => group.category)].sort()
  );
  for (const group of groups) {
    expect(group.units.map((unit) => unit.unit)).toEqual([...group.units.map((u) => u.unit)].sort());
    for (const unit of group.units) {
      const ids = unit.entries.map((entry) => entry.id);
      expect(ids).toEqual([...ids].sort());
    }
  }
});
