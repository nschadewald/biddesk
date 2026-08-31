import { formatDate, formatEuro } from "./format";
import type { CheckResult } from "./types";

/**
 * The check result. This is the ONE place in the interface where red appears.
 *
 * Everywhere else, uncertainty shows up as absence: an empty cell with "no
 * comparable entry", a value without a chip. Those are states of the document.
 * What is listed here is different in kind -- an expired certificate, a price
 * far off this contractor's own history, a deadline running out. Those are
 * facts about the bid, not the system's opinion of itself, and because red
 * occurs nowhere else it still means something when it occurs here.
 */
export default function CheckPanel({ check, onClose }: { check: CheckResult; onClose: () => void }) {
  const findings =
    check.open_positions.length + check.outliers.length + check.missing_documents.length;

  return (
    <section className="border-b border-slate-200 py-3 text-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Check result
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-900"
        >
          Close
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        {findings === 0
          ? "Nothing to flag."
          : `${findings} finding${findings === 1 ? "" : "s"}.`}{" "}
        {check.complete ? "Every position is priced." : null} Deadline{" "}
        {formatDate(check.due_date)},{" "}
        {check.due_in_days >= 0
          ? `${check.due_in_days} days left`
          : `${Math.abs(check.due_in_days)} days ago`}
        .
      </p>

      <ul className="mt-2 flex flex-col gap-1">
        {check.open_positions.length > 0 && (
          <Finding label="Positions without a price">
            {check.open_positions.join(", ")}
          </Finding>
        )}

        {check.outliers.map((outlier) => (
          <Finding key={outlier.oz} label={`${outlier.oz} is off your own past price`}>
            {formatEuro(outlier.unit_price)} against {formatEuro(outlier.price_book_price)} from{" "}
            <span className="font-mono text-[11px]">{outlier.price_book_id}</span>,{" "}
            {outlier.deviation_pct > 0 ? "+" : ""}
            {outlier.deviation_pct} %
          </Finding>
        ))}

        {check.missing_documents.map((document) => (
          <Finding
            key={document.doc_type}
            label={document.reason === "expired" ? "Expired document" : "Missing document"}
          >
            {document.label}
            {document.valid_until ? ` · valid until ${document.valid_until}` : null}
          </Finding>
        ))}
      </ul>

      <p className="mt-2 text-xs text-slate-500">
        Compared against this contractor&apos;s own price book, not against market rates.
      </p>
    </section>
  );
}

function Finding({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="border-l-2 border-red-600 pl-2 text-xs">
      <span className="font-medium text-red-700">{label}</span>{" "}
      <span className="text-slate-700">{children}</span>
    </li>
  );
}
