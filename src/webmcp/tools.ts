import { ApiFailure, type PriceWrite, type TenderFilters } from "../api";
import {
  getPriceBook,
  openTender,
  readTenders,
  setUnitPrices,
  suggestPrices,
  undoLastChange
} from "../store";
import type { ToolDefinition, ToolFailure, ToolResult } from "./types";

/**
 * The bidder's tools.
 *
 * The descriptions are product work, not decoration: an agent decides from them
 * whether to reach for a tool at all, and the jury reads them. Each one says
 * when to use the tool and what the visitor will see happen.
 */

const STATUS_VALUES = ["open", "closed", "all"] as const;

const invalid = (hint: string): ToolFailure => ({ ok: false, error: "invalid_input", hint });

/**
 * The declared schema says additionalProperties:false, so the tools hold to it
 * rather than quietly ignoring what they were sent. An agent that gets a named
 * reason can correct itself; an agent whose extra argument is silently dropped
 * cannot.
 */
function readObject(input: unknown, allowed: string[]): Record<string, unknown> | ToolFailure {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    return invalid("Arguments must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    return invalid(
      `Unknown argument${unexpected.length > 1 ? "s" : ""} ${unexpected.join(", ")}. Allowed: ${allowed.join(", ")}.`
    );
  }
  return record;
}

const isFailure = (value: unknown): value is ToolFailure =>
  typeof value === "object" && value !== null && (value as ToolFailure).ok === false;

/** Turns any thrown value into the one error shape the tools ever return. */
function asFailure(caught: unknown): ToolFailure {
  if (caught instanceof ApiFailure) {
    return { ok: false, error: caught.code, hint: caught.message };
  }
  return {
    ok: false,
    error: "tool_failed",
    hint: caught instanceof Error ? caught.message : "The tool could not complete."
  };
}

const listTendersTool: ToolDefinition = {
  name: "list_tenders",
  title: "List tenders",
  description:
    "Lists the tenders published in this tender room, each with its client, city, trade, " +
    "deadline, number of positions, and whether this contractor has already started or " +
    "submitted a bid on it. Use it when the user names a project, a place, a trade or a " +
    "deadline instead of a tender id, or to answer what is still open and what is due soon. " +
    "This tool only reads: it changes nothing and does not open a tender on screen. " +
    "Call get_tender with an id from this list to open one.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: [...STATUS_VALUES],
        description:
          'Restrict to tenders in this state. "open" still accepts bids, "closed" has passed its deadline. Omit or pass "all" for both.'
      },
      trade: {
        type: "string",
        description:
          'Restrict to one trade, for example "painting". Compared against the whole value, ignoring case.'
      },
      city: {
        type: "string",
        description:
          'Restrict to one city, for example "Düsseldorf". Compared against the whole value, ignoring case.'
      },
      due_before: {
        type: "string",
        description:
          "Only tenders whose deadline falls before this calendar date, written as YYYY-MM-DD."
      }
    },
    required: [],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  async execute(input): Promise<ToolResult> {
    const parsed = readObject(input, ["status", "trade", "city", "due_before"]);
    if (isFailure(parsed)) return parsed;

    const filters: TenderFilters = {};

    if (parsed.status !== undefined) {
      if (typeof parsed.status !== "string" || !STATUS_VALUES.includes(parsed.status as never)) {
        return invalid(`status must be one of ${STATUS_VALUES.join(", ")}.`);
      }
      filters.status = parsed.status;
    }
    for (const key of ["trade", "city", "due_before"] as const) {
      const value = parsed[key];
      if (value === undefined) continue;
      if (typeof value !== "string") return invalid(`${key} must be a string.`);
      filters[key] = value;
    }
    if (filters.due_before !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(filters.due_before)) {
      return invalid("due_before must be a calendar date written as YYYY-MM-DD.");
    }

    try {
      const result = await readTenders(filters);
      return {
        ok: true,
        bidder_id: result.bidder_id,
        tenders: result.tenders
      };
    } catch (caught) {
      return asFailure(caught);
    }
  }
};

