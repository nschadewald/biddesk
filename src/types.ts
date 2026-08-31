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
