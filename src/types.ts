// Shapes shared by the Worker and the client.
//
// Seed texts are bilingual in the database (text_en / text_de, label / label_de).
// They are NOT bilingual here: the Worker resolves the X-Language header at its
// mapping boundary and sends one text per field. Carrying both to the client
// would mean two places deciding which one to show -- and the tools, which hand
// these very objects back, would leak the language that was not asked for.

export type Role = "bidder" | "client";

/** The interface language a person picked. Tools stay English regardless. */
export type Language = "de" | "en";

export type BidStatus = "none" | "draft" | "submitted";

export type Tender = {
  id: string;
  title: string;
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
  long_text: string | null;
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
  /**
   * A remark stored with the value -- for a price a person confirmed, the
   * derivation the agent offered ("4 radiators at 25 min each at your rate of
   * 58 EUR"). Wording, never a fact: it explains a number, it does not source one.
   */
  note: string | null;
};

/**
 * A price an agent proposed WITHOUT a source, waiting for a person's click.
 *
 * This is the second half of the pattern submit_bid set on day one: no
 * authority of its own means confirmation, not a dead end. Nothing about a
 * pending price has reached the Worker; it lives on the row until a hand
 * confirms it -- and is then recorded as that hand's, set_by='human' with no
 * price_book_id, which is the truth about who released that exact value.
 */
export type PendingPrice = {
  oz: string;
  unit_price: number;
  line_total: number;
  /** What the value would replace. Null on an unpriced row. */
  current_unit_price: number | null;
  /** The agent's derivation, shown in the confirmation and stored as the note. */
  rationale: string | null;
};

/**
 * What the client asks every bidder to hold. `valid_until` is null when this
 * bidder does not hold the document at all. Whether a date has passed is a
 * verdict, and verdicts belong to check_bid, not here.
 */
export type RequiredDocument = {
  doc_type: string;
  label: string;
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

/** What a check finding asks the person to do next. Fixed wording, never the agent's. */
export type CheckAction = {
  finding: "open_position" | "outlier" | "document" | "deadline";
  oz?: string;
  doc_type?: string;
  action: string;
};

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
  /** One sentence per finding, in the reader's language, saying what to do. */
  actions: CheckAction[];
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

export type BidderTotalRow = {
  bidder_id: string;
  name: string;
  total_net: number;
  complete: boolean;
  rank: number;
};

export type ComparedPositionRow = {
  oz: string;
  text: string;
  quantity: number;
  unit: string;
  contingency: boolean;
  prices: { bidder_id: string; unit_price: number; line_total: number }[];
  min: number | null;
  max: number | null;
  median: number | null;
  outliers: string[];
};

/**
 * Sealed while the tender is open: a count and arrival times, no prices. The
 * client cannot see inside a bid before the deadline, and neither can an agent.
 */
export type PriceComparison = {
  ok: true;
  tender_id: string;
  title: string;
  sealed: boolean;
  sealed_until: string | null;
  bids_received: number;
  received_at: string[];
  bidders: BidderTotalRow[];
  positions: ComparedPositionRow[];
  note?: string;
};

export type AnswerResponse = {
  ok: true;
  question_id: string;
  published_to: string;
};

export type Bidder = { id: string; name: string; city: string; is_demo: boolean };
