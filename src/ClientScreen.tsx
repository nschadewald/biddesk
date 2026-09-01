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
  const { detail, tenderId, comparison, clarifications, tenders, language } = useAppState();
  const copy = useCopy();

  useEffect(() => {
    void readTenders();
  }, []);

  useEffect(() => {
    void loadComparison(tenderId).catch(() => undefined);
  }, [tenderId]);

  const tender = detail?.tender;
  // The selected contractor started a bid but has not handed it in.
  const ownDraftPending = tender?.my_bid_status === "draft";

  return (
    <>
      <section className="border-b border-slate-200 pb-4">
        {/* The client is a fact of the tender, not a string in the interface. */}
        <h2 className="text-lg font-medium">{tender?.client ?? copy.header.roleClient}</h2>
        <p className="mt-1 text-xs text-slate-500">{copy.client.subtitle}</p>

        <div className="-mx-1 mt-3 overflow-x-auto px-1">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="w-28 py-2 pr-3 font-medium">{copy.client.columnTender}</th>
              <th className="py-2 pr-3 font-medium">{copy.client.columnTitle}</th>
              <th className="w-24 py-2 pr-3 font-medium">{copy.client.columnStatus}</th>
              <th className="w-32 py-2 pr-3 font-medium">{copy.client.columnDeadline}</th>
              <th className="w-20 py-2 font-medium">{copy.client.columnItems}</th>
            </tr>
          </thead>
          <tbody>
            {tenders.map((entry: Tender) => (
              <tr
                key={entry.id}
                className={
                  entry.id === tenderId
                    ? "cursor-pointer border-b border-slate-100 bg-slate-50"
                    : "cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                }
                onClick={() => void openTender(entry.id)}
              >
                <td className="py-2 pr-3 font-mono text-xs text-slate-500">{entry.id}</td>
                <td className="py-2 pr-3">{entry.title}</td>
                <td className="py-2 pr-3 text-slate-600">
                  {copy.client.status[entry.status] ?? entry.status}
                </td>
                <td className="py-2 pr-3 text-slate-600">
                  {formatDate(entry.due_date, language)}
                </td>
                <td className="py-2 tabular-nums text-slate-600">{entry.positions_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {comparison ? (
        <PriceComparison comparison={comparison} ownDraftPending={ownDraftPending} />
      ) : (
        <p className="py-4 text-sm text-slate-500">{copy.client.loadingBids}</p>
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
