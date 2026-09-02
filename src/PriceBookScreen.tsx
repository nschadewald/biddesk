import { useEffect, useState } from "react";
import Clarifications from "./Clarifications";
import { formatEuro, formatMonthYear } from "./format";
import { useCopy } from "./i18n";
import {
  cellKey,
  coverageAxes,
  coverageCounts,
  groupEntries,
  searchEntries,
  type WorkspacePosition
} from "./priceBook";
import {
  answerClarification,
  askClarification,
  loadPriceBook,
  loadWorkspacePositions,
  selectPriceBookCell,
  useAppState
} from "./store";

/**
 * The price book, on screen.
 *
 * It is the central idea of the product and was invisible: the only way to it
 * was get_price_book. This is a read-only view of what the matcher sees --
 * the contractor's own past lines, and a coverage matrix that shows, as a
 * number or as nothing, where a position of a given category and unit would
 * get a proposal and where it would get "no comparable entry". Switching the
 * contractor in the header switches the book: the same fourteen lines meet a
 * different history, which is the proof that nothing here is hard-coded.
 *
 * Nothing is written here. Original lines, project names and keywords are
 * never translated, in either language: they are the record.
 *
 * Coverage is a count or a gap, never a percentage or a bar (spec section 13.3:
 * states, not grades).
 */
