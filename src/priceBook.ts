import { normalise } from "./matching";
import type { PriceBookRow } from "./types";

/**
 * The price book as a screen: what the matcher sees, shown to the person.
 *
 * Everything here is derived from data the tools already return. Nothing is
 * counted from a list in the code: the axes of the coverage matrix are the
 * categories and units that occur in this workspace's tenders and in this
 * contractor's price book, united. A category nobody tenders and nobody has
 * priced does not exist here -- and a unit a GAEB file brings in appears the
 * moment the file is imported.
 *
 * The search uses the matcher's own `normalise`, so what a person finds and
 * what a proposal matches on cannot drift apart.
 */

export type Shape = { category: string; unit: string };

/** One position of one tender in this workspace, as the matrix looks at it. */
export type WorkspacePosition = Shape & {
  tender_id: string;
  tender_title: string;
  oz: string;
  text: string;
};

export const cellKey = (category: string, unit: string) => `${category}/${unit}`;

export function coverageAxes(
  entries: readonly Shape[],
  positions: readonly Shape[]
): { categories: string[]; units: string[] } {
  const all = [...entries, ...positions];
  return {
    categories: [...new Set(all.map((row) => row.category))].sort(),
    units: [...new Set(all.map((row) => row.unit))].sort()
  };
}

/** Entries per category/unit. A key that is absent is a gap, not a zero. */
export function coverageCounts(entries: readonly Shape[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of entries) {
    const key = cellKey(row.category, row.unit);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Substring on normalised text over the original wording and the keywords --
 * the same test the matcher applies to a position's text, in the same
 * normalisation. An empty query is everything.
 */
export function searchEntries(entries: readonly PriceBookRow[], query: string): PriceBookRow[] {
  const needle = normalise(query.trim());
  if (needle.length === 0) return [...entries];
  return entries.filter(
    (entry) =>
      normalise(entry.source_position_text).includes(needle) ||
      entry.keywords.some((keyword) => normalise(keyword).includes(needle))
  );
}

export type EntryGroup = {
  category: string;
  units: { unit: string; entries: PriceBookRow[] }[];
};

/** By category, within that by unit, within that in id order (the seed order). */
export function groupEntries(entries: readonly PriceBookRow[]): EntryGroup[] {
  const byCategory = new Map<string, Map<string, PriceBookRow[]>>();
  for (const entry of [...entries].sort((a, b) => a.id.localeCompare(b.id))) {
    const units = byCategory.get(entry.category) ?? new Map<string, PriceBookRow[]>();
    units.set(entry.unit, [...(units.get(entry.unit) ?? []), entry]);
    byCategory.set(entry.category, units);
  }
  return [...byCategory.keys()].sort().map((category) => ({
    category,
    units: [...byCategory.get(category)!.keys()]
      .sort()
      .map((unit) => ({ unit, entries: byCategory.get(category)!.get(unit)! }))
  }));
}
