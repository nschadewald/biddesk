import { useEffect, useState } from "react";
import AgentPanel from "./AgentPanel";
import CheckPanel from "./CheckPanel";
import Clarifications from "./Clarifications";
import ClientScreen from "./ClientScreen";
import Header from "./Header";
import ImportDropZone from "./ImportDropZone";
import { formatDate, formatEuro } from "./format";
import PositionRow from "./PositionRow";
import SubmitDialog from "./SubmitDialog";
import {
  answerClarification,
  askClarification,
  boot,
  cancelSubmit,
  closeCheck,
  confirmSubmit,
  requestSubmit,
  resetDemo,
  runCheck,
  selectBidder,
  selectRole,
  setUnitPrices,
  undoLastChange,
  useAppState
} from "./store";
import type { Position, Suggestion } from "./types";
import { useWebMCP } from "./webmcp/useWebMCP";

export default function App() {
  const state = useAppState();
  const submitted = state.detail?.tender.my_bid_status === "submitted";
  // submit_bid is registered only while there is still a bid to hand in.
  const webmcp = useWebMCP(state.role, !submitted);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void boot();
  }, []);

  async function onReset() {
    setResetting(true);
    try {
      await resetDemo();
    } finally {
      setResetting(false);
    }
  }

  return (
    // A real two-column grid, not a floating panel. `minmax(0,1fr)` is what
    // stops the table column from growing past its share and sliding under the
    // panel: without the 0 minimum, a wide table sets the column's own width.
    <div className="grid min-h-screen grid-cols-1 text-slate-900 lg:grid-cols-[minmax(0,1fr)_auto]">
      <main className="flex min-w-0 flex-col gap-4 px-6 py-8">
        <Header
          role={state.role}
          bidders={state.bidders}
          bidderId={state.bidderId}
          onRole={(role) => void selectRole(role)}
          onBidder={(id) => void selectBidder(id)}
        />
        {state.status === "failed" ? (
          <p className="text-sm text-slate-600">{state.failure}</p>
        ) : state.detail === null ? (
          <p className="text-sm text-slate-500">Loading tender…</p>
        ) : state.role === "client" ? (
          <ClientScreen />
        ) : (
          <BidScreen />
        )}
      </main>
      <AgentPanel webmcp={webmcp} onReset={onReset} resetting={resetting} />

      {state.pendingSubmit && (
        <SubmitDialog
          tenderId={state.pendingSubmit.tenderId}
          totals={state.pendingSubmit.totals}
          onConfirm={() => void confirmSubmit()}
          onCancel={cancelSubmit}
        />
      )}
    </div>
  );
}

function BidScreen() {
  const { detail, suggestions, rejections, tenderId, check, clarifications } = useAppState();
  const [busy, setBusy] = useState(false);
  if (!detail) return null;

  const { tender, positions } = detail;
  const locked = tender.my_bid_status === "submitted";
  const net = sum(positions.filter((position) => !position.contingency));
  const contingency = sum(positions.filter((position) => position.contingency));
  const billable = positions.filter((position) => !position.contingency);
  const priced = billable.filter((position) => position.my_unit_price !== null).length;

  const openProposals = positions
    .map((position) => suggestions[position.oz])
    .filter(
      (suggestion): suggestion is Suggestion =>
        suggestion !== undefined &&
        suggestion.unit_price !== null &&
        positions.find((position) => position.oz === suggestion.oz)?.my_unit_price === null
    );

  // The buttons and the tools go through the same store actions. There is no
  // second path into the bid, so the two cannot drift apart.
  const apply = (proposals: Suggestion[]) =>
    void setUnitPrices(
      tenderId,
      proposals.map((proposal) => ({
        oz: proposal.oz,
        unit_price: proposal.unit_price!,
        price_book_id: proposal.based_on!.price_book_id
      })),
      "human"
    );

  const enter = (oz: string, unitPrice: number) =>
    void setUnitPrices(tenderId, [{ oz, unit_price: unitPrice }], "human");

  async function withBusy(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-medium">{tender.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {tender.id} · {tender.client} · {tender.city} · {positions.length} positions · due{" "}
          {formatDate(tender.due_date)}
        </p>
      </section>

      {locked && (
        <p className="border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Submitted. The prices are locked and cannot be changed.
        </p>
      )}

      <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-slate-200 py-3 text-xs">
        <Total label="Net total" value={formatEuro(net)} strong />
        <Total label="Contingency positions" value={formatEuro(contingency)} />
        <Total label="Priced" value={`${priced} of ${billable.length}`} />

        <span className="ml-auto flex items-center gap-2">
          {!locked && openProposals.length > 0 && (
            <Action onClick={() => apply(openProposals)}>
              Apply all suggestions ({openProposals.length})
            </Action>
          )}
          <Action disabled={busy} onClick={() => void withBusy(() => runCheck(tenderId))}>
            Check bid
          </Action>
          {!locked && (
            <>
              <Action onClick={() => void undoLastChange(1)}>Undo</Action>
              <Action
                disabled={busy}
                onClick={() =>
                  void withBusy(async () => {
                    const result = await runCheck(tenderId);
                    if (result.status === "none") return;
                    await requestSubmit(tenderId, result.totals);
                  })
                }
              >
                Submit bid
              </Action>
            </>
          )}
        </span>
      </section>

      {check && <CheckPanel check={check} onClose={closeCheck} />}

      {!locked && <ImportDropZone />}

      <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
            <th className="w-20 py-2 pr-3 font-medium">Item</th>
            <th className="py-2 pr-3 font-medium">Description</th>
            <th className="w-24 py-2 pr-3 text-right font-medium">Qty</th>
            <th className="w-16 py-2 pr-3 font-medium">Unit</th>
            <th className="w-60 py-2 pr-3 text-right font-medium">Unit price</th>
            <th className="w-28 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <PositionRow
              key={position.oz}
              position={position}
              suggestion={suggestions[position.oz]}
              rejection={rejections[position.oz]}
              locked={locked}
              onAccept={(proposal) => apply([proposal])}
              onEnter={enter}
            />
          ))}
        </tbody>
      </table>
      </div>

      <Clarifications
        role="bidder"
        questions={clarifications}
        onAsk={(input) => askClarification({ tender_id: tenderId, ...input })}
        onAnswer={(questionId, answer) => answerClarification(questionId, answer)}
      />
    </>
  );
}

/** Contingency positions are quoted but never counted into the bid total. */
function sum(positions: Position[]): number {
  const total = positions.reduce((carry, position) => carry + (position.line_total ?? 0), 0);
  return Math.round(total * 100) / 100;
}

function Action({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          strong
            ? "text-sm font-semibold tabular-nums text-slate-900"
            : "text-sm tabular-nums text-slate-700"
        }
      >
        {value}
      </span>
    </span>
  );
}
