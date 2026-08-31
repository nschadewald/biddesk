import type {
  ApiError,
  PriceBookResponse,
  SetPricesResponse,
  SuggestionsResponse,
  TenderDetail,
  TenderList,
  UndoResponse
} from "./types";

const STORAGE_KEY = "biddesk.workspace";

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
  const response = await fetch(path, { headers: { "X-Workspace-Id": workspaceId } });
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
      headers: { "content-type": "application/json", "X-Workspace-Id": id },
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

export async function loadTender(tenderId: string, workspaceId: string) {
  const { workspaceId: id, data } = await readThroughWorkspace<TenderDetail>(
    `/api/tenders/${encodeURIComponent(tenderId)}`,
    workspaceId
  );
  return { workspaceId: id, detail: data };
}
