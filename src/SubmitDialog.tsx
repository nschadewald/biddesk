import { useEffect, useRef } from "react";
import { formatEuro } from "./format";
import { useCopy } from "./i18n";
import type { BidTotals } from "./types";

/** Enough of a position to count the contingency rows apart. */
type PositionShape = { oz: string; contingency: boolean; my_unit_price: number | null };

/**
 * The one irreversible action, and the one that a tool cannot complete.
 *
 * `submit_bid` with confirm:true does not submit. It opens this dialog and
 * waits. The bid goes out when a person presses the button here, and not
 * before -- the authority sits with the hand on the mouse, never in a tool
 * argument. If nobody presses anything, the bid stays a draft.
 *
 * Contingency positions are counted apart, in words. "Positions priced
 * 12 of 12" above a table with an empty row read as a bug in the run-through;
 * it was the rule -- contingency rows are quoted apart and never block --
 * and the dialog now says so.
 *
 * The only modal on the page, and the only element with role="dialog".
 */
export default function SubmitDialog({
  tenderId,
  totals,
  positions = [],
  onConfirm,
  onCancel
}: {
  tenderId: string;
  totals: BidTotals;
  /** The positions of the tender, so the contingency rows can be counted apart. */
  positions?: PositionShape[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = useCopy();
  const confirmRef = useRef<HTMLButtonElement>(null);

  const contingency = positions.filter((row) => row.contingency);
  const contingencyPriced = contingency.filter((row) => row.my_unit_price !== null).length;
  const contingencyOpen = contingency.filter((row) => row.my_unit_price === null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/35 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-dialog-title"
        className="w-full max-w-[440px] rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="submit-dialog-title" className="text-[22px] leading-tight font-medium text-navy">
          {copy.submit.title}
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-muted">{copy.submit.subtitle(tenderId)}</p>

        <dl className="mt-4 flex flex-col gap-1.5 border-y border-line py-3 text-sm">
          <Line label={copy.submit.netTotal} value={formatEuro(totals.net)} strong />
          <Line label={copy.submit.contingencyTotal} value={formatEuro(totals.contingency)} />
          <Line
            label={copy.submit.positionsPriced}
            value={copy.submit.positionsPricedValue(
              totals.positions_priced,
              totals.positions_priced + totals.positions_open
            )}
          />
          {contingency.length > 0 && (
            <Line
              label={copy.submit.contingencyPriced}
              value={copy.submit.positionsPricedValue(contingencyPriced, contingency.length)}
            />
          )}
        </dl>

        {contingencyOpen.length > 0 && (
          // Stated, not coloured: red is reserved for the check result.
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink-muted">
            {contingencyOpen.map((row) => (
              <li key={row.oz}>{copy.submit.contingencyOpenLine(row.oz)}</li>
            ))}
          </ul>
        )}

        {totals.positions_open > 0 && (
          // An unpriced billable position is a blocker since CC-09, and a
          // blocker never reaches this dialog -- neither through the button nor
          // through submit_bid. Kept for a totals object that arrives another
          // way; it should not be seen.
          <p className="mt-2 text-xs text-ink">{copy.submit.stillOpen(totals.positions_open)}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">
            {copy.submit.cancel}
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} className="btn-primary">
            {copy.submit.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={strong ? "font-medium text-ink tabular-nums" : "text-ink tabular-nums"}>{value}</dd>
    </div>
  );
}
