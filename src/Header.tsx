import { useCopy } from "./i18n";
import type { View } from "./store";
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
 *
 * Orange appears here twice and nowhere else on the page: the wordmark and the
 * active screen tab. Everything else in the header is navy and ink.
 */
export default function Header({
  role,
  bidders,
  bidderId,
  language,
  clientName,
  view,
  onRole,
  onBidder,
  onLanguage,
  onView
}: {
  role: Role;
  bidders: Bidder[];
  bidderId: string | null;
  language: Language;
  /** The client of the open tender, so the role option can name it. */
  clientName: string | null;
  /** Bid or price book. Only the contractor has a second screen. */
  view: View;
  onRole: (role: Role) => void;
  onBidder: (id: string) => void;
  onLanguage: (language: Language) => void;
  onView: (view: View) => void;
}) {
  const copy = useCopy();

  return (
    // Fixed widths on the selects: a select takes the width of its longest
    // option, and "Client · Rheinpark Property Management" would push the
    // header into a second row at 1240 px. The client's name still shows in
    // full in the open list, and in the client role the select gets the room
    // the bidder select gave up.
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-2">
      <h1 className="mr-1 text-lg font-medium tracking-tight text-orange">BidDesk</h1>

      <label className="flex items-center gap-2 text-[13px] text-ink-muted">
        {copy.header.actingAs}
        <select
          value={role}
          onChange={(event) => onRole(event.target.value as Role)}
          className={role === "client" ? "field h-9 w-80 py-0 pr-8" : "field h-9 w-44 py-0 pr-8"}
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
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          {copy.header.biddingAs}
          <select
            value={bidderId ?? bidders[0]!.id}
            onChange={(event) => onBidder(event.target.value)}
            className="field h-9 w-[212px] py-0 pr-8"
          >
            {bidders.map((bidder) => (
              <option key={bidder.id} value={bidder.id}>
                {bidder.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {role === "bidder" && (
        // The price book is a second screen, not a route: switching never
        // reloads and never loses the workspace. The bid stays the entrance.
        <nav
          aria-label={copy.header.views}
          className="flex items-center gap-0.5 rounded-lg border border-line bg-elev p-0.5 text-[13px]"
        >
          {(["bid", "priceBook"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              aria-current={view === entry ? "page" : undefined}
              onClick={() => onView(entry)}
              className={
                view === entry
                  ? "rounded-md bg-white px-2.5 py-1 font-medium text-orange shadow-sm"
                  : "rounded-md px-2.5 py-1 text-ink-muted hover:text-ink"
              }
            >
              {entry === "bid" ? copy.header.viewBid : copy.header.viewPriceBook}
            </button>
          ))}
        </nav>
      )}

      <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-muted">
        {copy.header.language}
        <select
          value={language}
          onChange={(event) => onLanguage(event.target.value as Language)}
          className="field h-9 w-[124px] py-0 pr-8"
        >
          {/* Each language names itself. Somebody looking for their own is
              looking for the word they know, not for its translation. */}
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </label>

      <a
        href="/how-to-test"
        className="text-[13px] whitespace-nowrap text-navy underline decoration-navy/40 underline-offset-4 hover:decoration-navy"
      >
        {copy.header.howToTest}
      </a>
    </header>
  );
}
