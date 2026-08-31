import { describe, expect, it } from "vitest";
import {
  hasTraceableOrigin,
  MAX_UNIT_PRICE,
  planPriceWrites,
  type PlanContext,
  type PriceWriteInput
} from "./pricing";

const positions = new Map([
  ["01.01", { quantity: 1, contingency: false }],
  ["02.01", { quantity: 320, contingency: false }],
  ["03.04", { quantity: 4, contingency: false }],
  ["04.01", { quantity: 20, contingency: true }]
]);

const priceBook = new Map([
  ["PB-A-001", { unit_price: 480 }],
  ["PB-A-004", { unit_price: 2.9 }]
]);

const context = (over: Partial<PlanContext> = {}): PlanContext => ({
  positions,
  priceBook,
  setBy: "agent",
  bidSubmitted: false,
  ...over
});

const plan = (rows: PriceWriteInput[], over: Partial<PlanContext> = {}) =>
  planPriceWrites(rows, context(over));

const good = { oz: "01.01", unit_price: 480, price_book_id: "PB-A-001" };

describe("the invariant", () => {
  it("gives every written row a traceable origin: a price book line or a person", () => {
    const result = plan(
      [good, { oz: "02.01", unit_price: 2.9, price_book_id: "PB-A-004" }],
      { setBy: "agent" }
    );
    const byHand = plan([{ oz: "03.04", unit_price: 61 }], { setBy: "human" });

    for (const row of [...result.applied, ...byHand.applied]) {
      expect(hasTraceableOrigin(row)).toBe(true);
      // Never a third thing, and never both empty.
      expect(row.price_book_id !== null || row.set_by === "human").toBe(true);
    }
    expect(result.applied).toHaveLength(2);
    expect(byHand.applied).toHaveLength(1);
  });

  it("refuses an agent price that carries no price book line", () => {
    const result = plan([{ oz: "01.01", unit_price: 480 }]);
    expect(result.applied).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("price_without_source");
  });

  it("refuses an agent price that does not match the line it claims", () => {
    const result = plan([{ oz: "01.01", unit_price: 520, price_book_id: "PB-A-001" }]);
    expect(result.applied).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("price_does_not_match_source");
  });

  it("refuses a source that is not in this contractor's price book", () => {
    const result = plan([{ oz: "01.01", unit_price: 480, price_book_id: "PB-Z-999" }]);
    expect(result.rejected[0]?.reason).toBe("unknown_price_book_entry");
  });

  it("lets a person enter a price with no source at all", () => {
    const result = plan([{ oz: "03.04", unit_price: 61 }], { setBy: "human" });
    expect(result.applied[0]).toMatchObject({
      oz: "03.04",
      unit_price: 61,
      line_total: 244,
      set_by: "human",
      price_book_id: null
    });
  });
});

describe("row by row, no rollback for one bad line", () => {
  it("writes the good rows and returns the rest with a reason", () => {
    const result = plan([
      good,
      { oz: "99.99", unit_price: 10, price_book_id: "PB-A-001" },
      { oz: "02.01", unit_price: "cheap", price_book_id: "PB-A-004" },
      { oz: "03.04", unit_price: -1, price_book_id: "PB-A-001" },
      { oz: "04.01", unit_price: MAX_UNIT_PRICE + 1, price_book_id: "PB-A-001" }
    ]);

    expect(result.applied.map((row) => row.oz)).toEqual(["01.01"]);
    expect(result.rejected.map((row) => [row.oz, row.reason])).toEqual([
      ["99.99", "unknown_position"],
      ["02.01", "price_not_a_number"],
      ["03.04", "price_negative"],
      ["04.01", "price_too_large"]
    ]);
  });

  it("refuses both halves of an ambiguous duplicate rather than picking one", () => {
    const result = plan([
      good,
      { oz: "02.01", unit_price: 2.9, price_book_id: "PB-A-004" },
      { oz: "02.01", unit_price: 2.9, price_book_id: "PB-A-004" }
    ]);

    expect(result.applied.map((row) => row.oz)).toEqual(["01.01"]);
    expect(result.rejected.every((row) => row.reason === "duplicate_position")).toBe(true);
    expect(result.rejected).toHaveLength(2);
  });

  it("locks every row once the bid has been handed in", () => {
    const result = plan([good], { bidSubmitted: true });
    expect(result.applied).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("bid_already_submitted");
  });

  it("gives a reason a machine can act on, and a sentence a person can read", () => {
    const result = plan([{ oz: "01.01", unit_price: 520, price_book_id: "PB-A-001" }]);
    expect(result.rejected[0]?.reason).toMatch(/^[a-z_]+$/);
    expect(result.rejected[0]?.hint.length).toBeGreaterThan(20);
  });
});

describe("line totals", () => {
  it("multiplies by the quantity and rounds to the cent", () => {
    const result = plan([{ oz: "02.01", unit_price: 2.9, price_book_id: "PB-A-004" }]);
    expect(result.applied[0]?.line_total).toBe(928);
  });
});
