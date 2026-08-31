// Shapes shared by the Worker and the client. Seed texts are bilingual
// (text_en / text_de); the UI is English, the DE switch is a stretch goal.

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
};

export type TenderDetail = {
  ok: true;
  tender: Tender;
  positions: Position[];
};

export type TenderList = {
  ok: true;
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
