import type {
  ApiError,
  AnswerResponse,
  Language,
  Role,
  AskClarificationResponse,
  Bidder,
  CheckResult,
  ClarificationList,
  PriceBookResponse,
  PriceComparison,
  SetDocumentValidityResponse,
  SetPricesResponse,
  SubmitResponse,
  SuggestionsResponse,
  TenderDetail,
  TenderList,
  UndoResponse
} from "./types";

const STORAGE_KEY = "biddesk.workspace";
const LANGUAGE_KEY = "biddesk.language";

/**
 * Which bidder the requests are for. Set once when the visitor picks one in the
 * header; the Worker falls back to the demo bidder when it is not sent. Keeping
 * it here rather than threading it through ten signatures means there is one
 * place where it can be wrong.
 */
let bidderId: string | null = null;

export function setBidder(id: string | null) {
  bidderId = id;
}

/**
 * Which language the position texts and document labels should come back in.
 *
 * It travels the same way the workspace and the bidder do -- as a request
 * header, read at the moment of the fetch rather than captured when a component
 * rendered. That matters for one reason above all: the language must never
 * reach the tool layer. Tools do not take it as an argument and do not
 * re-register when it changes, so a language switch cannot fire `toolchange`.
 *
 * The Worker treats a missing header as English, so every script that talks to
 * the API without one -- the evals, seed/verify_seed.py -- is unaffected.
 */
let language: Language = "en";

/**
 * English by default: a juror arriving with no history sees the language they
 * test in. A German visitor picks once, and the choice holds per browser.
 */
export function readStoredLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    // Private windows can refuse localStorage. The choice then holds for this
    // page view, which is a clean state rather than a failure.
  }
}

/**
 * Which side of the table the requests come from.
 *
 * It travels exactly like the language: a header, read at the moment of the
 * fetch, set by the store when a person switches roles. The Worker is where
 * it counts -- it projects and refuses by this header, so the role is a
 * server-side fact and not merely a choice of which tools the page registers.
 * Without the header the Worker assumes the contractor, which is what every
 * script that talks to the API directly expects.
 */
let role: Role = "bidder";

export function setRole(next: Role) {
  role = next;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const base = { ...extra, "X-Language": language, "X-Role": role };
  // The client is nobody's contractor: the bidder choice does not travel with
  // it, so no request from the client role can name a bidder by accident.
  return bidderId === null || role === "client" ? base : { ...base, "X-Bidder-Id": bidderId };
}

// Private windows and the embedded ChatGPT browser can refuse localStorage.
// That is not an error: the visitor simply gets a fresh workspace each load,
// which is a clean state.
function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Nothing to do. The next load starts over with a fresh workspace.
  }
}

/**
 * Returns a workspace id that is known to exist on the server. Adopts the one
 * in localStorage when it is still there, otherwise creates and seeds a new
 * one. Never reports failure to the caller as a missing workspace.
 */
export async function ensureWorkspace(adoptStored = true): Promise<string> {
  const stored = adoptStored ? readStoredId() : null;
  const response = await fetch("/api/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(stored ? { id: stored } : {})
  });
  const data = (await response.json()) as { workspace_id: string };
  storeId(data.workspace_id);
  return data.workspace_id;
}

export async function resetWorkspace(workspaceId: string): Promise<void> {
  await fetch(`/api/workspace/${workspaceId}/reset`, { method: "POST" });
}

/** Carries the machine-readable error code so tools can pass it on unchanged. */
export class ApiFailure extends Error {
  readonly code: string;

  constructor(code: string, hint: string) {
    super(hint);
    this.name = "ApiFailure";
    this.code = code;
  }
}

async function get<T>(path: string, workspaceId: string): Promise<T | ApiError> {
  const response = await fetch(path, { headers: headers({ "X-Workspace-Id": workspaceId }) });
  return (await response.json()) as T | ApiError;
}

/**
 * Reads through the workspace. If the workspace vanished between two requests
 * -- the daily cleanup sweeps anything older than seven days -- a new one is
 * seeded and the read is retried once. The visitor sees data, not a failure.
 */
async function readThroughWorkspace<T extends { ok: true }>(
  path: string,
  workspaceId: string
): Promise<{ workspaceId: string; data: T }> {
  let currentWorkspaceId = workspaceId;
  let result = await get<T>(path, currentWorkspaceId);

  if (result.ok === false && result.error === "unknown_workspace") {
    currentWorkspaceId = await ensureWorkspace(false);
    result = await get<T>(path, currentWorkspaceId);
  }

  if (result.ok === false) {
    throw new ApiFailure(result.error, result.hint);
  }
  return { workspaceId: currentWorkspaceId, data: result };
}

export type TenderFilters = {
  status?: string;
  trade?: string;
  city?: string;
  due_before?: string;
};

