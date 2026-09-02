import { useEffect, useState } from "react";
import { formatEuro, formatMonthYear, formatQuantity } from "./format";
import { useCopy } from "./i18n";
import { useAppState } from "./store";
import type {
  Language,
  PendingPrice,
  Position,
  PriceRejection,
  Suggestion,
  SuggestionSource
} from "./types";

/**
 * One line of the bill of quantities, with its proposal if there is one.
 *
 * The staging follows the suggestion mode of a word processor: somebody
 * proposes, the proposal is visibly attached to a source, and the document stays
 * the human's until they take it over. A proposed price therefore never appears
 * in the price cell on its own -- it sits beside it, on a chip, with a button.
 *
 * Three states are visible, and they are states, not degrees:
 *   - a value with a source chip: taken from the price book,
 *   - a value without a chip: entered by a person,
 *   - no value, with "no comparable entry": nothing qualified.
 *
 * Every chip looks the same. No filled-versus-outlined, no percentage, no
 * traffic light: a grading would be the machine's self-assessment through the
 * back door, and it would tempt a reader to skim the "strong" ones. matched_terms
 * and matched_on are real data and appear when the chip is opened.
 */

/** Accepts "8,40" and "8.40" alike. Returns null when it is not a number. */
export function parsePrice(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const formatForInput = (value: number | null) =>
  value === null ? "" : value.toFixed(2).replace(".", ",");

export default function PositionRow({
  position,
  suggestion,
  rejection,
  pending,
  locked,
  onAccept,
  onEnter,
  onConfirm,
  onDiscard,
  onGap
}: {
  position: Position;
  suggestion: Suggestion | undefined;
  rejection: PriceRejection | undefined;
  /** A sourceless price an agent proposed, waiting for this person's click. */
  pending?: PendingPrice;
  /** The bid has been handed in. Nothing here may change any more. */
  locked: boolean;
  onAccept: (suggestion: Suggestion) => void;
  onEnter: (oz: string, unitPrice: number) => void;
  onConfirm?: (oz: string) => void;
  onDiscard?: (oz: string) => void;
  /** The way from a gap to the price book: the matrix, at this category and unit. */
  onGap?: (category: string, unit: string) => void;
}) {
  const copy = useCopy();
  const language = useAppState().language;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => formatForInput(position.my_unit_price));

  // A price written by the agent has to show up in the cell the person is
  // looking at, unless they are in the middle of typing their own.
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(formatForInput(position.my_unit_price));
  }, [position.my_unit_price, editing]);

  const entered = position.my_unit_price !== null;
  const proposal = !entered && suggestion?.unit_price != null ? suggestion : null;
  const noMatch = !entered && suggestion !== undefined && suggestion.unit_price === null;

  // What the chip shows. For an entered value it comes from the database, so the
  // provenance is still there after a reload; matched_terms is added only while
  // the proposal that produced it is still in memory.
  const chip: ChipData | null = entered
    ? position.source === null
      ? null
      : {
          unit_price: position.my_unit_price!,
          source: position.source,
          matched:
            suggestion?.based_on?.price_book_id === position.source.price_book_id
              ? { terms: suggestion.matched_terms, on: suggestion.matched_on }
              : null
        }
    : proposal === null
      ? null
      : {
          unit_price: proposal.unit_price!,
          source: proposal.based_on!,
          matched: { terms: proposal.matched_terms, on: proposal.matched_on }
        };

  function commit() {
    setEditing(false);
    const value = parsePrice(draft);
    if (value === null || value === position.my_unit_price) {
      setDraft(formatForInput(position.my_unit_price));
      return;
    }
    onEnter(position.oz, value);
  }

  return (
    <>
      <tr data-oz={position.oz} className="border-b border-line align-top">
        <td className="py-2.5 pr-3 font-mono text-xs text-ink-subtle">{position.oz}</td>
        <td className="py-2.5 pr-3 text-ink">
          {position.text}
          {position.contingency && (
            <span className="badge ml-2 align-middle">{copy.row.contingency}</span>
          )}
        </td>
        <td className="py-2.5 pr-3 text-right text-ink tabular-nums">
          {formatQuantity(position.quantity)}
        </td>
        <td className="py-2.5 pr-3 text-ink-muted">{position.unit}</td>

        <td className="py-2.5 pr-3">
          <div className="flex flex-col items-end gap-1.5">
            <label className="sr-only" htmlFor={`price-${position.oz}`}>
              {copy.row.unitPriceFor(position.oz)}
            </label>
            <input
              id={`price-${position.oz}`}
              inputMode="decimal"
              value={draft}
              readOnly={locked}
              placeholder="—"
              onFocus={() => setEditing(true)}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setEditing(false);
                  setDraft(formatForInput(position.my_unit_price));
                }
              }}
              className={
                locked
                  ? "h-[30px] w-[104px] rounded-md border border-line bg-elev px-2 text-right text-sm text-ink tabular-nums"
                  : "field h-[30px] w-[104px] rounded-md px-2 text-right text-sm tabular-nums"
              }
            />

            {/* The source stays visible after the value is in the cell. The
                provenance must not disappear at the moment it starts to count. */}
            {chip && (
              <>
                {/* The chip gets the full width of the column and the button
                    sits under it. Side by side, the button took a third of the
                    room and the provenance wrapped into four ragged lines. */}
                <SourceChip
                  chip={chip}
                  language={language}
                  copy={copy}
                  open={open}
                  onToggle={() => setOpen(!open)}
                />
                {proposal && !locked && (
                  <button
                    type="button"
                    onClick={() => onAccept(proposal)}
                    className="btn-secondary btn-sm shrink-0"
                  >
                    {copy.row.use}
                  </button>
                )}
              </>
            )}

            {noMatch && !pending && (
              // A gap waiting for a hand, not a warning. No icon, no colour --
              // and, where the price book screen exists, the way to the cell
              // this gap falls into.
              onGap ? (
                <button
                  type="button"
                  onClick={() => onGap(position.category, position.unit)}
                  className="text-xs text-ink-subtle underline decoration-dotted underline-offset-4 hover:text-ink"
                >
                  {copy.row.noComparableEntry}
                </button>
              ) : (
                <span className="text-xs text-ink-subtle">{copy.row.noComparableEntry}</span>
              )
            )}

            {entered && position.set_by === "human" && (
              // The second of the three states: a value without a chip is a
              // person's. Said in words, with the derivation they confirmed, if
              // an agent offered one -- plain text, never a chip. A chip would
              // claim a source this value does not have.
              <span className="text-right text-xs text-ink-muted">
                {copy.row.setByYou}
                {position.note ? ` · ${position.note}` : null}
              </span>
            )}

            {pending && !locked && (
              // The second half of the submit_bid pattern: an agent with no
              // authority of its own proposes, a person confirms. Small, on the
              // row, no modal -- the submit dialog stays the one moment that
              // stops the screen. And it says where the value does NOT come
              // from, as design rather than small print.
              <div
                data-testid={`confirm-${position.oz}`}
                className="mt-1 w-[300px] max-w-full rounded-lg border border-line-strong bg-white p-3 text-left text-xs text-ink shadow-md"
              >
                <p className="text-sm font-medium text-ink">{copy.row.confirmTitle}</p>
                <p className="mt-1 tabular-nums">
                  {copy.row.confirmMath(
                    formatEuro(pending.unit_price),
                    formatQuantity(position.quantity),
                    position.unit,
                    formatEuro(pending.line_total)
                  )}
                </p>
                {pending.current_unit_price !== null && (
                  <p className="mt-1 text-ink-muted">
                    {pending.current_unit_price === pending.unit_price
                      ? copy.row.remarkOnly
                      : copy.row.replaces(formatEuro(pending.current_unit_price))}
                  </p>
                )}
                <p className="mt-1 text-ink-muted">{copy.row.notFromPriceBook}</p>
                {pending.rationale && (
                  <p className="mt-1">
                    <span className="text-ink-muted">{copy.row.rationaleLabel}: </span>
                    {pending.rationale}
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onDiscard?.(position.oz)}
                    className="btn-ghost btn-sm"
                  >
                    {copy.row.discard}
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirm?.(position.oz)}
                    className="btn-primary btn-sm"
                  >
                    {copy.row.confirm}
                  </button>
                </div>
              </div>
            )}

            {rejection && (
              // Stays in the row with its reason. A message that fades away is a
              // message nobody read. Two audiences, one row: the code is what an
              // agent corrects itself on, the sentence is what a person acts on.
              <span className="flex flex-col items-end text-right text-xs text-ink-muted">
                <span>
                  {copy.row.notWritten} · <span className="font-mono">{rejection.reason}</span>
                </span>
                {copy.row.rejection[rejection.reason] && (
                  <span className="text-ink-muted">{copy.row.rejection[rejection.reason]}</span>
                )}
              </span>
            )}
          </div>
        </td>

        <td className="py-2.5 text-right text-ink-muted tabular-nums">
          {position.line_total === null ? "—" : formatEuro(position.line_total)}
        </td>
      </tr>

      {open && chip && (
        <tr className="border-b border-line bg-elev">
          <td />
          <td colSpan={5} className="px-0 py-2.5 pr-3">
            <OriginalLine chip={chip} language={language} copy={copy} />
          </td>
        </tr>
      )}
    </>
  );
}