const getTenderTool: ToolDefinition = {
  name: "get_tender",
  title: "Open a tender and read its bill of quantities",
  description:
    "Opens one tender and returns its complete bill of quantities: every position with its " +
    "item number, description, quantity, unit, category, whether it is a contingency " +
    "position, and this contractor's own unit price where one has already been entered. " +
    "It also returns the documents the client requires, with the date each one is valid " +
    "until. Use it before pricing, checking or discussing a tender, and whenever the user " +
    "names a tender id such as T-2026-014. Visible effect: the tender you name becomes the " +
    "tender shown on screen, replacing whatever was open. It reads and navigates; it " +
    "changes no prices. Contingency positions are quoted separately and do not count " +
    "towards the bid total.",
  inputSchema: {
    type: "object",
    properties: {
      tender_id: {
        type: "string",
        description:
          'The id of the tender to open, for example "T-2026-014". Call list_tenders first if you do not have one.'
      }
    },
    required: ["tender_id"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  async execute(input): Promise<ToolResult> {
    const parsed = readObject(input, ["tender_id"]);
    if (isFailure(parsed)) return parsed;

    const tenderId = parsed.tender_id;
    if (typeof tenderId !== "string" || tenderId.trim().length === 0) {
      return invalid("tender_id is required and must be a non-empty string.");
    }

    try {
      const detail = await openTender(tenderId.trim());
      return {
        ok: true,
        id: detail.tender.id,
        title: detail.tender.title,
        client: detail.tender.client,
        city: detail.tender.city,
        trade: detail.tender.trade,
        status: detail.tender.status,
        due_date: detail.tender.due_date,
        bidder_id: detail.bidder_id,
        my_bid_status: detail.tender.my_bid_status,
        positions: detail.positions,
        required_documents: detail.required_documents
      };
    } catch (caught) {
      return asFailure(caught);
    }
  }
};

const getPriceBookTool: ToolDefinition = {
  name: "get_price_book",
  title: "Read the contractor's own price book",
  description:
    "Returns the lines of this contractor's own price book: every entry is a real position " +
    "from one of their past projects, with the trade category, the unit, the search terms " +
    "it is filed under, the unit price, and where it came from (project, date, original " +
    "wording). Use it to answer what this contractor has charged before, to see why a " +
    "suggested price is what it is, or to check whether a kind of work is covered at all. " +
    "It only reads: it changes nothing on screen and prices nothing.",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          'Restrict to one trade category, for example "wall", "metal", "wood", "ceiling", "prep" or "labour".'
      },
      query: {
        type: "string",
        description:
          "Free text. Matched against the search terms and the original wording of each entry, ignoring case and German umlauts."
      }
    },
    required: [],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  async execute(input): Promise<ToolResult> {
    const parsed = readObject(input, ["category", "query"]);
    if (isFailure(parsed)) return parsed;

    const filters: { category?: string; query?: string } = {};
    for (const key of ["category", "query"] as const) {
      const value = parsed[key];
      if (value === undefined) continue;
      if (typeof value !== "string") return invalid(`${key} must be a string.`);
      filters[key] = value;
    }

    try {
      const result = await getPriceBook(filters);
      return { ok: true, bidder_id: result.bidder_id, entries: result.entries };
    } catch (caught) {
      return asFailure(caught);
    }
  }
};

