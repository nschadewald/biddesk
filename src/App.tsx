import { useEffect, useState } from "react";
import AgentPanel from "./AgentPanel";
import CheckPanel from "./CheckPanel";
import Clarifications from "./Clarifications";
import ClientScreen from "./ClientScreen";
import Header from "./Header";
import ImportDropZone from "./ImportDropZone";
import { formatDate, formatEuro } from "./format";
import { useCopy } from "./i18n";
import PositionRow from "./PositionRow";
import PriceBookScreen from "./PriceBookScreen";
import SubmitDialog from "./SubmitDialog";
import {
  answerClarification,
  askClarification,
  boot,
  cancelSubmit,
  closeCheck,
  confirmPendingPrice,
  confirmSubmit,
  discardPendingPrice,
  openPriceBookAt,
  requestSubmit,
  resetDemo,
  runCheck,
  selectBidder,
  selectLanguage,
  selectRole,
  setUnitPrices,
  showView,
  undoLastChange,
  useAppState
} from "./store";
import type { Position, SubmissionBlocker, Suggestion } from "./types";
import { useWebMCP } from "./webmcp/useWebMCP";

export default function App() {
  const state = useAppState();
  const copy = useCopy();
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
          language={state.language}
          clientName={state.detail?.tender.client ?? null}
          view={state.view}
          onRole={(role) => void selectRole(role)}
          onBidder={(id) => void selectBidder(id)}
          onLanguage={(language) => void selectLanguage(language)}
          onView={showView}
        />
        {state.status === "failed" ? (
          <p className="text-sm text-slate-600">
            {copy.app.loadFailed}
            {/* The technical reason comes from the Worker and stays English:
                it is an error object, and those are read by agents. */}
            {state.failure === null ? null : ` (${state.failure})`}
          </p>
        ) : state.detail === null ? (
          <p className="text-sm text-slate-500">{copy.app.loadingTender}</p>
        ) : state.role === "client" ? (
          <ClientScreen />
        ) : state.view === "priceBook" ? (
          <PriceBookScreen />
        ) : (
          <BidScreen />
        )}
      </main>
      <AgentPanel webmcp={webmcp} onReset={onReset} resetting={resetting} />

      {state.pendingSubmit && (
        <SubmitDialog
          tenderId={state.pendingSubmit.tenderId}
          totals={state.pendingSubmit.totals}
          positions={state.detail?.role === "bidder" ? state.detail.positions : []}
          onConfirm={() => void confirmSubmit()}
          onCancel={cancelSubmit}
        />
      )}
    </div>
  );
}

