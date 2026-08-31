import { useSyncExternalStore } from "react";
import {
  ensureWorkspace,
  listTenders,
  loadTender,
  resetWorkspace,
  type TenderFilters
} from "./api";
import type { Role, TenderDetail, TenderList } from "./types";
import { logStore } from "./webmcp/log";

/**
 * One truth. Tools and the mouse both go through these actions, so a tender
 * opened by an agent and a tender opened by a click are the same event and the
 * table updates the same way. Nothing here is agent-specific.
 */

export const DEMO_TENDER = "T-2026-014";

export type AppState = {
  status: "booting" | "ready" | "failed";
  workspaceId: string | null;
  bidderId: string | null;
  role: Role;
  tenderId: string;
  detail: TenderDetail | null;
  failure: string | null;
};

let state: AppState = {
  status: "booting",
  workspaceId: null,
  bidderId: null,
  role: "bidder",
  tenderId: DEMO_TENDER,
  detail: null,
  failure: null
};

const listeners = new Set<() => void>();

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): AppState {
    return state;
  }
};

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function getAppState(): AppState {
  return state;
}

/** Guarantees a workspace exists, creating and seeding one if needed. */
async function requireWorkspace(): Promise<string> {
  if (state.workspaceId) return state.workspaceId;
  const workspaceId = await ensureWorkspace();
  set({ workspaceId });
  return workspaceId;
}

/**
 * Opens a tender. This is the visible effect behind the get_tender tool and
 * behind a click in the tender list: the table on screen becomes this tender.
 */
export async function openTender(tenderId: string): Promise<TenderDetail> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, detail } = await loadTender(tenderId, workspaceId);
  set({
    status: "ready",
    workspaceId: current,
    bidderId: detail.bidder_id,
    tenderId: detail.tender.id,
    detail,
    failure: null
  });
  return detail;
}

export async function readTenders(filters: TenderFilters = {}): Promise<TenderList> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await listTenders(workspaceId, filters);
  if (current !== workspaceId) set({ workspaceId: current });
  return data;
}

export async function boot(): Promise<void> {
  try {
    await openTender(state.tenderId);
  } catch (caught) {
    set({
      status: "failed",
      failure: caught instanceof Error ? caught.message : "Could not load the tender."
    });
  }
}

/**
 * Back to the seed state, then straight back onto the demo tender. The live log
 * is emptied too: after a reset the screen must look like a first visit, or the
 * second run of the demo starts from a state nobody can explain.
 */
export async function resetDemo(): Promise<void> {
  const workspaceId = await requireWorkspace();
  await resetWorkspace(workspaceId);
  logStore.clear();
  set({ tenderId: DEMO_TENDER });
  await openTender(DEMO_TENDER);
}
