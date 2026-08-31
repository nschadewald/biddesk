import { useSyncExternalStore } from "react";
import {
  ensureWorkspace,
  listTenders,
  loadTender,
  readCheck,
  readClarifications,
  readPriceBook,
  readSuggestions,
  resetWorkspace,
  submitBid,
  writeClarification,
  undoChanges,
  writeUnitPrices,
  type ClarificationFilters,
  type PriceBookFilters,
  type PriceWrite,
  type TenderFilters
} from "./api";
import type {
  AppliedPrice,
  AskClarificationResponse,
  BidTotals,
  CheckResult,
  Clarification,
  ClarificationList,
  PriceBookResponse,
  PriceRejection,
  Role,
  SetPricesResponse,
  SubmitResponse,
  Suggestion,
  SuggestionsResponse,
  TenderDetail,
  TenderList,
  UndoResponse
} from "./types";
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
  /** Proposals for the open tender, keyed by item number. Never entered values. */
  suggestions: Record<string, Suggestion>;
  /**
   * Rows a write refused, keyed by item number. They stay in the row with their
   * reason until that row is written successfully -- a message that disappears
   * by itself is a message nobody read.
   */
  rejections: Record<string, PriceRejection>;
  /** The last check. The only place in the interface where red appears. */
  check: CheckResult | null;
  /** Questions and answers. Written by other parties; printed, never obeyed. */
  clarifications: Clarification[];
  /** Open confirmation dialog. A bid is handed in by a hand, never by a tool. */
  pendingSubmit: { tenderId: string; totals: BidTotals } | null;
  failure: string | null;
};

let state: AppState = {
  status: "booting",
  workspaceId: null,
  bidderId: null,
  role: "bidder",
  tenderId: DEMO_TENDER,
  detail: null,
  suggestions: {},
  rejections: {},
  check: null,
  clarifications: [],
  pendingSubmit: null,
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
    // Proposals belong to the tender they were made for. Opening another one
    // must not leave someone else's chips hanging on these rows.
    suggestions: detail.tender.id === state.tenderId ? state.suggestions : {},
    rejections: detail.tender.id === state.tenderId ? state.rejections : {},
    // A check describes one bid at one moment. Another tender invalidates it.
    check: detail.tender.id === state.tenderId ? state.check : null,
    failure: null
  });
  void loadClarifications({ tender_id: detail.tender.id });
  return detail;
}

export async function readTenders(filters: TenderFilters = {}): Promise<TenderList> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await listTenders(workspaceId, filters);
  if (current !== workspaceId) set({ workspaceId: current });
  return data;
}

/**
 * Fetches proposals and puts them on the rows. Nothing is entered: the chip sits
 * next to an empty price cell until a human takes it over.
 */
export async function suggestPrices(
  tenderId: string,
  oz?: string[]
): Promise<SuggestionsResponse> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await readSuggestions(workspaceId, tenderId, oz);

  const patch: Partial<AppState> = current === workspaceId ? {} : { workspaceId: current };
  if (tenderId === state.tenderId) {
    const merged = { ...state.suggestions };
    for (const suggestion of data.suggestions) merged[suggestion.oz] = suggestion;
    patch.suggestions = merged;
  }
  set(patch);

  return data;
}

export async function getPriceBook(filters: PriceBookFilters = {}): Promise<PriceBookResponse> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await readPriceBook(workspaceId, filters);
  if (current !== workspaceId) set({ workspaceId: current });
  return data;
}

/** Someone asked not to be animated at. Then we do not animate. */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const ROLL_IN_MS = 70;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function writeRow(tenderId: string, row: AppliedPrice) {
  if (state.detail === null || state.detail.tender.id !== tenderId) return;
  const positions = state.detail.positions.map((position) =>
    position.oz === row.oz
      ? {
          ...position,
          my_unit_price: row.unit_price,
          line_total: row.line_total,
          // Provenance travels with the value. The chip must not vanish at the
          // moment the number starts to count.
          set_by: row.set_by,
          source: row.source
        }
      : position
  );
  const rejections = { ...state.rejections };
  delete rejections[row.oz];
  set({ detail: { ...state.detail, positions }, rejections });
}

/**
 * One call stays one call. On screen it unrolls line by line, roughly 70 ms
 * apart, so the eye can follow and the totals bar visibly climbs with it. The
 * two positions that stay empty only mean something against that contrast:
 * everything fills, two rows stay put.
 */
