import { ApiFailure, type TenderFilters } from "../api";
import { openTender, readTenders } from "../store";
import type { ToolDefinition, ToolFailure, ToolResult } from "./types";

/**
 * The bidder's read tools.
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

/** Registered while the visitor is in the bidder role. */
export const bidderReadTools: ToolDefinition[] = [listTendersTool, getTenderTool];
