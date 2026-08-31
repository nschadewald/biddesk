import { useState } from "react";
import { formatEuro, formatMonthYear, formatQuantity } from "./format";
import type { Position, Suggestion } from "./types";

/**
 * One line of the bill of quantities, with its proposal if there is one.
 *
 * The staging is deliberate and follows the suggestion mode of a word processor:
 * somebody proposes, the proposal is visibly attached to a source, and the
 * document stays the human's until they take it over. So a proposed price never
 * appears in the price cell -- it sits beside it, on a chip.
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
export default function PositionRow({
  position,
  suggestion
}: {
  position: Position;
  suggestion: Suggestion | undefined;
}) {
  const [open, setOpen] = useState(false);
  const entered = position.my_unit_price !== null;
  const proposed = !entered && suggestion?.unit_price != null;
  const noMatch = !entered && suggestion !== undefined && suggestion.unit_price === null;

  return (
    <>
      <tr data-oz={position.oz} className="border-b border-slate-100 align-top">
        <td className="py-2 pr-3 font-mono text-xs text-slate-500">{position.oz}</td>
        <td className="py-2 pr-3">
          {position.text}
          {position.contingency && (
            <span className="ml-2 rounded border border-slate-200 px-1 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              contingency
            </span>
          )}
        </td>
        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
          {formatQuantity(position.quantity)}
        </td>
        <td className="py-2 pr-3 text-slate-500">{position.unit}</td>
        <td className="py-2 pr-3 text-right">
          {entered ? (
            <span className="tabular-nums">{formatEuro(position.my_unit_price!)}</span>
          ) : proposed ? (
            <SourceChip suggestion={suggestion!} open={open} onToggle={() => setOpen(!open)} />
          ) : noMatch ? (
            // A gap waiting for a hand, not a warning. No icon, no colour.
            <span className="text-slate-500">no comparable entry</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="py-2 text-right tabular-nums text-slate-400">
          {position.line_total === null ? "—" : formatEuro(position.line_total)}
        </td>
      </tr>

      {open && proposed && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td />
          <td colSpan={5} className="px-0 py-2 pr-3">
            <OriginalLine suggestion={suggestion!} />
          </td>
        </tr>
      )}
    </>
  );
}

function SourceChip({
  suggestion,
  open,
  onToggle
}: {
  suggestion: Suggestion;
  open: boolean;
  onToggle: () => void;
}) {
  const source = suggestion.based_on!;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex max-w-full items-baseline gap-1.5 rounded border border-slate-300 px-1.5 py-0.5 text-left text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
    >
      <span className="tabular-nums">{formatEuro(suggestion.unit_price!)}</span>
      <span className="truncate text-slate-500">
        {source.source_project}, {formatMonthYear(source.source_date)}
      </span>
    </button>
  );
}

/** The past line a proposal came from, verbatim. This is the whole promise. */
function OriginalLine({ suggestion }: { suggestion: Suggestion }) {
  const source = suggestion.based_on!;
  return (
    <div className="text-xs text-slate-600">
      <p className="text-slate-900">{source.source_position_text}</p>
      <p className="mt-0.5">
        {source.source_project} · {formatMonthYear(source.source_date)} ·{" "}
        {formatEuro(suggestion.unit_price!)} ·{" "}
        <span className="font-mono text-[11px]">{source.price_book_id}</span>
      </p>
      <p className="mt-0.5 text-slate-500">
        matched_terms {suggestion.matched_terms} · matched_on {suggestion.matched_on.join(", ")}
      </p>
    </div>
  );
}