export async function listTenders(workspaceId: string, filters: TenderFilters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.length > 0) query.set(key, value);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return readThroughWorkspace<TenderList>(`/api/tenders${suffix}`, workspaceId);
}

export type PriceBookFilters = { category?: string; query?: string };

export async function readPriceBook(workspaceId: string, filters: PriceBookFilters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.length > 0) query.set(key, value);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return readThroughWorkspace<PriceBookResponse>(`/api/price-book${suffix}`, workspaceId);
}

export async function readSuggestions(workspaceId: string, tenderId: string, oz?: string[]) {
  const suffix = oz?.length ? `?oz=${encodeURIComponent(oz.join(","))}` : "";
  return readThroughWorkspace<SuggestionsResponse>(
    `/api/tenders/${encodeURIComponent(tenderId)}/suggestions${suffix}`,
    workspaceId
  );
}

async function post<T extends { ok: true }>(
  path: string,
  workspaceId: string,
  body: unknown
): Promise<{ workspaceId: string; data: T }> {
  const send = (id: string) =>
    fetch(path, {
      method: "POST",
      headers: headers({ "content-type": "application/json", "X-Workspace-Id": id }),
      body: JSON.stringify(body)
    }).then((response) => response.json() as Promise<T | ApiError>);

  let currentWorkspaceId = workspaceId;
  let result = await send(currentWorkspaceId);

  if (result.ok === false && result.error === "unknown_workspace") {
    currentWorkspaceId = await ensureWorkspace(false);
    result = await send(currentWorkspaceId);
  }
  if (result.ok === false) {
    throw new ApiFailure(result.error, result.hint);
  }
  return { workspaceId: currentWorkspaceId, data: result };
}

export type PriceWrite = {
  oz: string;
  unit_price: number;
  note?: string;
  price_book_id?: string | null;
};

export async function writeUnitPrices(
  workspaceId: string,
  tenderId: string,
  prices: PriceWrite[],
  setBy: "agent" | "human"
) {
  return post<SetPricesResponse>(
    `/api/tenders/${encodeURIComponent(tenderId)}/prices`,
    workspaceId,
    { prices, set_by: setBy }
  );
}

export async function undoChanges(workspaceId: string, tenderId: string, steps: number) {
  return post<UndoResponse>(`/api/tenders/${encodeURIComponent(tenderId)}/undo`, workspaceId, {
    steps
  });
}

export async function readCheck(workspaceId: string, tenderId: string) {
  return readThroughWorkspace<CheckResult>(
    `/api/tenders/${encodeURIComponent(tenderId)}/check`,
    workspaceId
  );
}

export type ClarificationFilters = { tender_id?: string; status?: string };

export async function readClarifications(
  workspaceId: string,
  filters: ClarificationFilters = {}
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.length > 0) query.set(key, value);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return readThroughWorkspace<ClarificationList>(`/api/clarifications${suffix}`, workspaceId);
}

export async function writeClarification(
  workspaceId: string,
  body: { tender_id: string; oz?: string | null; question: string }
) {
  return post<AskClarificationResponse>("/api/clarifications", workspaceId, body);
}

export async function submitBid(workspaceId: string, tenderId: string) {
  return post<SubmitResponse>(
    `/api/tenders/${encodeURIComponent(tenderId)}/submit`,
    workspaceId,
    {}
  );
}

/** The click on a document confirmation. The only way a stated date is written. */
export async function writeDocumentValidity(
  workspaceId: string,
  docType: string,
  validUntil: string
) {
  return post<SetDocumentValidityResponse>(
    `/api/documents/${encodeURIComponent(docType)}`,
    workspaceId,
    { valid_until: validUntil }
  );
}

export async function readBidders(workspaceId: string) {
  return readThroughWorkspace<{ ok: true; bidders: Bidder[] }>("/api/bidders", workspaceId);
}

export async function readComparison(workspaceId: string, tenderId: string) {
  return readThroughWorkspace<PriceComparison>(
    `/api/tenders/${encodeURIComponent(tenderId)}/comparison`,
    workspaceId
  );
}

export async function writeAnswer(workspaceId: string, questionId: string, answer: string) {
  return post<AnswerResponse>(
    `/api/clarifications/${encodeURIComponent(questionId)}/answer`,
    workspaceId,
    { answer }
  );
}

export async function importTender(
  workspaceId: string,
  tender: { title: string; reference: string | null; client: string | null; positions: unknown[] }
) {
  return post<{ ok: true; tender_id: string; title: string; positions: number }>(
    "/api/tenders/import",
    workspaceId,
    tender
  );
}

export async function loadTender(tenderId: string, workspaceId: string) {
  const { workspaceId: id, data } = await readThroughWorkspace<TenderDetail>(
    `/api/tenders/${encodeURIComponent(tenderId)}`,
    workspaceId
  );
  return { workspaceId: id, detail: data };
}
