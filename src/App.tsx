import { useEffect, useState } from "react";
import AgentPanel, { StatusBar } from "./AgentPanel";
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

/** True from 1240 px up: two columns, the agent panel open as the default. */
export function useWideViewport(): boolean {
  const [wide, setWide] = useState(() => {
    try {
      return window.matchMedia("(min-width: 1240px)").matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia("(min-width: 1240px)");
    } catch {
      return;
    }
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return wide;
}

/**
 * The shell: header, then the working area beside the agent panel, then a
 * status bar that never scrolls away. The status bar is the entry aid -- a
 * visitor whose browser has no WebMCP has to be able to tell that from a page
 * that does nothing, and the count 11 -> 10 after the hand-in has to be
 * visible with the panel folded.
 */
export default function App() {
  const state = useAppState();
  const copy = useCopy();
  const submitted = state.detail?.tender.my_bid_status === "submitted";
  // submit_bid is registered only while there is still a bid to hand in.
  const webmcp = useWebMCP(state.role, !submitted);
  const [resetting, setResetting] = useState(false);
  const wide = useWideViewport();
  // Open where there is room for it, folded away where there is not -- until
  // somebody decides otherwise, and then their decision holds.
  const [panelChoice, setPanelChoice] = useState<boolean | null>(null);
  const panelOpen = panelChoice ?? wide;

  useEffect(() => {
    void boot();
  }, []);

  // The frame: html, body and the root take the full height and never scroll
  // as a document. Set here rather than in the stylesheet so the how-to-test
  // page, which is a document, keeps scrolling like one.
  useEffect(() => {
    document.documentElement.classList.add("frame");
    return () => document.documentElement.classList.remove("frame");
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-ink">
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

      <div className="flex min-h-0 flex-1 flex-col wide:flex-row">
        <main className="scroll-thin min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
            {state.status === "failed" ? (
              <p className="text-sm text-ink-muted">
                {copy.app.loadFailed}
                {/* The technical reason comes from the Worker and stays English:
                    it is an error object, and those are read by agents. */}
                {state.failure === null ? null : ` (${state.failure})`}
              </p>
            ) : state.detail === null ? (
              <p className="text-sm text-ink-muted">{copy.app.loadingTender}</p>
            ) : state.role === "client" ? (
              <ClientScreen />
            ) : state.view === "priceBook" ? (
              <PriceBookScreen />
            ) : (
              <BidScreen />
            )}
          </div>
        </main>

        {panelOpen && (
          <AgentPanel
            webmcp={webmcp}
            wide={wide}
            onHide={() => setPanelChoice(false)}
            onReset={onReset}
            resetting={resetting}
          />
        )}
      </div>

      <StatusBar webmcp={webmcp} open={panelOpen} onToggle={() => setPanelChoice(!panelOpen)} />

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

/** The positions in the order of the bill of quantities, cut at the item number's first group. */
function groupByPrefix(positions: Position[]): [string, Position[]][] {
  const groups: [string, Position[]][] = [];
  for (const position of positions) {
    const prefix = position.oz.split(".")[0] ?? position.oz;
    const last = groups[groups.length - 1];
    if (last && last[0] === prefix) last[1].push(position);
    else groups.push([prefix, [position]]);
  }
  return groups;
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
  const net = sum(positions.filter((position) => !position.contingency));
  const contingency = sum(positions.filter((position) => position.contingency));
  const billable = positions.filter((position) => !position.contingency);
  const priced = billable.filter((position) => position.my_unit_price !== null).length;
  // Counted apart, shown apart: an empty contingency row is not a gap in the
  // total, and the bar says so in the same line.
  const contingencyRows = positions.filter((position) => position.contingency);
  const contingencyPriced = contingencyRows.filter((position) => position.my_unit_price !== null).length;
  // What stands between this draft and the dialog, as the last check saw it.
  // The button and the tool read the same list: a blocker is not a
  // confirmation, so while one exists nothing asks for a click.
  const blockers: SubmissionBlocker[] = check?.tender_id === tender.id ? (check.blockers ?? []) : [];
  const actionFor = (finding: string, key: "oz" | "doc_type", value: string) =>
    check?.actions?.find((entry) => entry.finding === finding && entry[key] === value)?.action;

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

  const groups = groupByPrefix(positions);

  return (
    <>
      <section className="flex flex-col gap-1.5">
        <h2 className="text-[28px] leading-[1.1] font-medium tracking-[-0.03em] text-navy">
          {tender.title}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span>
            {copy.bid.meta(
              tender.id,
              tender.client,
              tender.city,
              positions.length,
              formatDate(tender.due_date, language)
            )}
          </span>
          <span className="badge">{copy.client.status[tender.status] ?? tender.status}</span>
        </p>
        {/* Says where this plays. The firms, streets and projects are German
            because the case is -- GAEB files, VOB rules, a tax clearance
            certificate -- and without saying so, German proper nouns beside
            English position texts read as a translation somebody gave up on.
            It carries the "all of this is invented" notice too, which until now
            stood only in the README. */}
        <p className="text-xs text-ink-subtle">{copy.bid.scene}</p>
      </section>

      <section className="flex flex-wrap items-end gap-x-10 gap-y-3 border-b border-line pb-5">
        <Kpi label={copy.bid.netTotal} value={formatEuro(net)} big />
        <Kpi label={copy.bid.contingencyTotal} value={formatEuro(contingency)} />
        <Kpi
          label={copy.bid.priced}
          value={copy.bid.pricedValue(priced, billable.length)}
          suffix={
            contingencyRows.length > 0
              ? copy.bid.contingencyPricedValue(contingencyPriced, contingencyRows.length)
              : null
          }
        />
      </section>

      {locked ? (
        <p className="card flex items-center gap-3 bg-elev px-4 py-3 text-sm text-ink">
          <LockIcon />
          {copy.bid.submittedBanner}
        </p>
      ) : (
        <section className="flex flex-wrap items-center gap-3">
          {openProposals.length > 0 && (
            <button type="button" onClick={() => apply(openProposals)} className="btn-secondary">
              {copy.bid.applyAll(openProposals.length)}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void withBusy(() => runCheck(tenderId))}
            className="btn-secondary"
          >
            {copy.bid.checkBid}
          </button>
          <button type="button" onClick={() => void undoLastChange(1)} className="btn-ghost">
            {copy.bid.undo}
          </button>
          <button
            type="button"
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
            className="btn-primary ml-auto"
          >
            {copy.bid.submitBid}
          </button>
        </section>
      )}

      {locked && (
        <div className="flex">
          <button
            type="button"
            disabled={busy}
            onClick={() => void withBusy(() => runCheck(tenderId))}
            className="btn-secondary"
          >
            {copy.bid.checkBid}
          </button>
        </div>
      )}

      {!locked && blockers.length > 0 && (
        // The ways out are the check's own sentences: set the price yourself
        // or let your agent derive one, state the document's date. Not red --
        // red stays with the findings; this is the way through them.
        <section data-testid="submit-blockers" className="card px-4 py-3 text-xs text-ink">
          <p className="text-sm font-medium text-ink">{copy.submit.blocked(blockers.length)}</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
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
                  <span className="text-ink">{label}</span>
                  {action && <span className="block text-ink-muted">{action}</span>}
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
          {groups.map(([prefix, rows]) => (
            <tbody key={prefix}>
              {/* Only the number, and a rule. There are no group titles in the
                  data, and a title that is not in the data is not shown. */}
              <tr>
                <td colSpan={6} className="pt-6 pb-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-ink-subtle">{prefix}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                </td>
              </tr>
              <tr className="border-b border-line">
                <th scope="col" className="eyebrow w-16 py-2 pr-3 text-left">
                  {copy.bid.columnItem}
                </th>
                <th scope="col" className="eyebrow py-2 pr-3 text-left">
                  {copy.bid.columnDescription}
                </th>
                <th scope="col" className="eyebrow w-20 py-2 pr-3 text-right">
                  {copy.bid.columnQuantity}
                </th>
                <th scope="col" className="eyebrow w-14 py-2 pr-3 text-left">
                  {copy.bid.columnUnit}
                </th>
                <th scope="col" className="eyebrow w-[250px] py-2 pr-3 text-right">
                  {copy.bid.columnUnitPrice}
                </th>
                <th scope="col" className="eyebrow w-28 py-2 text-right">
                  {copy.bid.columnTotal}
                </th>
              </tr>
              {rows.map((position) => (
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
          ))}
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

/** A figure with its label above it. The net total is the one that speaks first. */
function Kpi({
  label,
  value,
  suffix,
  big
}: {
  label: string;
  value: string;
  suffix?: string | null;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 whitespace-nowrap">
      <span className="eyebrow">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={
            big
              ? "text-[26px] leading-none font-medium tracking-tight text-navy tabular-nums"
              : "text-lg leading-none text-ink-muted tabular-nums"
          }
        >
          {value}
        </span>
        {suffix && <span className="text-sm text-ink-subtle">{suffix}</span>}
      </span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0 text-ink-muted"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