type ChipData = {
  unit_price: number;
  source: SuggestionSource;
  matched: { terms: number; on: string[] } | null;
};

/**
 * The chip says what it is, not just where it is from.
 *
 * It used to read "480,00 EUR  Luegallee 40, March 2026", which only means
 * something to somebody who already knows what this application does. The whole
 * product claim rests on that value being a line this firm quoted before, so
 * the chip states it: "from your quote". A proof nobody can read is not a proof.
 *
 * Two lines, deliberately, rather than one string left to wrap where the column
 * happens to end -- that produced four ragged lines in German. Truncating was
 * never an option either: an ellipsis would leave the claim standing with its
 * evidence cut off.
 */
function SourceChip({
  chip,
  language,
  copy,
  open,
  onToggle
}: {
  chip: ChipData;
  language: Language;
  copy: ReturnType<typeof useCopy>;
  open: boolean;
  onToggle: () => void;
}) {
  const source = chip.source;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="chip hover:border-line-strong"
    >
      <span className="flex items-baseline gap-1.5">
        <span className="tabular-nums">{formatEuro(chip.unit_price)}</span>
        <span className="text-ink-muted">{copy.row.chipLead}</span>
      </span>
      <span className="text-ink-muted">
        {copy.row.chipWhere(
          source.source_project,
          formatMonthYear(source.source_date, language)
        )}
      </span>
    </button>
  );
}

/** The past line a price came from, verbatim. This is the whole promise. */
function OriginalLine({
  chip,
  language,
  copy
}: {
  chip: ChipData;
  language: Language;
  copy: ReturnType<typeof useCopy>;
}) {
  const source = chip.source;
  return (
    <div className="text-xs text-ink-muted">
      {/* Names the thing before quoting it. Verbatim underneath: this is the
          evidence, and evidence that needs explaining afterwards is not read. */}
      <p className="text-ink-subtle">{copy.row.originalLine}</p>
      <p className="mt-0.5 text-sm text-ink italic">{source.source_position_text}</p>
      <p className="mt-0.5">
        {source.source_project} · {formatMonthYear(source.source_date, language)} ·{" "}
        {formatEuro(chip.unit_price)} ·{" "}
        <span className="font-mono text-[11px]">{source.price_book_id}</span>
      </p>
      {chip.matched && (
        <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">
          {/* Tool data, printed as it stands. Never a scale, never a percentage. */}
          {copy.row.matched(chip.matched.terms, chip.matched.on.join(", "))}
        </p>
      )}
    </div>
  );
}
