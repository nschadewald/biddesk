/**
 * The price suggestion rule. Deterministic, explainable, no model anywhere near
 * it: a price that lands in a bid is a business fact, and the agent may fetch,
 * read and calculate those but never produce one.
 *
 * `seed/verify_seed.py` holds the same rule as an executable reference. The two
 * must agree; `src/matching.test.ts` checks that against the seed data itself.
 *
 * Three conditions, all three necessary:
 *
 *  1. Category AND unit must match. There is no fallback to "the unit fits":
 *     that fallback once turned "radiators, metal, per piece" into the price of
 *     a door, 148 EUR, which is exactly the invented number this product must
 *     never produce.
 *  2. Keywords match as SUBSTRINGS of the normalised German short text, not as
 *     whole words. German compounds demand it: "Schimmelbehandlung" contains
 *     "schimmel" and "behandlung" without being equal to either.
 *  3. At least one keyword must hit. Without that, the choice fell to the first
 *     entry of the category and would have offered 3,20 EUR (cleaning) for mould
 *     remediation -- with a source chip pointing at the wrong line, which is
 *     worse than a gap.
 */

export type PriceBookEntry = {
  id: string;
  category: string;
  unit: string;
  keywords: string[];
  unit_price: number;
  source_project: string;
  source_date: string;
  source_position_text: string;
};

export type MatchTarget = {
  category: string;
  unit: string;
  /** The German short text. The keywords are German, so the match is German. */
  text_de: string;
};

export type Match = {
  entry: PriceBookEntry;
  matchedKeywords: string[];
};

/** Lower case first, then the umlauts, exactly as the reference does. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

/**
 * The best entry for one position, or null when nothing qualifies.
 *
 * Ties go to the earlier entry, so the order the entries arrive in matters and
 * must stay the seed order (the Worker reads them ordered by id).
 */
export function findMatch(entries: PriceBookEntry[], position: MatchTarget): Match | null {
  const text = normalise(position.text_de);
  let best: Match | null = null;
  let bestCount = 0;

  for (const entry of entries) {
    if (entry.category !== position.category || entry.unit !== position.unit) continue;
    const matchedKeywords = entry.keywords.filter((keyword) => text.includes(normalise(keyword)));
    if (matchedKeywords.length > bestCount) {
      best = { entry, matchedKeywords };
      bestCount = matchedKeywords.length;
    }
  }

  return bestCount === 0 ? null : best;
}

/** True when the price book holds any line of this category and unit at all. */
export function hasComparableShape(entries: PriceBookEntry[], position: MatchTarget): boolean {
  return entries.some(
    (entry) => entry.category === position.category && entry.unit === position.unit
  );
}
