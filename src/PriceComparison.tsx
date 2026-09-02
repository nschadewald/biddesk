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
      <section className="card flex flex-col gap-3 px-5 py-5">
        <h3 className="text-base font-medium text-navy">
          {copy.comparison.sealedTitle} · {comparison.tender_id}
        </h3>
        <div className="flex items-start gap-3">
          <LockIcon />
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium text-ink">
              <span className="tabular-nums">{comparison.bids_received}</span>{" "}
              {copy.comparison.received(comparison.bids_received)}
              {ownDraftPending ? copy.comparison.ownDraft : null}
            </p>
            <p className="text-[13px] text-ink-muted">
              {copy.comparison.sealedUntil(formatDate(comparison.sealed_until!, language))}
            </p>
          </div>
        </div>
        {comparison.received_at.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-[13px] text-ink-muted">
            {comparison.received_at.map((at, index) => (
              <li key={at + index} className="flex gap-3 tabular-nums">
                <span className="font-mono text-xs text-ink-subtle">#{index + 1}</span>
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
    <section className="card flex flex-col gap-4 px-5 py-5">
      <h3 className="text-base font-medium text-navy">
        {copy.comparison.title(comparison.bids_received)}
      </h3>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full max-w-[640px] min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow w-10 py-2 pr-3 text-left">
                {copy.comparison.columnRank}
              </th>
              <th scope="col" className="eyebrow py-2 pr-3 text-left">
                {copy.comparison.columnBidder}
              </th>
              <th scope="col" className="eyebrow w-40 py-2 pr-3 text-right">
                {copy.comparison.columnNetTotal}
              </th>
              <th scope="col" className="eyebrow w-28 py-2 text-right">
                {copy.comparison.columnComplete}
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.bidders.map((bidder) => (
              <tr key={bidder.bidder_id} className="border-b border-line">
                <td className="py-2.5 pr-3 font-mono text-xs text-ink-subtle">{bidder.rank}</td>
                <td className={bidder.rank === 1 ? "py-2.5 pr-3 font-medium text-ink" : "py-2.5 pr-3 text-ink"}>
                  {bidder.name}
                </td>
                <td className="py-2.5 pr-3 text-right text-ink tabular-nums">
                  {formatEuro(bidder.total_net)}
                </td>
                <td className="py-2.5 text-right text-ink-muted">
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
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow w-16 py-2 pr-3 text-left">
                {copy.comparison.columnItem}
              </th>
              <th scope="col" className="eyebrow py-2 pr-3 text-left">
                {copy.comparison.columnDescription}
              </th>
              <th scope="col" className="eyebrow w-20 py-2 pr-3 text-right">
                {copy.comparison.columnQuantity}
              </th>
              <th scope="col" className="eyebrow w-24 py-2 pr-3 text-right">
                {copy.comparison.columnMedian}
              </th>
              {comparison.bidders.map((bidder) => (
                <th
                  key={bidder.bidder_id}
                  scope="col"
                  className="w-36 py-2 pr-3 text-right text-[13px] font-medium text-ink"
                >
                  {bidder.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.positions.map((position) => (
              <tr key={position.oz} className="border-b border-line align-top">
                <td className="py-2.5 pr-3 font-mono text-xs text-ink-subtle">{position.oz}</td>
                <td className="py-2.5 pr-3 text-ink">{position.text}</td>
                <td className="py-2.5 pr-3 text-right text-ink-muted tabular-nums">
                  {formatQuantity(position.quantity)} {position.unit}
                </td>
                <td className="py-2.5 pr-3 text-right text-ink-muted tabular-nums">
                  {position.median === null ? "—" : formatEuro(position.median)}
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
                          ? "py-2.5 pr-3 text-right font-medium text-ink tabular-nums underline decoration-navy decoration-2 underline-offset-4"
                          : "py-2.5 pr-3 text-right text-ink tabular-nums"
                      }
                      title={isOutlier ? copy.comparison.outlierTitle : undefined}
                    >
                      {price ? formatEuro(price.unit_price) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison.positions.some((position) => position.outliers.length > 0) && (
        <p className="text-xs text-ink-subtle">
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

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className="mt-0.5 shrink-0 text-ink-muted"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