async function rollIn(tenderId: string, rows: AppliedPrice[]) {
  if (prefersReducedMotion()) {
    for (const row of rows) writeRow(tenderId, row);
    return;
  }
  for (const row of rows) {
    writeRow(tenderId, row);
    await wait(ROLL_IN_MS);
  }
}

/**
 * The one way a price gets into a bid. The tool calls it, the accept button on a
 * chip calls it, and "apply all" calls it. `setBy` says who produced the value,
 * and the Worker refuses an agent price that carries no price book line.
 */
export async function setUnitPrices(
  tenderId: string,
  prices: PriceWrite[],
  setBy: "agent" | "human"
): Promise<SetPricesResponse> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await writeUnitPrices(
    workspaceId,
    tenderId,
    prices,
    setBy
  );

  const patch: Partial<AppState> = current === workspaceId ? {} : { workspaceId: current };
  if (data.rejected.length > 0 && tenderId === state.tenderId) {
    const rejections = { ...state.rejections };
    for (const rejection of data.rejected) rejections[rejection.oz] = rejection;
    patch.rejections = rejections;
  }
  set(patch);

  // The caller gets the result at once; the screen catches up on its own.
  void rollIn(tenderId, data.applied);

  return data;
}

/** Takes back whole blocks, never single rows out of one. */
export async function undoLastChange(steps = 1): Promise<UndoResponse> {
  const workspaceId = await requireWorkspace();
  const tenderId = state.tenderId;
  const { workspaceId: current, data } = await undoChanges(workspaceId, tenderId, steps);
  if (current !== workspaceId) set({ workspaceId: current });
  // Re-read rather than guess: undo restores whatever the block replaced.
  await openTender(tenderId);
  set({ rejections: {} });
  return data;
}

/** Reads the bid back and says what is off. Nothing is written. */
export async function runCheck(tenderId: string): Promise<CheckResult> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await readCheck(workspaceId, tenderId);
  set({
    ...(current === workspaceId ? {} : { workspaceId: current }),
    ...(tenderId === state.tenderId ? { check: data } : {})
  });
  return data;
}

/** Puts the check result away. The bid is untouched; this is a view concern. */
export function closeCheck(): void {
  set({ check: null });
}

export async function loadClarifications(
  filters: ClarificationFilters = {}
): Promise<ClarificationList> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await readClarifications(workspaceId, filters);
  const patch: Partial<AppState> = current === workspaceId ? {} : { workspaceId: current };
  if (filters.tender_id === undefined || filters.tender_id === state.tenderId) {
    patch.clarifications = data.questions;
  }
  set(patch);
  return data;
}

export async function askClarification(body: {
  tender_id: string;
  oz?: string | null;
  question: string;
}): Promise<AskClarificationResponse> {
  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await writeClarification(workspaceId, body);
  if (current !== workspaceId) set({ workspaceId: current });
  await loadClarifications({ tender_id: body.tender_id });
  return data;
}

/**
 * Opens the confirmation dialog and waits for a person. This is the whole point
 * of the destructive tool: `confirm:true` is a request to ask, not permission to
 * act. Nothing is handed in until confirmSubmit runs, and only a click runs it.
 */
let awaitingConfirmation: ((value: SubmitResponse | null) => void) | null = null;

export function requestSubmit(tenderId: string, totals: BidTotals) {
  return new Promise<SubmitResponse | null>((resolve) => {
    awaitingConfirmation?.(null);
    awaitingConfirmation = resolve;
    set({ pendingSubmit: { tenderId, totals } });
  });
}

export async function confirmSubmit(): Promise<SubmitResponse | null> {
  const pending = state.pendingSubmit;
  if (pending === null) return null;

  const workspaceId = await requireWorkspace();
  const { workspaceId: current, data } = await submitBid(workspaceId, pending.tenderId);
  set({ ...(current === workspaceId ? {} : { workspaceId: current }), pendingSubmit: null });
  // Re-read: the table locks and submit_bid is withdrawn off the bid status.
  await openTender(pending.tenderId);

  awaitingConfirmation?.(data);
  awaitingConfirmation = null;
  return data;
}

export function cancelSubmit(): void {
  set({ pendingSubmit: null });
  awaitingConfirmation?.(null);
  awaitingConfirmation = null;
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
  set({
    tenderId: DEMO_TENDER,
    suggestions: {},
    rejections: {},
    check: null,
    pendingSubmit: null
  });
  await openTender(DEMO_TENDER);
}
