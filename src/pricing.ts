/**
 * What may be written into a bid, and what may not.
 *
 * A price that lands in a bid is a business fact. The agent may fetch one, read
 * one and calculate with one, but never produce one. That line is not a promise
 * in a description here, it is a rule with a rejection code behind it, and the
 * result is checkable in the database:
 *
 *     every row of bid_prices has a price_book_id OR set_by = 'human'
 *
 * never a third thing and never both empty. `planPriceWrites` is the only place
 * that decides what goes in, so the invariant holds by construction.
 *
 * Partial writes are the point (spec section 11.2): a draft bid is not a
 * financial transaction. Rolling eleven good rows back because row seven was
 * unusable forces a repeat and looks broken on screen. Each row is judged on its
 * own; the good ones go in together.
 */

export const MAX_UNIT_PRICE = 1_000_000;
export const MAX_ROWS_PER_CALL = 50;

export type PriceWriteInput = {
  oz: unknown;
  unit_price: unknown;
  note?: unknown;
  price_book_id?: unknown;
};

export type SetBy = "agent" | "human";

export type PlannedWrite = {
  oz: string;
  unit_price: number;
  line_total: number;
  note: string | null;
  set_by: SetBy;
  price_book_id: string | null;
};

export type Rejection = {
  oz: string;
  /** Machine-readable, so an agent can fix the row instead of guessing. */
  reason: string;
  hint: string;
};

export type PositionFacts = {
  quantity: number;
  contingency: boolean;
};

export type PriceBookFacts = {
  unit_price: number;
};

export type PlanContext = {
  positions: Map<string, PositionFacts>;
  priceBook: Map<string, PriceBookFacts>;
  setBy: SetBy;
  bidSubmitted: boolean;
};

export type Plan = {
  applied: PlannedWrite[];
  rejected: Rejection[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function reject(oz: string, reason: string, hint: string): Rejection {
  return { oz, reason, hint };
}

export function planPriceWrites(rows: PriceWriteInput[], context: PlanContext): Plan {
  const applied: PlannedWrite[] = [];
  const rejected: Rejection[] = [];

  // Ambiguity is refused rather than resolved: if the same position appears
  // twice in one call, we cannot know which one was meant, so neither goes in.
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (typeof row?.oz === "string") {
      seen.set(row.oz, (seen.get(row.oz) ?? 0) + 1);
    }
  }

  for (const row of rows) {
    const oz = typeof row?.oz === "string" ? row.oz.trim() : "";

    if (oz.length === 0) {
      rejected.push(reject("", "missing_position", "Every row needs an oz, the item number."));
      continue;
    }
    if (context.bidSubmitted) {
      rejected.push(
        reject(oz, "bid_already_submitted", "This bid has been handed in and is locked.")
      );
      continue;
    }
    if ((seen.get(oz) ?? 0) > 1) {
      rejected.push(
        reject(oz, "duplicate_position", `${oz} appears more than once in this call.`)
      );
      continue;
    }

    const position = context.positions.get(oz);
    if (!position) {
      rejected.push(reject(oz, "unknown_position", `${oz} is not a position of this tender.`));
      continue;
    }

    const price = row.unit_price;
    if (typeof price !== "number" || !Number.isFinite(price)) {
      rejected.push(reject(oz, "price_not_a_number", "unit_price must be a number."));
      continue;
    }
    if (price < 0) {
      rejected.push(reject(oz, "price_negative", "unit_price cannot be negative."));
      continue;
    }
    if (price > MAX_UNIT_PRICE) {
      rejected.push(
        reject(oz, "price_too_large", `unit_price cannot exceed ${MAX_UNIT_PRICE}.`)
      );
      continue;
    }

    const sourceId = typeof row.price_book_id === "string" ? row.price_book_id.trim() : "";

    if (sourceId.length > 0 && !context.priceBook.has(sourceId)) {
      rejected.push(
        reject(
          oz,
          "unknown_price_book_entry",
          `${sourceId} is not a line in this contractor's price book.`
        )
      );
      continue;
    }

    // The two rules that make the invariant provable rather than merely labelled.
    if (context.setBy === "agent") {
      if (sourceId.length === 0) {
        rejected.push(
          reject(
            oz,
            "price_without_source",
            "A price written by an agent must carry the price_book_id it came from. If there is no comparable entry, the person enters the price in the table."
          )
        );
        continue;
      }
      const source = context.priceBook.get(sourceId)!;
      if (Math.abs(source.unit_price - price) > 0.005) {
        rejected.push(
          reject(
            oz,
            "price_does_not_match_source",
            `Price book line ${sourceId} is ${source.unit_price}, not ${price}. Write the price as it stands, or let the person change it.`
          )
        );
        continue;
      }
    }

    applied.push({
      oz,
      unit_price: round2(price),
      line_total: round2(position.quantity * price),
      note: typeof row.note === "string" && row.note.trim().length > 0 ? row.note.trim() : null,
      set_by: context.setBy,
      price_book_id: sourceId.length > 0 ? sourceId : null
    });
  }

  return { applied, rejected };
}

/** The property the whole product rests on, as a function anyone can run. */
export function hasTraceableOrigin(row: Pick<PlannedWrite, "price_book_id" | "set_by">): boolean {
  return row.price_book_id !== null || row.set_by === "human";
}
