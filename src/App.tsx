import { useEffect, useState } from "react";
import AgentPanel from "./AgentPanel";
import { formatDate, formatEuro } from "./format";
import PositionRow from "./PositionRow";
import { boot, resetDemo, setUnitPrices, undoLastChange, useAppState } from "./store";
import type { Position, Suggestion } from "./types";
import { useWebMCP } from "./webmcp/useWebMCP";

export default function App() {
  const state = useAppState();
  const webmcp = useWebMCP(state.role);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void boot();
  }, []);

  async function onReset() {
    setResetting(true);
    try {
      await resetDemo();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-screen text-slate-900">
      <main className="flex min-w-0 flex-1 flex-col gap-4 px-6 py-8">
        {state.status === "failed" ? (
          <p className="text-sm text-slate-600">{state.failure}</p>
        ) : state.detail === null ? (
          <p className="text-sm text-slate-500">Loading tender…</p>
        ) : (
          <BidScreen />
        )}
      </main>
      <AgentPanel webmcp={webmcp} onReset={onReset} resetting={resetting} />
    </div>
  );
}

function BidScreen() {
  const { detail, suggestions, rejections, tenderId } = useAppState();
  if (!detail) return null;

  const { tender, positions } = detail;
  const net = sum(positions.filter((position) => !position.contingency));
  const contingency = sum(positions.filter((position) => position.contingency));
  const billable = positions.filter((position) => !position.contingency);
  const priced = billable.filter((position) => position.my_unit_price !== null).length;

  // The open proposals, in the order of the bill of quantities. A gap has no
  // price and is therefore never part of what "apply all" applies.
  const openProposals = positions
    .map((position) => suggestions[position.oz])
    .filter(
      (suggestion): suggestion is Suggestion =>
        suggestion !== undefined &&
        suggestion.unit_price !== null &&
        positions.find((position) => position.oz === suggestion.oz)?.my_unit_price === null
    );

  // The button and the tool go through the same store action. There is no
  // second path into the bid, so the two cannot drift apart.
  const apply = (proposals: Suggestion[]) =>
    void setUnitPrices(
      tenderId,
      proposals.map((proposal) => ({
        oz: proposal.oz,
        unit_price: proposal.unit_price!,
        price_book_id: proposal.based_on!.price_book_id
      })),
      "human"
    );

  const enter = (oz: string, unitPrice: number) =>
    void setUnitPrices(tenderId, [{ oz, unit_price: unitPrice }], "human");

  return (
    <>
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight">BidDesk</h1>
          <span className="text-xs text-slate-400">{tender.client}</span>
        </div>
        <h2 className="mt-3 text-lg font-medium">{tender.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {tender.id} · {tender.city} · {positions.length} positions · due{" "}
          {formatDate(tender.due_date)}
        </p>
      </header>

      <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-slate-200 py-3 text-xs">
        <Total label="Net total" value={formatEuro(net)} strong />
        <Total label="Contingency positions" value={formatEuro(contingency)} />
        <Total label="Priced" value={`${priced} of ${billable.length}`} />

        <span className="ml-auto flex items-center gap-2">
          {openProposals.length > 0 && (
            <button
              type="button"
              onClick={() => apply(openProposals)}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Apply all suggestions ({openProposals.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => void undoLastChange(1)}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
          >
            Undo
          </button>
        </span>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
            <th className="w-20 py-2 pr-3 font-medium">Item</th>
            <th className="py-2 pr-3 font-medium">Description</th>
            <th className="w-24 py-2 pr-3 text-right font-medium">Qty</th>
            <th className="w-16 py-2 pr-3 font-medium">Unit</th>
            <th className="w-60 py-2 pr-3 text-right font-medium">Unit price</th>
            <th className="w-28 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <PositionRow
              key={position.oz}
              position={position}
              suggestion={suggestions[position.oz]}
              rejection={rejections[position.oz]}
              onAccept={(proposal) => apply([proposal])}
              onEnter={enter}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Contingency positions are quoted but never counted into the bid total. */
function sum(positions: Position[]): number {
  const total = positions.reduce((carry, position) => carry + (position.line_total ?? 0), 0);
  return Math.round(total * 100) / 100;
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          strong
            ? "text-sm font-semibold tabular-nums text-slate-900"
            : "text-sm tabular-nums text-slate-700"
        }
      >
        {value}
      </span>
    </span>
  );
}
