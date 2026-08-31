import { useEffect, useRef } from "react";
import { formatEuro } from "./format";
import type { BidTotals } from "./types";

/**
 * The one irreversible action, and the one that a tool cannot complete.
 *
 * `submit_bid` with confirm:true does not submit. It opens this dialog and
 * waits. The bid goes out when a person presses the button here, and not
 * before -- the authority sits with the hand on the mouse, never in a tool
 * argument. If nobody presses anything, the bid stays a draft.
 */
export default function SubmitDialog({
  tenderId,
  totals,
  onConfirm,
  onCancel
}: {
  tenderId: string;
  totals: BidTotals;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-dialog-title"
        className="w-full max-w-md rounded border border-slate-300 bg-white p-5 shadow-lg"
      >
        <h2 id="submit-dialog-title" className="text-sm font-semibold text-slate-900">
          Hand in this bid?
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {tenderId} · this cannot be undone. After submitting, the prices are locked.
        </p>

        <dl className="mt-3 flex flex-col gap-1 border-y border-slate-200 py-3 text-sm">
          <Line label="Net total" value={formatEuro(totals.net)} strong />
          <Line label="Contingency positions" value={formatEuro(totals.contingency)} />
          <Line
            label="Positions priced"
            value={`${totals.positions_priced} of ${totals.positions_priced + totals.positions_open}`}
          />
        </dl>

        {totals.positions_open > 0 && (
          // Stated, not coloured: red is reserved for the check result.
          <p className="mt-2 text-xs text-slate-700">
            {totals.positions_open} position
            {totals.positions_open === 1 ? " is" : "s are"} still without a price.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded border border-slate-900 bg-slate-900 px-2.5 py-1 text-xs text-white hover:bg-slate-800"
          >
            Submit bid
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={strong ? "font-semibold tabular-nums" : "tabular-nums text-slate-700"}>
        {value}
      </dd>
    </div>
  );
}