function BidScreen() {
  const {
    detail,
    suggestions,
    rejections,
    pendingPrices,
    tenderId,
    check,
    clarifications,
    language
  } = useAppState();
  const copy = useCopy();
  const [busy, setBusy] = useState(false);
  // The Worker projects a tender by role; only the contractor's view has prices.
  if (!detail || detail.role !== "bidder") return null;

  const { tender, positions } = detail;
  const locked = tender.my_bid_status === "submitted";
  // What stands between this draft and the dialog, as the last check saw it.
  // The button and the tool read the same list: a blocker is not a
  // confirmation, so while one exists nothing asks for a click.
  const blockers: SubmissionBlocker[] = check?.tender_id === tender.id ? (check.blockers ?? []) : [];
  const actionFor = (finding: string, key: "oz" | "doc_type", value: string) =>
    check?.actions?.find((entry) => entry.finding === finding && entry[key] === value)?.action;
  const net = sum(positions.filter((position) => !position.contingency));
  const contingency = sum(positions.filter((position) => position.contingency));
  const billable = positions.filter((position) => !position.contingency);
  const priced = billable.filter((position) => position.my_unit_price !== null).length;
  // Counted apart, shown apart: an empty contingency row is not a gap in the
  // total, and the bar says so in the same line.
  const contingencyRows = positions.filter((position) => position.contingency);
  const contingencyPriced = contingencyRows.filter((position) => position.my_unit_price !== null).length;

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
          {copy.bid.meta(
            tender.id,
            tender.client,
            tender.city,
            positions.length,
            formatDate(tender.due_date, language)
          )}
        </p>
        {/* Says where this plays. The firms, streets and projects are German
            because the case is -- GAEB files, VOB rules, a tax clearance
            certificate -- and without saying so, German proper nouns beside
            English position texts read as a translation somebody gave up on.
            It carries the "all of this is invented" notice too, which until now
            stood only in the README. */}
        <p className="mt-1 text-[11px] text-slate-400">{copy.bid.scene}</p>
      </section>

      {locked && (
        <p className="border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {copy.bid.submittedBanner}
        </p>
      )}

      <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-slate-200 py-3 text-xs">
        <Total label={copy.bid.netTotal} value={formatEuro(net)} strong />
        <Total label={copy.bid.contingencyTotal} value={formatEuro(contingency)} />
        <Total label={copy.bid.priced} value={copy.bid.pricedValue(priced, billable.length)} />
        {contingencyRows.length > 0 && (
          <span className="-ml-6 whitespace-nowrap text-slate-500">
            {copy.bid.contingencyPricedValue(contingencyPriced, contingencyRows.length)}
          </span>
        )}

        <span className="ml-auto flex items-center gap-2">
          {!locked && openProposals.length > 0 && (
            <Action onClick={() => apply(openProposals)}>
              {copy.bid.applyAll(openProposals.length)}
            </Action>
          )}
          <Action disabled={busy} onClick={() => void withBusy(() => runCheck(tenderId))}>
            {copy.bid.checkBid}
          </Action>
          {!locked && (
            <>
              <Action onClick={() => void undoLastChange(1)}>{copy.bid.undo}</Action>
              <Action
                disabled={busy || blockers.length > 0}
                onClick={() =>
                  void withBusy(async () => {
                    const result = await runCheck(tenderId);
                    if (result.status === "none") return;
                    // The check panel now shows what is in the way; the
                    // dialog waits until the list is empty.
                    if ((result.blockers ?? []).length > 0) return;
                    await requestSubmit(tenderId, result.totals);
                  })
                }
              >
                {copy.bid.submitBid}
              </Action>
            </>
          )}
        </span>
      </section>

      {!locked && blockers.length > 0 && (
        // The ways out are the check's own sentences: set the price yourself
        // or let your agent derive one, state the document's date. Not red --
        // red stays with the findings; this is the way through them.
        <section
          data-testid="submit-blockers"
          className="border-b border-slate-200 py-3 text-xs text-slate-700"
        >
          <p className="font-medium text-slate-900">{copy.submit.blocked(blockers.length)}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {blockers.map((blocker) => {
              const key = blocker.kind === "open_position" ? blocker.oz : blocker.doc_type;
              const label =
                blocker.kind === "open_position"
                  ? copy.submit.blockerOpen(blocker.oz, blocker.text)
                  : blocker.kind === "document_expired"
                    ? copy.submit.blockerExpired(blocker.label, formatDate(blocker.valid_until, language))
                    : copy.submit.blockerMissing(blocker.label);
              const action =
                blocker.kind === "open_position"
                  ? actionFor("open_position", "oz", blocker.oz)
                  : actionFor("document", "doc_type", blocker.doc_type);
              return (
                <li key={`${blocker.kind}:${key}`}>
                  <span className="text-slate-900">{label}</span>
                  {action && <span className="block text-slate-600">{action}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {check && <CheckPanel check={check} positions={positions} onClose={closeCheck} />}

      {!locked && <ImportDropZone />}

      <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
            <th className="w-20 py-2 pr-3 font-medium">{copy.bid.columnItem}</th>
            <th className="py-2 pr-3 font-medium">{copy.bid.columnDescription}</th>
            <th className="w-24 py-2 pr-3 text-right font-medium">{copy.bid.columnQuantity}</th>
            <th className="w-16 py-2 pr-3 font-medium">{copy.bid.columnUnit}</th>
            <th className="w-60 py-2 pr-3 text-right font-medium">{copy.bid.columnUnitPrice}</th>
            <th className="w-28 py-2 text-right font-medium">{copy.bid.columnTotal}</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <PositionRow
              key={position.oz}
              position={position}
              suggestion={suggestions[position.oz]}
              rejection={rejections[position.oz]}
              pending={pendingPrices[position.oz]}
              locked={locked}
              onAccept={(proposal) => apply([proposal])}
              onEnter={enter}
              onConfirm={(oz) => void confirmPendingPrice(oz)}
              onDiscard={discardPendingPrice}
              onGap={openPriceBookAt}
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
