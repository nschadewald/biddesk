import { formatDate, formatEuro } from "./format";
import { useCopy } from "./i18n";
import { useAppState } from "./store";
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
 *
 * The document labels arrive already in the reader's language: the Worker
 * resolves them, because the name of a certificate is what a person holds in
 * their hand. `check.warnings` is not shown here at all -- it is the sentence
 * an agent reads, and it stays English.
 */
export default function CheckPanel({ check, onClose }: { check: CheckResult; onClose: () => void }) {
  const copy = useCopy();
  const language = useAppState().language;
  const findings =
    check.open_positions.length + check.outliers.length + check.missing_documents.length;
  // One sentence per finding saying what to do next. Written by the Worker in
  // the reader's language; an older answer without them still renders.
  const actions = check.actions ?? [];
  const actionFor = (finding: string, key: "oz" | "doc_type", value: string) =>
    actions.find((entry) => entry.finding === finding && entry[key] === value)?.action;
  const deadlineAction = actions.find((entry) => entry.finding === "deadline")?.action;

  return (
    <section className="border-b border-slate-200 py-3 text-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {copy.check.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-900"
        >
          {copy.check.close}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        {findings === 0 ? copy.check.nothingToFlag : copy.check.findings(findings)}{" "}
        {check.complete ? copy.check.allPriced : null}{" "}
        {copy.check.deadline(formatDate(check.due_date, language))},{" "}
        {check.due_in_days >= 0
          ? copy.check.daysLeft(check.due_in_days)
          : copy.check.daysAgo(Math.abs(check.due_in_days))}
        .
      </p>

      <ul className="mt-2 flex flex-col gap-1">
        {check.open_positions.length > 0 && (
          <Finding label={copy.check.openPositions}>
            {check.open_positions.join(", ")}
            {check.open_positions.map((oz) => {
              const action = actionFor("open_position", "oz", oz);
              return action ? <NextStep key={oz} prefix={oz}>{action}</NextStep> : null;
            })}
          </Finding>
        )}

        {check.outliers.map((outlier) => (
          <Finding key={outlier.oz} label={copy.check.outlier(outlier.oz)}>
            {copy.check.outlierAgainst(
              formatEuro(outlier.unit_price),
              formatEuro(outlier.price_book_price)
            )}{" "}
            <span className="font-mono text-[11px]">{outlier.price_book_id}</span>
            {copy.check.outlierDeviation(
              `${outlier.deviation_pct > 0 ? "+" : ""}${outlier.deviation_pct}`
            )}
            {actionFor("outlier", "oz", outlier.oz) && (
              <NextStep>{actionFor("outlier", "oz", outlier.oz)}</NextStep>
            )}
          </Finding>
        ))}

        {check.missing_documents.map((document) => (
          <Finding
            key={document.doc_type}
            label={
              document.reason === "expired"
                ? copy.check.documentExpired
                : copy.check.documentMissing
            }
          >
            {document.label}
            {document.valid_until
              ? copy.check.validUntil(formatDate(document.valid_until, language))
              : null}
            {actionFor("document", "doc_type", document.doc_type) && (
              <NextStep>{actionFor("document", "doc_type", document.doc_type)}</NextStep>
            )}
          </Finding>
        ))}
      </ul>

      {deadlineAction && <p className="mt-2 text-xs text-slate-700">{deadlineAction}</p>}

      <p className="mt-2 text-xs text-slate-500">{copy.check.footnote}</p>
    </section>
  );
}

/** What to do about a finding. Not red: the finding is the fact, this is the way out. */
function NextStep({ prefix, children }: { prefix?: string; children: React.ReactNode }) {
  return (
    <span className="mt-0.5 block text-slate-600">
      {prefix ? <span className="font-mono text-[11px] text-slate-500">{prefix} </span> : null}
      {children}
    </span>
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
