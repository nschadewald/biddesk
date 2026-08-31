import type { ApiError, TenderDetail } from "./types";

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

async function get<T>(path: string, workspaceId: string): Promise<T | ApiError> {
  const response = await fetch(path, { headers: { "X-Workspace-Id": workspaceId } });
  return (await response.json()) as T | ApiError;
}

/**
 * Reads a tender. If the workspace vanished between two requests -- the daily
 * cleanup sweeps anything older than seven days -- a new one is seeded and the
 * read is retried once. The visitor sees data, not a failure.
 */
export async function loadTender(
  tenderId: string,
  workspaceId: string
): Promise<{ workspaceId: string; detail: TenderDetail }> {
  let currentWorkspaceId = workspaceId;
  let result = await get<TenderDetail>(`/api/tenders/${tenderId}`, currentWorkspaceId);

  if ("ok" in result && result.ok === false && result.error === "unknown_workspace") {
    currentWorkspaceId = await ensureWorkspace(false);
    result = await get<TenderDetail>(`/api/tenders/${tenderId}`, currentWorkspaceId);
  }

  if (result.ok === false) {
    throw new Error(result.hint);
  }
  return { workspaceId: currentWorkspaceId, detail: result };
}
