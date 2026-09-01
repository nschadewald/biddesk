import { useCopy } from "./i18n";
import type { Bidder, Language, Role } from "./types";

/**
 * Role, bidder and language, all three switchable.
 *
 * The bidder switch is not a convenience. It is the cheapest proof that nothing
 * in this application is written for the fourteen seed lines: the same bill of
 * quantities produces two gaps for Farbwerk Meier, none for Brandt & Sohn and
 * six for Colorpoint. Nothing hard-coded could do that.
 *
 * The role switch withdraws one set of tools and registers the other. The
 * separation is in what exists, not in what is permitted.
 *
 * The language switch does neither. It changes what a person reads and nothing
 * else -- the tools keep their English names, descriptions and schemas, no
 * block is re-registered, and `toolchange` stays quiet. A German painter is the
 * audience here; the jury testing in English is a special case of that, which
 * is why English is what an unknown visitor gets.
 */
export default function Header({
  role,
  bidders,
  bidderId,
  language,
  clientName,
  onRole,
  onBidder,
  onLanguage
}: {
  role: Role;
  bidders: Bidder[];
  bidderId: string | null;
  language: Language;
  /** The client of the open tender, so the role option can name it. */
  clientName: string | null;
  onRole: (role: Role) => void;
  onBidder: (id: string) => void;
  onLanguage: (language: Language) => void;
}) {
  const copy = useCopy();

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 pb-3">
      <h1 className="text-base font-semibold tracking-tight">BidDesk</h1>

      <label className="flex items-center gap-2 text-xs text-slate-500">
        {copy.header.actingAs}
        <select
          value={role}
          onChange={(event) => onRole(event.target.value as Role)}
          className="rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
        >
          <option value="bidder">{copy.header.roleBidder}</option>
          <option value="client">
            {clientName === null
              ? copy.header.roleClient
              : `${copy.header.roleClient} · ${clientName}`}
          </option>
        </select>
      </label>

      {role === "bidder" && bidders.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-slate-500">
          {copy.header.biddingAs}
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

      <label className="flex items-center gap-2 text-xs text-slate-500">
        {copy.header.language}
        <select
          value={language}
          onChange={(event) => onLanguage(event.target.value as Language)}
          className="rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
        >
          {/* Each language names itself. Somebody looking for their own is
              looking for the word they know, not for its translation. */}
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </label>

      <a
        href="/how-to-test"
        className="ml-auto text-xs text-slate-500 underline hover:text-slate-900"
      >
        {copy.header.howToTest}
      </a>
    </header>
  );
}
