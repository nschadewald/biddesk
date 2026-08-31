import type { Bidder, Role } from "./types";

/**
 * Role and bidder, both switchable.
 *
 * The bidder switch is not a convenience. It is the cheapest proof that nothing
 * in this application is written for the fourteen seed lines: the same bill of
 * quantities produces two gaps for Farbwerk Meier, none for Brandt & Sohn and
 * six for Colorpoint. Nothing hard-coded could do that.
 *
 * The role switch withdraws one set of tools and registers the other. The
 * separation is in what exists, not in what is permitted.
 */
export default function Header({
  role,
  bidders,
  bidderId,
  onRole,
  onBidder
}: {
  role: Role;
  bidders: Bidder[];
  bidderId: string | null;
  onRole: (role: Role) => void;
  onBidder: (id: string) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 pb-3">
      <h1 className="text-base font-semibold tracking-tight">BidDesk</h1>

      <label className="flex items-center gap-2 text-xs text-slate-500">
        Acting as
        <select
          value={role}
          onChange={(event) => onRole(event.target.value as Role)}
          className="rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
        >
          <option value="bidder">Contractor</option>
          <option value="client">Client · Rheinpark Property Management</option>
        </select>
      </label>

      {role === "bidder" && bidders.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Bidding as
          <select
            value={bidderId ?? bidders[0]!.id}
            onChange={(event) => onBidder(event.target.value)}
            className="rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
          >
            {bidders.map((bidder) => (
              <option key={bidder.id} value={bidder.id}>
                {bidder.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <a
        href="/how-to-test"
        className="ml-auto text-xs text-slate-500 underline hover:text-slate-900"
      >
        How to test in 60 seconds
      </a>
    </header>
  );
}