export default function PriceBookScreen() {
  const copy = useCopy();
  const {
    priceBook,
    workspacePositions,
    priceBookCell,
    bidders,
    bidderId,
    language,
    clarifications,
    tenderId
  } = useAppState();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (priceBook === null) void loadPriceBook();
  }, [priceBook]);
  useEffect(() => {
    if (workspacePositions === null) void loadWorkspacePositions();
  }, [workspacePositions]);

  const bidder = bidders.find((entry) => entry.id === bidderId)?.name ?? bidderId ?? "";

  if (priceBook === null) {
    return <p className="text-sm text-slate-500">{copy.priceBook.loading}</p>;
  }

  const positions = workspacePositions ?? [];
  const axes = coverageAxes(priceBook, positions);
  const counts = coverageCounts(priceBook);
  const searched = searchEntries(priceBook, query);
  const shown =
    priceBookCell === null
      ? searched
      : searched.filter(
          (entry) => entry.category === priceBookCell.category && entry.unit === priceBookCell.unit
        );
  const groups = groupEntries(shown);
  const cellCount =
    priceBookCell === null ? null : counts.get(cellKey(priceBookCell.category, priceBookCell.unit));
  const positionsUnderCell: WorkspacePosition[] =
    priceBookCell === null
      ? []
      : positions.filter(
          (row) => row.category === priceBookCell.category && row.unit === priceBookCell.unit
        );

  return (
    <>
      <section className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-medium">{copy.priceBook.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {copy.priceBook.subtitle(bidder)} · {copy.priceBook.entries(priceBook.length)}
        </p>
      </section>

      {/* Coverage: the categories and units this workspace tenders and this
          contractor has priced, united. An empty cell is the gap a position of
          that shape falls into -- the radiators of prompt 2, for Farbwerk Meier. */}
      <section className="flex flex-col gap-2 border-b border-slate-200 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {copy.priceBook.coverageTitle}
        </h3>
        <p className="text-xs text-slate-500">{copy.priceBook.coverageHint}</p>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="border-collapse text-sm" data-testid="coverage">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500">
                <th className="py-1 pr-3 font-medium" />
                {axes.units.map((unit) => (
                  <th key={unit} className="py-1 pr-3 text-right font-medium">
                    {unit}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {axes.categories.map((category) => (
                <tr key={category} className="border-t border-slate-100">
                  <th className="py-1 pr-3 text-left text-xs font-medium text-slate-600">
                    {category}
                  </th>
                  {axes.units.map((unit) => {
                    const count = counts.get(cellKey(category, unit));
                    const selected =
                      priceBookCell?.category === category && priceBookCell?.unit === unit;
                    return (
                      <td key={unit} className="py-1 pr-3 text-right">
                        <button
                          type="button"
                          aria-pressed={selected}
                          aria-label={copy.priceBook.cellTitle(category, unit)}
                          onClick={() =>
                            selectPriceBookCell(selected ? null : { category, unit })
                          }
                          className={
                            selected
                              ? "rounded border border-slate-900 px-1.5 py-0.5 text-xs tabular-nums text-slate-900"
                              : "rounded border border-transparent px-1.5 py-0.5 text-xs tabular-nums text-slate-700 hover:border-slate-400"
                          }
                        >
                          {count === undefined ? (
                            <span className="text-slate-400">{copy.priceBook.noEntry}</span>
                          ) : (
                            count
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {priceBookCell !== null && (
          <div
            data-testid="cell-detail"
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-xs text-slate-700"
          >
            <p className="font-medium text-slate-900">
              {copy.priceBook.cellTitle(priceBookCell.category, priceBookCell.unit)}
              {cellCount === undefined ? ` · ${copy.priceBook.noEntry}` : ` · ${cellCount}`}
            </p>
            {cellCount === undefined && (
              <>
                {positionsUnderCell.length === 0 ? (
                  <p className="mt-1 text-slate-500">{copy.priceBook.noPositionsUnder}</p>
                ) : (
                  <>
                    <p className="mt-1 text-slate-500">
                      {copy.priceBook.positionsUnder(positionsUnderCell.length)}
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {positionsUnderCell.map((row) => (
                        <li key={`${row.tender_id}-${row.oz}`}>
                          <span className="font-mono text-[11px] text-slate-500">
                            {row.tender_id} · {row.oz}
                          </span>{" "}
                          {row.text}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {/* The way out, in the same words check_bid uses. */}
                <p className="mt-1.5 text-slate-700">
                  {copy.priceBook.actionNoEntry(priceBookCell.category, priceBookCell.unit)}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => selectPriceBookCell(null)}
              className="mt-1.5 text-xs text-slate-500 underline hover:text-slate-900"
            >
              {copy.priceBook.showAll}
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            {copy.priceBook.searchLabel}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.priceBook.searchPlaceholder}
              className="w-72 rounded border border-slate-300 px-1.5 py-1 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </label>
          <span className="text-xs text-slate-500">
            {priceBookCell === null
              ? copy.priceBook.entries(shown.length)
              : copy.priceBook.showingCell(priceBookCell.category, priceBookCell.unit)}
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="text-xs text-slate-500">{copy.priceBook.noMatches}</p>
        ) : (
          groups.map((group) => (
            <div key={group.category} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.category}
              </h3>
              {group.units.map(({ unit, entries }) => (
                <div key={unit} className="-mx-1 overflow-x-auto px-1">
                  <table className="w-full min-w-[46rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                        <th className="w-24 py-1.5 pr-3 font-medium">{unit}</th>
                        <th className="py-1.5 pr-3 font-medium">{copy.priceBook.columnOriginal}</th>
                        <th className="w-40 py-1.5 pr-3 font-medium">{copy.priceBook.columnProject}</th>
                        <th className="w-32 py-1.5 pr-3 font-medium">{copy.priceBook.columnDate}</th>
                        <th className="w-28 py-1.5 pr-3 text-right font-medium">
                          {copy.priceBook.columnPrice}
                        </th>
                        <th className="w-56 py-1.5 font-medium">{copy.priceBook.columnKeywords}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id} className="border-b border-slate-100 align-top">
                          <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{entry.id}</td>
                          {/* The record, verbatim. Never translated. */}
                          <td className="py-1.5 pr-3">{entry.source_position_text}</td>
                          <td className="py-1.5 pr-3 text-slate-600">{entry.source_project}</td>
                          <td className="py-1.5 pr-3 text-slate-600">
                            {formatMonthYear(entry.source_date, language)}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {formatEuro(entry.unit_price)}
                          </td>
                          <td className="py-1.5">
                            <span className="flex flex-wrap gap-1">
                              {entry.keywords.map((keyword) => (
                                <span
                                  key={keyword}
                                  className="rounded border border-slate-200 px-1 font-mono text-[11px] text-slate-600"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))
        )}
        <p className="text-xs text-slate-400">{copy.priceBook.neverTranslated}</p>
      </section>

      {/* The questions to the client stay on the page here too. Not for the
          reading: the form IS the declarative ask_clarification tool, and a
          browser withdraws that tool the moment the form leaves the DOM -- the
          self-diagnosis dropped to ten on this screen before this section was
          here. The tool count must not depend on which screen a person is
          looking at. */}
      <Clarifications
        role="bidder"
        questions={clarifications}
        onAsk={(input) => askClarification({ tender_id: tenderId, ...input })}
        onAnswer={(questionId, answer) => answerClarification(questionId, answer)}
      />
    </>
  );
}
