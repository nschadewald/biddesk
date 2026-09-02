import { useEffect } from "react";
import Clarifications from "./Clarifications";
import { formatDate } from "./format";
import { useCopy } from "./i18n";
import PriceComparison from "./PriceComparison";
import {
  answerClarification,
  loadComparison,
  openTender,
  readTenders,
  useAppState
} from "./store";
import type { Tender } from "./types";

/**
 * The client side. Read-only by design, apart from answering questions.
 *
 * There is no tool to create or change a tender here, and no screen for it. In
 * a real procurement the bill of quantities is the client's document and a
 * bidder may not touch it; giving the client's agent authoring powers would
 * double the surface without strengthening anything. The gap is deliberate.
 */
export default function ClientScreen() {
  const { detail, tenderId, comparison, clarifications, tenders, language, ownDraftPending } =
    useAppState();
  const copy = useCopy();

  useEffect(() => {
    void readTenders();
  }, []);

  useEffect(() => {
    void loadComparison(tenderId).catch(() => undefined);
  }, [tenderId]);

  const tender = detail?.tender;
  // Whether the contractor this browser just acted for left a draft is not in
  // `tender`: the Worker's client projection carries no bid status. The store
  // remembered it at the role switch, for the one person who is both sides.

  return (
    <>
      <section className="flex flex-col gap-1.5">
        {/* The client is a fact of the tender, not a string in the interface. */}
        <h2 className="text-[28px] leading-[1.1] font-medium tracking-[-0.03em] text-navy">
          {tender?.client ?? copy.header.roleClient}
        </h2>
        <p className="text-sm text-ink-muted">{copy.client.subtitle}</p>
        {/* Same line as on the bid screen, same place: where this plays, and
            that none of it is real. A juror in the client role sees the same
            German names beside English words. */}
        <p className="text-xs text-ink-subtle">{copy.bid.scene}</p>
      </section>

      <div className="-mx-1 overflow-x-auto border-t border-line px-1">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow w-32 py-2.5 pr-3 text-left">
                {copy.client.columnTender}
              </th>
              <th scope="col" className="eyebrow py-2.5 pr-3 text-left">
                {copy.client.columnTitle}
              </th>
              <th scope="col" className="eyebrow w-24 py-2.5 pr-3 text-left">
                {copy.client.columnStatus}
              </th>
              <th scope="col" className="eyebrow w-32 py-2.5 pr-3 text-left">
                {copy.client.columnDeadline}
              </th>
              <th scope="col" className="eyebrow w-16 py-2.5 text-right">
                {copy.client.columnItems}
              </th>
            </tr>
          </thead>
          <tbody>
            {tenders.map((entry: Tender) => (
              <tr
                key={entry.id}
                className={
                  entry.id === tenderId
                    ? "cursor-pointer border-b border-line bg-elev"
                    : "cursor-pointer border-b border-line hover:bg-elev"
                }
                onClick={() => void openTender(entry.id)}
              >
                <td className="py-2.5 pr-3 font-mono text-xs text-ink-subtle">{entry.id}</td>
                <td
                  className={
                    entry.id === tenderId ? "py-2.5 pr-3 font-medium text-ink" : "py-2.5 pr-3 text-ink"
                  }
                >
                  {entry.title}
                </td>
                <td className="py-2.5 pr-3">
                  <span className="badge">{copy.client.status[entry.status] ?? entry.status}</span>
                </td>
                <td className="py-2.5 pr-3 text-ink-muted">{formatDate(entry.due_date, language)}</td>
                <td className="py-2.5 text-right text-ink-muted tabular-nums">
                  {entry.positions_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison ? (
        <PriceComparison comparison={comparison} ownDraftPending={ownDraftPending} />
      ) : (
        <p className="py-2 text-sm text-ink-muted">{copy.client.loadingBids}</p>
      )}

      <Clarifications
        role="client"
        questions={clarifications}
        onAsk={async () => undefined}
        onAnswer={(questionId, answer) => answerClarification(questionId, answer)}
      />
    </>
  );
}
