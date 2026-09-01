import { formatDate, formatEuro, formatQuantity } from "./format";
import { useCopy } from "./i18n";
import { useAppState } from "./store";
import type { PriceComparison as Comparison } from "./types";

/**
 * The client's view of the bids.
 *
 * While a tender is open there is nothing to show but a count and the times the
 * bids arrived, and that is the strongest thing this screen says: the client
 * cannot see the contractor's prices, and neither can the client's agent. After
 * the demo submission the counter goes from two to three, and still nobody can
 * look inside.
 */
export default function PriceComparison({
  comparison,
  ownDraftPending
}: {
  comparison: Comparison;
  /** The selected contractor has a draft that has not been handed in. */
  ownDraftPending: boolean;
}) {
  const copy = useCopy();
  const language = useAppState().language;

  if (comparison.sealed) {
    return (
      <section className="flex flex-col gap-2 border-b border-slate-200 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {copy.comparison.sealedTitle}
        </h3>
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{comparison.bids_received}</span>{" "}
          {copy.comparison.received(comparison.bids_received)}
          {ownDraftPending ? copy.comparison.ownDraft : null}
        </p>
        <p className="text-xs text-slate-500">
          {copy.comparison.sealedUntil(formatDate(comparison.sealed_until!, language))}
        </p>
        {comparison.received_at.length > 0 && (
          <ul className="text-xs text-slate-500">
            {comparison.received_at.map((at, index) => (
              <li key={at + index} className="tabular-nums">
                {copy.comparison.receivedAt(at)}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const outlierName = (bidderId: string) =>
    comparison.bidders.find((bidder) => bidder.bidder_id === bidderId)?.name ?? bidderId;

  return (
    <section className="flex flex-col gap-3 border-b border-slate-200 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {copy.comparison.title(comparison.bids_received)}
      </h3>

      <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
            <th className="w-10 py-2 pr-3 font-medium">{copy.comparison.columnRank}</th>
            <th className="py-2 pr-3 font-medium">{copy.comparison.columnBidder}</th>
            <th className="w-40 py-2 pr-3 text-right font-medium">
              {copy.comparison.columnNetTotal}
            </th>
            <th className="w-28 py-2 font-medium">{copy.comparison.columnComplete}</th>
          </tr>
        </thead>
        <tbody>
          {comparison.bidders.map((bidder) => (
            <tr key={bidder.bidder_id} className="border-b border-slate-100">
              <td className="py-2 pr-3 tabular-nums text-slate-500">{bidder.rank}</td>
              <td className="py-2 pr-3">{bidder.name}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatEuro(bidder.total_net)}
              </td>
              <td className="py-2 text-slate-600">
                {bidder.complete ? copy.comparison.yes : copy.comparison.no}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
            <th className="w-16 py-2 pr-3 font-medium">{copy.comparison.columnItem}</th>
            <th className="py-2 pr-3 font-medium">{copy.comparison.columnDescription}</th>
            <th className="w-20 py-2 pr-3 text-right font-medium">
              {copy.comparison.columnQuantity}
            </th>
            {comparison.bidders.map((bidder) => (
              <th key={bidder.bidder_id} className="w-28 py-2 pr-3 text-right font-medium">
                {bidder.name.split(" ")[0]}
              </th>
            ))}
            <th className="w-24 py-2 text-right font-medium">{copy.comparison.columnMedian}</th>
          </tr>
        </thead>
        <tbody>
          {comparison.positions.map((position) => (
            <tr key={position.oz} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3 font-mono text-xs text-slate-500">{position.oz}</td>
              <td className="py-2 pr-3">{position.text}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-600">
                {formatQuantity(position.quantity)} {position.unit}
              </td>
              {comparison.bidders.map((bidder) => {
                const price = position.prices.find(
                  (entry) => entry.bidder_id === bidder.bidder_id
                );
                const isOutlier = position.outliers.includes(bidder.bidder_id);
                return (
                  <td
                    key={bidder.bidder_id}
                    className={
                      isOutlier
                        ? "py-2 pr-3 text-right font-medium tabular-nums text-slate-900 underline decoration-slate-400 decoration-dotted underline-offset-4"
                        : "py-2 pr-3 text-right tabular-nums text-slate-700"
                    }
                    title={isOutlier ? copy.comparison.outlierTitle : undefined}
                  >
                    {price ? formatEuro(price.unit_price) : "—"}
                  </td>
                );
              })}
              <td className="py-2 text-right tabular-nums text-slate-500">
                {position.median === null ? "—" : formatEuro(position.median)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {comparison.positions.some((position) => position.outliers.length > 0) && (
        <p className="text-xs text-slate-500">
          {copy.comparison.outlierNote}{" "}
          {comparison.positions
            .filter((position) => position.outliers.length > 0)
            .map(
              (position) =>
                `${position.oz} (${position.outliers.map(outlierName).join(", ")})`
            )
            .join(", ")}
          .
        </p>
      )}
    </section>
  );
}
