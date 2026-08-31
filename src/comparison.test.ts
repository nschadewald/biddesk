import { describe, expect, it } from "vitest";
import seedRaw from "../seed/seed.json?raw";
import { buildComparison, findOutliers, median, type ComparisonRow } from "./comparison";

describe("median", () => {
  it("takes the middle of an odd list and the mean of the two middle of an even one", () => {
    expect(median([11.5, 13.2, 27.8])).toBe(13.2);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBeNull();
  });
});

describe("outliers", () => {
  it("marks a price more than 30 % away from the median", () => {
    const prices = [
      { bidder_id: "B-A", unit_price: 11.5, line_total: 2760 },
      { bidder_id: "B-B", unit_price: 13.2, line_total: 3168 },
      { bidder_id: "B-C", unit_price: 27.8, line_total: 6672 }
    ];
    // Median 13.20; Colorpoint sits at more than twice that.
    expect(findOutliers(prices)).toEqual(["B-C"]);
  });

  it("marks nobody when the field is close together", () => {
    expect(
      findOutliers([
        { bidder_id: "B-A", unit_price: 10, line_total: 10 },
        { bidder_id: "B-B", unit_price: 11, line_total: 11 },
        { bidder_id: "B-C", unit_price: 12, line_total: 12 }
      ])
    ).toEqual([]);
  });
});

describe("the seed's own numbers", () => {
  type SeedPosition = { oz: string; quantity: number; contingency: boolean; unit: string };
  const seed = JSON.parse(seedRaw) as {
    tenders: { id: string; positions: SeedPosition[] }[];
    submitted_bids: Record<string, Record<string, number>>;
    submitted_bids_t14: Record<string, Record<string, number>>;
    bidders: { id: string; name: string }[];
  };

  const rowsFor = (tenderId: string, prices: Record<string, Record<string, number>>) => {
    const positions = seed.tenders.find((tender) => tender.id === tenderId)!.positions;
    const rows: ComparisonRow[] = [];
    for (const position of positions) {
      let any = false;
      for (const [bidderId, byOz] of Object.entries(prices)) {
        const unitPrice = byOz[position.oz];
        if (unitPrice === undefined) continue;
        any = true;
        rows.push({
          oz: position.oz,
          text: position.oz,
          quantity: position.quantity,
          unit: position.unit,
          contingency: position.contingency,
          bidder_id: bidderId,
          bidder_name: seed.bidders.find((bidder) => bidder.id === bidderId)!.name,
          unit_price: unitPrice
        });
      }
      if (!any) {
        rows.push({
          oz: position.oz,
          text: position.oz,
          quantity: position.quantity,
          unit: position.unit,
          contingency: position.contingency,
          bidder_id: null,
          bidder_name: null,
          unit_price: null
        });
      }
    }
    return rows;
  };

  it("reproduces the totals of the two competing bids on T-2026-014", () => {
    const { bidders } = buildComparison(rowsFor("T-2026-014", seed.submitted_bids_t14));
    const total = (id: string) => bidders.find((bidder) => bidder.bidder_id === id)!.total_net;

    // The figures from spec 13.5. They are what the client would see after the
    // deadline; until then get_price_comparison shows none of them.
    expect(total("B-B")).toBeCloseTo(16749.5, 2);
    expect(total("B-C")).toBeCloseTo(10993.5, 2);
  });

  it("finds the scaffolding outlier on the closed facade tender", () => {
    const { positions, bidders } = buildComparison(rowsFor("T-2026-009", seed.submitted_bids));
    const scaffolding = positions.find((position) => position.oz === "01.01")!;

    expect(scaffolding.median).toBeCloseTo(13.2, 2);
    expect(scaffolding.min).toBeCloseTo(11.5, 2);
    expect(scaffolding.max).toBeCloseTo(27.8, 2);
    expect(scaffolding.outliers).toEqual(["B-C"]);
    // Ranked cheapest first.
    expect(bidders.map((bidder) => bidder.rank)).toEqual([1, 2, 3]);
  });
});