const suggestPricesTool: ToolDefinition = {
  name: "suggest_prices",
  title: "Propose prices from the price book",
  description:
    "Proposes a unit price for positions of a tender by looking each one up in this " +
    "contractor's own price book. THIS TOOL ONLY PROPOSES: it writes nothing into the bid, " +
    "and the price cells stay empty. To actually price the tender, follow it with " +
    "set_unit_price, passing each proposal's unit_price together with its " +
    "based_on.price_book_id. A proposal is only made when a past line matches in category " +
    "AND unit AND at least one search term; otherwise the position comes back with " +
    "unit_price null and the reason \"no comparable entry in your price book\". Nothing is " +
    "ever estimated, interpolated or averaged, so a null is a real gap: name those " +
    "positions to the user and leave them empty, never fill one in yourself. Use it after " +
    "get_tender and before set_unit_price. Visible effect: each proposal appears as a " +
    "source chip beside its row, with a button the person can press instead of you.",
  inputSchema: {
    type: "object",
    properties: {
      tender_id: {
        type: "string",
        description: 'The tender to price, for example "T-2026-014".'
      },
      oz: {
        type: "array",
        items: { type: "string" },
        description:
          'Item numbers to propose prices for, for example ["03.04","04.02"]. Omit for every position of the tender.'
      }
    },
    required: ["tender_id"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  async execute(input): Promise<ToolResult> {
    const parsed = readObject(input, ["tender_id", "oz"]);
    if (isFailure(parsed)) return parsed;

    const tenderId = parsed.tender_id;
    if (typeof tenderId !== "string" || tenderId.trim().length === 0) {
      return invalid("tender_id is required and must be a non-empty string.");
    }

    let oz: string[] | undefined;
    if (parsed.oz !== undefined) {
      if (!Array.isArray(parsed.oz) || parsed.oz.some((value) => typeof value !== "string")) {
        return invalid("oz must be an array of item numbers, for example [\"03.04\"].");
      }
      oz = (parsed.oz as string[]).map((value) => value.trim()).filter((value) => value.length > 0);
    }

    try {
      const result = await suggestPrices(tenderId.trim(), oz);
      return {
        ok: true,
        bidder_id: result.bidder_id,
        tender_id: result.tender_id,
        suggestions: result.suggestions
      };
    } catch (caught) {
      return asFailure(caught);
    }
  }
};

const PRICE_ROW_FIELDS = ["oz", "unit_price", "price_book_id", "note"];

const setUnitPriceTool: ToolDefinition = {
  name: "set_unit_price",
  title: "Write unit prices into the bid",
  description:
    "Writes unit prices into this contractor's draft bid, up to 50 positions in one call. " +
    "Every price MUST carry the price_book_id of the price book line it came from, and must " +
    "be that line's price unchanged: an agent may transcribe a price, never invent, adjust " +
    "or average one. A row without a source, or with a price that differs from its source, " +
    "is refused. If a position has no comparable entry, say so and let the person type it " +
    "into the table themselves. Rows are judged one by one: the good ones are written " +
    "together and the rest come back under rejected with a machine-readable reason, so " +
    "correct those rows and call again rather than repeating the whole batch. Visible " +
    "effect: the priced rows fill in one after another, the totals bar climbs with them, " +
    "each row keeps the source chip it came from, and refused rows are marked in place. " +
    "The whole call counts as one undo step.",
  inputSchema: {
    type: "object",
    properties: {
      tender_id: {
        type: "string",
        description: 'The tender whose bid is being priced, for example "T-2026-014".'
      },
      prices: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        description: "The rows to write, one per position. Between one and fifty.",
        items: {
          type: "object",
          properties: {
            oz: {
              type: "string",
              description: 'The item number of the position, for example "02.01".'
            },
            unit_price: {
              type: "number",
              minimum: 0,
              maximum: 1000000,
              description:
                "The price of one unit, in euro. Must equal the price of the price book line named in price_book_id."
            },
            price_book_id: {
              type: "string",
              description:
                "The price book line this price comes from, copied from a proposal's based_on.price_book_id, for example PB-A-004. A price with no source is refused."
            },
            note: {
              type: "string",
              description: "An optional short remark stored with the row."
            }
          },
          required: ["oz", "unit_price", "price_book_id"],
          additionalProperties: false
        }
      }
    },
    required: ["tender_id", "prices"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false },
  async execute(input): Promise<ToolResult> {
    const parsed = readObject(input, ["tender_id", "prices"]);
    if (isFailure(parsed)) return parsed;

    const tenderId = parsed.tender_id;
    if (typeof tenderId !== "string" || tenderId.trim().length === 0) {
      return invalid("tender_id is required and must be a non-empty string.");
    }
    if (!Array.isArray(parsed.prices) || parsed.prices.length === 0) {
      return invalid("prices must be a non-empty array of rows.");
    }
    if (parsed.prices.length > 50) {
      return invalid(`At most 50 rows per call, got ${parsed.prices.length}.`);
    }

    // Shape only. Whether a row may be written is decided in one place, on the
    // server, so the tool and the buttons in the table cannot drift apart.
    const rows: PriceWrite[] = [];
    for (const entry of parsed.prices as unknown[]) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return invalid("Every row must be an object with oz, unit_price and price_book_id.");
      }
      const row = entry as Record<string, unknown>;
      const unexpected = Object.keys(row).filter((key) => !PRICE_ROW_FIELDS.includes(key));
      if (unexpected.length > 0) {
        return invalid(
          `Unknown field${unexpected.length > 1 ? "s" : ""} ${unexpected.join(", ")} in a row. Allowed: ${PRICE_ROW_FIELDS.join(", ")}.`
        );
      }
      rows.push({
        oz: typeof row.oz === "string" ? row.oz : "",
        unit_price: row.unit_price as number,
        price_book_id: typeof row.price_book_id === "string" ? row.price_book_id : null,
        ...(typeof row.note === "string" ? { note: row.note } : {})
      });
    }

    try {
      const result = await setUnitPrices(tenderId.trim(), rows, "agent");
      return {
        ok: true,
        applied: result.applied,
        rejected: result.rejected,
        totals: result.totals
      };
    } catch (caught) {
      return asFailure(caught);
    }
  }
};

const undoLastChangeTool: ToolDefinition = {
  name: "undo_last_change",
  title: "Undo the last write",
  description:
    "Takes back the most recent writes to this bid. One call to set_unit_price counts as " +
    "one step, however many rows it carried, so undoing never leaves half a batch behind. " +
    "Use it when the person asks to revert what was just done. Visible effect: the affected " +
    "rows return to what they held before and the totals bar follows. It cannot touch a bid " +
    "that has already been handed in.",
  inputSchema: {
    type: "object",
    properties: {
      steps: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "How many writes to take back, newest first. Defaults to one."
      }
    },
    required: [],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false },
  async execute(input): Promise<ToolResult> {
    const parsed = readObject(input, ["steps"]);
    if (isFailure(parsed)) return parsed;

    let steps = 1;
    if (parsed.steps !== undefined) {
      if (
        typeof parsed.steps !== "number" ||
        !Number.isInteger(parsed.steps) ||
        parsed.steps < 1 ||
        parsed.steps > 20
      ) {
        return invalid("steps must be a whole number between 1 and 20.");
      }
      steps = parsed.steps;
    }

    try {
      const result = await undoLastChange(steps);
      return { ok: true, undone: result.undone, totals: result.totals };
    } catch (caught) {
      return asFailure(caught);
    }
  }
};

/** The block registered while the visitor is in the bidder role. */
export const bidderTools: ToolDefinition[] = [
  listTendersTool,
  getTenderTool,
  getPriceBookTool,
  suggestPricesTool,
  setUnitPriceTool,
  undoLastChangeTool
];
