import { formatDate, formatEuro } from "./format";
import { useCopy, type Copy } from "./i18n";
import { confirmDocumentValidity, discardDocumentValidity, useAppState } from "./store";
import type { CheckResult, Language, PendingDocument } from "./types";

/** Enough of a position to tell a contingency row from a billable one. */
type PositionShape = { oz: string; contingency: boolean };

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
export default function CheckPanel({
  check,
  positions = [],
  onClose
}: {
  check: CheckResult;
  /** The positions of the tender, so an open contingency row is named as one. */
  positions?: PositionShape[];
  onClose: () => void;
}) {
  const copy = useCopy();
  const { language, pendingDocuments } = useAppState();
  const findings =
    check.open_positions.length + check.outliers.length + check.missing_documents.length;
  // An open contingency position is a finding, not a blocker: it is quoted
  // apart, never counted into the total, and never keeps the bid from going
  // out. The run-through read "Every position is priced" beside "Positions
  // without a price · 04.02" as a bug. It was the rule, unsaid. Now it is said.
  const contingency = new Set(positions.filter((row) => row.contingency).map((row) => row.oz));
  const openBillable = check.open_positions.filter((oz) => !contingency.has(oz));
  const openContingency = check.open_positions.filter((oz) => contingency.has(oz));
  const billableTotal = check.totals.positions_priced + check.totals.positions_open;
  // One sentence per finding saying what to do next. Written by the Worker in
  // the reader's language; an older answer without them still renders.
  const actions = check.actions ?? [];
  const actionFor = (finding: string, key: "oz" | "doc_type", value: string) =>
    actions.find((entry) => entry.finding === finding && entry[key] === value)?.action;
  const deadlineAction = actions.find((entry) => entry.finding === "deadline")?.action;

  return (
    <section className="card px-4 py-4 text-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-medium text-navy">{copy.check.title}</h3>
        <button type="button" onClick={onClose} className="text-xs text-ink-muted hover:text-ink">
          {copy.check.close}
        </button>
      </div>

      <p className="mt-1.5 text-[13px] text-ink-muted">
        {findings === 0 ? copy.check.nothingToFlag : copy.check.findings(findings)}{" "}
        {check.complete ? copy.check.allPriced(billableTotal) : null}{" "}
        {openContingency.length > 0 ? copy.check.contingencyOpen(openContingency.length) : null}{" "}
        {copy.check.deadline(formatDate(check.due_date, language))},{" "}
        {check.due_in_days >= 0
          ? copy.check.daysLeft(check.due_in_days)
          : copy.check.daysAgo(Math.abs(check.due_in_days))}
        .
      </p>

      <ul className="mt-3 flex flex-col gap-2.5">
        {openBillable.length > 0 && (
          <Finding label={copy.check.openPositions}>
            {openBillable.join(", ")}
            {openBillable.map((oz) => {
              const action = actionFor("open_position", "oz", oz);
              return action ? <NextStep key={oz} prefix={oz}>{action}</NextStep> : null;
            })}
          </Finding>
        )}

        {openContingency.length > 0 && (
          // Same shape as the findings above, in slate: a fact about the bid,
          // not something in the way of it.
          <Finding label={copy.check.contingencyWithoutPrice(openContingency.length)} tone="slate">
            {openContingency.join(", ")}
            {openContingency.map((oz) => {
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
            {pendingDocuments[document.doc_type] && (
              // The way out, at the finding it resolves.
              <DocumentConfirmation
                pending={pendingDocuments[document.doc_type]!}
                language={language}
                copy={copy}
              />
            )}
          </Finding>
        ))}
      </ul>

      {/* A date relayed for a document that is not a finding right now -- valid,
          and being extended -- still needs its confirmation somewhere. */}
      {Object.values(pendingDocuments)
        .filter((pending) => !check.missing_documents.some((d) => d.doc_type === pending.doc_type))
        .map((pending) => (
          <div key={pending.doc_type} className="mt-2 text-[13px]">
            <span className="font-medium text-ink">{pending.label}</span>
            <DocumentConfirmation pending={pending} language={language} copy={copy} />
          </div>
        ))}

      {deadlineAction && <p className="mt-2 text-[13px] text-ink">{deadlineAction}</p>}

      <p className="mt-3 text-xs text-ink-subtle">{copy.check.footnote}</p>
    </section>
  );
}

/**
 * The confirmation a relayed document date waits behind. Same build as the
 * price confirmation on a row: small, in place, no modal. The body line is the
 * honest part -- the page has not seen the certificate, and says so.
 */
function DocumentConfirmation({
  pending,
  language,
  copy
}: {
  pending: PendingDocument;
  language: Language;
  copy: Copy;
}) {
  return (
    <div
      data-testid={`confirm-document-${pending.doc_type}`}
      className="mt-2 max-w-[560px] rounded-lg border border-line bg-elev px-3 py-2.5 text-left text-xs text-ink"
    >
      <p className="text-sm font-medium text-ink">{copy.check.confirmDocumentTitle}</p>
      <p className="mt-1 text-ink-muted">
        {copy.check.confirmDocumentBody(formatDate(pending.valid_until, language))}
      </p>
      <p className="mt-1 tabular-nums">
        {copy.check.documentDates(
          pending.previous_valid_until === null
            ? null
            : formatDate(pending.previous_valid_until, language),
          formatDate(pending.valid_until, language)
        )}
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => discardDocumentValidity(pending.doc_type)}
          className="btn-ghost btn-sm"
        >
          {copy.row.discard}
        </button>
        <button
          type="button"
          onClick={() => void confirmDocumentValidity(pending.doc_type)}
          className="btn-primary btn-sm"
        >
          {copy.row.confirm}
        </button>
      </div>
    </div>
  );
}

/** What to do about a finding. Not red: the finding is the fact, this is the way out. */
function NextStep({ prefix, children }: { prefix?: string; children: React.ReactNode }) {
  return (
    <span className="mt-0.5 block text-ink-muted">
      {prefix ? <span className="font-mono text-[11px] text-ink-subtle">{prefix} </span> : null}
      {children}
    </span>
  );
}

/**
 * A finding. Red for what stands in the way of the hand-in -- an unpriced
 * billable position, a document expired or missing, a price far off the firm's
 * own history. Slate for a finding that does not: an open contingency row.
 */
function Finding({
  label,
  tone = "red",
  children
}: {
  label: string;
  tone?: "red" | "slate";
  children: React.ReactNode;
}) {
  return (
    <li
      data-testid={tone === "slate" ? "finding-contingency" : undefined}
      className={
        tone === "slate"
          ? "border-l-[3px] border-line-strong pl-3 text-[13px]"
          : "border-l-[3px] border-red-600 pl-3 text-[13px]"
      }
    >
      <span className={tone === "slate" ? "block font-medium text-ink" : "block font-medium text-red-700"}>
        {label}
      </span>
      <span className="text-ink">{children}</span>
    </li>
  );
}
