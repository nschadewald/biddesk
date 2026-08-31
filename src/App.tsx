import { useEffect, useState } from "react";
import { ensureWorkspace, loadTender } from "./api";
import { formatDate, formatEuro, formatQuantity } from "./format";
import type { TenderDetail } from "./types";

// The entry point is the bid screen, not a landing page: the URL opens the
// main tender straight away (spec section 11.1).
const DEMO_TENDER = "T-2026-014";

export default function App() {
  const [detail, setDetail] = useState<TenderDetail | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const workspaceId = await ensureWorkspace();
        const { detail: loaded } = await loadTender(DEMO_TENDER, workspaceId);
        if (!cancelled) setDetail(loaded);
      } catch (caught) {
        if (!cancelled) {
          setFailure(caught instanceof Error ? caught.message : "Could not load the tender.");
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failure) {
    return (
      <Frame>
        <p className="text-sm text-slate-600">{failure}</p>
      </Frame>
    );
  }

  if (!detail) {
    return (
      <Frame>
        <p className="text-sm text-slate-500">Loading tender…</p>
      </Frame>
    );
  }

  const { tender, positions } = detail;
  // Contingency positions are shown but never counted into the bid total.
  const net = 0;
  const contingency = 0;
  const priced = 0;
  const open = positions.filter((position) => !position.contingency).length;

  return (
    <Frame>
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight text-slate-900">BidDesk</h1>
          <span className="text-xs text-slate-400">{tender.client}</span>
        </div>
        <h2 className="mt-3 text-lg font-medium text-slate-900">{tender.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {tender.id} · {tender.city} · {positions.length} positions · due{" "}
          {formatDate(tender.due_date)}
        </p>
      </header>

      <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-slate-200 py-3 text-xs">
        <Total label="Net total" value={formatEuro(net)} strong />
        <Total label="Contingency positions" value={formatEuro(contingency)} />
        <Total label="Priced" value={`${priced} of ${open}`} />
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
            <th className="w-20 py-2 pr-3 font-medium">Item</th>
            <th className="py-2 pr-3 font-medium">Description</th>
            <th className="w-24 py-2 pr-3 text-right font-medium">Qty</th>
            <th className="w-16 py-2 pr-3 font-medium">Unit</th>
            <th className="w-32 py-2 pr-3 text-right font-medium">Unit price</th>
            <th className="w-32 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.oz} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-3 font-mono text-xs text-slate-500">{position.oz}</td>
              <td className="py-2 pr-3 text-slate-900">
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
              <td className="py-2 pr-3 text-right tabular-nums text-slate-400">—</td>
              <td className="py-2 text-right tabular-nums text-slate-400">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 text-slate-900">
      {children}
    </main>
  );
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
