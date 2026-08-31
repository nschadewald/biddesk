/**
 * The price comparison, and the rule that keeps it lawful.
 *
 * Bids are sealed until the deadline. That is not a design preference, it is
 * how a submission works: before the closing date nobody -- not the client, not
 * the client's agent -- may look inside. So a tender that is still open returns
 * a count and the times bids arrived, and no prices at all. There is no flag to
 * override it and no tool that reads past it.
 *
 * After the deadline the comparison is ordinary arithmetic: min, max, median
 * per position, and a mark on anything more than 30 % away from the median.
 */

export const OUTLIER_PCT = 30;

export type BidderTotal = {
  bidder_id: string;
  name: string;
  total_net: number;
  complete: boolean;
  rank: number;
};

export type PositionPrice = {
  bidder_id: string;
  unit_price: number;
  line_total: number;
};

export type ComparedPosition = {
  oz: string;
  text: string;
  quantity: number;
  unit: string;
  contingency: boolean;
  prices: PositionPrice[];
  min: number | null;
  max: number | null;
  median: number | null;
  outliers: string[];
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Bidders whose unit price is more than 30 % away from the median. */
export function findOutliers(prices: PositionPrice[]): string[] {
  const centre = median(prices.map((price) => price.unit_price));
  if (centre === null || centre === 0) return [];
  return prices
    .filter((price) => Math.abs(((price.unit_price - centre) / centre) * 100) > OUTLIER_PCT)
    .map((price) => price.bidder_id);
}

export type ComparisonRow = {
  oz: string;
  text: string;
  quantity: number;
  unit: string;
  contingency: boolean;
  bidder_id: string | null;
  bidder_name: string | null;
  unit_price: number | null;
};

/**
 * Folds the flat rows of one query into the comparison. One query, no compound
 * SELECT: D1 caps the number of terms in a UNION (see docs/07).
 */
export function buildComparison(rows: ComparisonRow[]): {
  bidders: BidderTotal[];
  positions: ComparedPosition[];
} {
  const positions = new Map<string, ComparedPosition>();
  const names = new Map<string, string>();
  const totals = new Map<string, number>();
  const pricedCount = new Map<string, number>();
  let billablePositions = 0;

  for (const row of rows) {
    let position = positions.get(row.oz);
    if (position === undefined) {
      position = {
        oz: row.oz,
        text: row.text,
        quantity: row.quantity,
        unit: row.unit,
        contingency: row.contingency,
        prices: [],
        min: null,
        max: null,
        median: null,
        outliers: []
      };
      positions.set(row.oz, position);
      if (!row.contingency) billablePositions += 1;
    }

    if (row.bidder_id === null || row.unit_price === null) continue;

    names.set(row.bidder_id, row.bidder_name ?? row.bidder_id);
    const lineTotal = round2(row.quantity * row.unit_price);
    position.prices.push({
      bidder_id: row.bidder_id,
      unit_price: row.unit_price,
      line_total: lineTotal
    });

    if (!row.contingency) {
      // Contingency positions are quoted but never counted into a total.
      totals.set(row.bidder_id, round2((totals.get(row.bidder_id) ?? 0) + lineTotal));
      pricedCount.set(row.bidder_id, (pricedCount.get(row.bidder_id) ?? 0) + 1);
    }
  }

  for (const position of positions.values()) {
    const values = position.prices.map((price) => price.unit_price);
    position.min = values.length > 0 ? Math.min(...values) : null;
    position.max = values.length > 0 ? Math.max(...values) : null;
    position.median = median(values);
    position.outliers = findOutliers(position.prices);
  }

  const bidders: BidderTotal[] = [...names.entries()]
    .map(([bidder_id, name]) => ({
      bidder_id,
      name,
      total_net: totals.get(bidder_id) ?? 0,
      complete: (pricedCount.get(bidder_id) ?? 0) === billablePositions,
      rank: 0
    }))
    .sort((a, b) => a.total_net - b.total_net)
    .map((bidder, index) => ({ ...bidder, rank: index + 1 }));

  return { bidders, positions: [...positions.values()] };
}
