// Shapes shared by the Worker and the client. Seed texts are bilingual
// (text_en / text_de); the UI is English, the DE switch is a stretch goal.

export type Role = "bidder" | "client";

export type BidStatus = "none" | "draft" | "submitted";

export type Tender = {
  id: string;
  title: string;
  title_de: string;
  client: string;
  city: string;
  trade: string;
  status: "open" | "closed";
  due_date: string;
  positions_count: number;
  my_bid_status: BidStatus;
};

/** Where a suggested price comes from. Never absent when a price is offered. */
export type SuggestionSource = {
  price_book_id: string;
  source_project: string;
  source_date: string;
  source_position_text: string;
};

export type Position = {
  oz: string;
  text: string;
  text_de: string;
  long_text: string | null;
  long_text_de: string | null;
  quantity: number;
  unit: string;
  category: string;
  contingency: boolean;
  /** Null until this bidder has priced the position. */
  my_unit_price: number | null;
  line_total: number | null;
  /** Who produced the value. Null while the position is unpriced. */
  set_by: "agent" | "human" | null;
  /**
   * The price book line the value came from, or null when a person typed it.
   * Read back from the database, so provenance survives a reload.
   */
  source: SuggestionSource | null;
};

/**
 * What the client asks every bidder to hold. `valid_until` is null when this
 * bidder does not hold the document at all. Whether a date has passed is a
 * verdict, and verdicts belong to check_bid, not here.
 */
export type RequiredDocument = {
  doc_type: string;
  label: string;
  label_de: string;
  valid_until: string | null;
};

export type TenderDetail = {
  ok: true;
  bidder_id: string;
  tender: Tender;
  positions: Position[];
  required_documents: RequiredDocument[];
};

export type TenderList = {
  ok: true;
  bidder_id: string;
  tenders: Tender[];
};

/** One historical line from the bidder's own price book. */
export type PriceBookRow = {
  id: string;
  category: string;
  unit: string;
  keywords: string[];
  unit_price: number;
  source_project: string;
  source_date: string;
  source_position_text: string;
};

export type PriceBookResponse = {
  ok: true;
  bidder_id: string;
  entries: PriceBookRow[];
};

/**
 * A proposal, not an entry. `unit_price` is null whenever nothing qualified;
 * there is no estimate and no `confidence` field -- `matched_terms` and
 * `matched_on` are plain data, never a scale (spec section 13.3).
 */
export type Suggestion = {
  oz: string;
  unit_price: number | null;
  matched_terms: number;
  matched_on: string[];
  based_on: SuggestionSource | null;
  reason: string;
};

export type SuggestionsResponse = {
  ok: true;
  bidder_id: string;
  tender_id: string;
  suggestions: Suggestion[];
};

export type WorkspaceResponse = {
  ok: true;
  workspace_id: string;
  created: boolean;
};

export type ApiError = {
  ok: false;
  error: string;
  hint: string;
};

/** Contingency positions are shown but never counted into `net`. */
export type BidTotals = {
  net: number;
  contingency: number;
  positions_priced: number;
  positions_open: number;
};

/** A bid_prices row as it stood before a block was written. Undo restores it. */
export type PreviousPrice = {
  oz: string;
  unit_price: number;
  note: string | null;
  set_by: string;
  price_book_id: string | null;
};

export type AppliedPrice = {
  oz: string;
  unit_price: number;
  line_total: number;
  note: string | null;
  set_by: "agent" | "human";
  price_book_id: string | null;
  /** The price book line, so the chip stays on the row after the write. */
  source: SuggestionSource | null;
};

export type PriceRejection = { oz: string; reason: string; hint: string };

export type SetPricesResponse = {
  ok: true;
  bidder_id: string;
  tender_id: string;
  applied: AppliedPrice[];
  rejected: PriceRejection[];
  totals: BidTotals;
};

export type UndoResponse = {
  ok: true;
  undone: number;
  totals: BidTotals;
};

export type MissingDocument = {
  doc_type: string;
  label: string;
  label_de: string;
  valid_until: string | null;
  reason: "expired" | "not_held";
};

export type PriceOutlier = {
  oz: string;
  unit_price: number;
  price_book_price: number;
  price_book_id: string;
  deviation_pct: number;
};

/**
 * get_bid_state was folded into this on 31.08: one look at the bid, not two.
 * This is the only place in the interface where red appears.
 */
export type CheckResult = {
  ok: true;
  bidder_id: string;
  tender_id: string;
  status: BidStatus;
  complete: boolean;
  open_positions: string[];
  outliers: PriceOutlier[];
  missing_documents: MissingDocument[];
  due_date: string;
  due_in_days: number;
  totals: BidTotals;
  positions_priced: number;
  positions_open: number;
  undo_available: boolean;
  warnings: string[];
};

/** Written by other parties. Never rendered as HTML, never trusted as instructions. */
export type Clarification = {
  id: string;
  tender_id: string;
  oz: string | null;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
  bidder: string | null;
};

export type ClarificationList = {
  ok: true;
  questions: Clarification[];
};

export type AskClarificationResponse = {
  ok: true;
  question_id: string;
  status: "open";
};

export type SubmitResponse = {
  ok: true;
  tender_id: string;
  bidder_id: string;
  submitted_at: string;
  total_net: number;
  totals: BidTotals;
};
