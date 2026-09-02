import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import {
  findMatch,
  hasComparableShape,
  normalise,
  type PriceBookEntry
} from "./matching";
import { buildComparison } from "./comparison";
import {
  MAX_ROWS_PER_CALL,
  planPriceWrites,
  type PriceWriteInput,
  type SetBy
} from "./pricing";
import type {
  BidStatus,
  BidTotals,
  CheckAction,
  ClientPosition,
  Language,
  MissingDocument,
  Position,
  PreviousPrice,
  PriceBookRow,
  RequiredDocument,
  Role,
  SubmissionBlocker,
  Suggestion,
  Tender
} from "./types";
import { submissionBlockers } from "./submission";
import {
  createWorkspace,
  isWorkspaceId,
  resetWorkspace,
  workspaceExists
} from "./workspace";

type Variables = { workspaceId: string; role: Role };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// The API never throws at the caller. Errors are data, in the same shape the
// WebMCP tools use: { ok:false, error, hint }.
const fail = (error: string, hint: string) => ({ ok: false as const, error, hint });

/**
 * Every tender in this demo asks for the same four proofs (spec section 1).
 * They are a requirement of the client, so they are stated here rather than
 * derived from what a bidder happens to hold: a bidder missing a document must
 * still see it listed.
 */
const REQUIRED_DOCUMENTS: ReadonlyArray<{
  doc_type: string;
  label_en: string;
  label_de: string;
}> = [
  {
    doc_type: "trade_registration",
    label_en: "Trade registration",
    label_de: "Handwerkskarte"
  },
  {
    doc_type: "liability_insurance",
    label_en: "Liability insurance",
    label_de: "Haftpflichtversicherung"
  },
  { doc_type: "reference_project", label_en: "Reference project", label_de: "Referenzprojekt" },
  {
    doc_type: "tax_clearance",
    label_en: "Tax clearance certificate",
    label_de: "Unbedenklichkeitsbescheinigung"
  }
];

/**
 * Which language the texts of this request should come back in.
 *
 * This is the ONE place the interface language enters the API, and the mapping
 * functions below are the only ones that act on it. Everything else a tool
 * returns -- field names, reasons, warnings, error objects -- stays English,
 * because it is read by an agent, not by a person. What follows the language is
 * exactly what a person reads on paper: the position texts and the names of the
 * documents the client asks for.
 *
 * No header means English. Every script that talks to this API without one --
 * the eval runs, seed/verify_seed.py -- therefore sees what it always saw.
 */
const readLanguage = (c: { req: { header: (name: string) => string | undefined } }): Language =>
  c.req.header("X-Language")?.toLowerCase() === "de" ? "de" : "en";

/**
 * Which side of the table this request comes from.
 *
 * The ONE place the role enters the API. Everything that differs between the
 * two roles -- what a tender read returns, which routes answer at all -- is
 * decided from this value on the Worker, not from which tools the page
 * happened to register. Two external reviews found the same hole on 2
 * September: the page registered get_tender for the client, and the Worker,
 * knowing no role, handed the client the last-selected contractor's whole
 * draft. Registration is visibility; this is the boundary.
 *
 * No header means the contractor: the evals, the how-to-test page and every
 * script that talks to the API directly see what they always saw.
 */
const readRole = (c: { req: { header: (name: string) => string | undefined } }): Role =>
  c.req.header("X-Role")?.toLowerCase() === "client" ? "client" : "bidder";

const pick = (language: Language, english: string, german: string) =>
  language === "de" ? german : english;

const pickNullable = (language: Language, english: string | null, german: string | null) =>
  language === "de" ? german : english;

/**
 * What a check finding asks the person to do next. Written here, once, in both
 * languages -- never by the agent. A finding that only says what is wrong
 * leaves the person in the chat with "then it cannot be done"; a finding that
 * says what to do next keeps the demo, and the bid, moving.
 */
const CHECK_ACTIONS = {
  open_no_shape: {
    en: (category: string, unit: string) =>
      `no entry for ${category}/${unit} — set the price yourself, or ask your agent to derive one; you confirm it.`,
    de: (category: string, unit: string) =>
      `kein Eintrag für ${category}/${unit} — setzen Sie den Preis selbst, oder lassen Sie ihn von Ihrem Agenten herleiten; Sie bestätigen ihn.`
  },
  open_has_proposal: {
    en: (price: number, id: string) =>
      `your price book proposes ${price} from ${id} — take it, or derive a price of your own; you confirm it.`,
    de: (price: number, id: string) =>
      `Ihr Preisbuch schlägt ${price} aus ${id} vor — übernehmen Sie ihn, oder leiten Sie einen eigenen Preis her; Sie bestätigen ihn.`
  },
  open_no_match: {
    en: (category: string, unit: string) =>
      `entries for ${category}/${unit} exist, but none matched this wording — take one from your price book, or ask your agent to derive a price; you confirm it.`,
    de: (category: string, unit: string) =>
      `Einträge für ${category}/${unit} gibt es, aber keiner passt zu dieser Formulierung — nehmen Sie einen aus Ihrem Preisbuch, oder lassen Sie einen Preis von Ihrem Agenten herleiten; Sie bestätigen ihn.`
  },
  outlier: {
    en: (deviation: number, id: string) =>
      `${Math.abs(deviation)} % ${deviation > 0 ? "above" : "below"} your own past price ${id} — keep it if that is intended, otherwise take the price book line.`,
    de: (deviation: number, id: string) =>
      `${Math.abs(deviation)} % ${deviation > 0 ? "über" : "unter"} Ihrem eigenen früheren Preis ${id} — behalten Sie ihn, wenn das so gewollt ist, sonst übernehmen Sie die Preisbuchzeile.`
  },
  document_expired: {
    en: "tell your agent the new expiry date — you confirm it on the page — or upload a current certificate.",
    de: "nennen Sie Ihrem Agenten das neue Ablaufdatum — Sie bestätigen es auf der Seite — oder laden Sie einen aktuellen Nachweis hoch."
  },
  document_not_held: {
    en: "tell your agent the expiry date of the certificate you hold — you confirm it on the page — or obtain one before the deadline.",
    de: "nennen Sie Ihrem Agenten das Ablaufdatum des Nachweises, den Sie haben — Sie bestätigen es auf der Seite — oder beschaffen Sie einen vor der Frist."
  },
  deadline_passed: {
    en: "the deadline has passed — ask the client whether a late bid is still accepted.",
    de: "die Frist ist abgelaufen — fragen Sie den Auftraggeber, ob ein verspätetes Angebot noch angenommen wird."
  },
  deadline_close: {
    en: "hand the bid in before the deadline; check it once more first.",
    de: "geben Sie das Angebot vor der Frist ab; prüfen Sie es vorher noch einmal."
  }
} as const;

const requiredDocuments = (language: Language, held: Map<string, string>): RequiredDocument[] =>
  REQUIRED_DOCUMENTS.map((document) => ({
    doc_type: document.doc_type,
    label: pick(language, document.label_en, document.label_de),
    valid_until: held.get(document.doc_type) ?? null
  }));

type TenderRow = {
  id: string;
  title_en: string;
  title_de: string;
  client_name: string;
  city: string;
  trade: string;
  status: "open" | "closed";
  due_date: string;
  positions_count: number;
  my_bid_status: string | null;
};

type PositionRow = {
  oz: string;
  text_en: string;
  text_de: string;
  long_text_en: string | null;
  long_text_de: string | null;
  quantity: number;
  unit: string;
  category: string;
  contingency: number;
  my_unit_price: number | null;
  set_by: "agent" | "human" | null;
  note: string | null;
  source_id: string | null;
  source_project: string | null;
  source_date: string | null;
  source_position_text: string | null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const toTender = (row: TenderRow, language: Language): Tender => ({
  id: row.id,
  title: pick(language, row.title_en, row.title_de),
  client: row.client_name,
  city: row.city,
  trade: row.trade,
  status: row.status,
  due_date: row.due_date,
  positions_count: row.positions_count,
  my_bid_status: (row.my_bid_status ?? "none") as BidStatus
});

/**
 * The client's projection: the bill of quantities as the client wrote it,
 * and nothing of any bid. No bidder, no draft status, no prices, no line
 * totals, no provenance, no remarks, no documents. These two mappers are the
 * boundary a test holds shut, key by key and recursively.
 */
const toClientTender = (row: TenderRow, language: Language): Omit<Tender, "my_bid_status"> => ({
  id: row.id,
  title: pick(language, row.title_en, row.title_de),
  client: row.client_name,
  city: row.city,
  trade: row.trade,
  status: row.status,
  due_date: row.due_date,
  positions_count: row.positions_count
});

const toClientPosition = (row: PositionRow, language: Language): ClientPosition => ({
  oz: row.oz,
  text: pick(language, row.text_en, row.text_de),
  long_text: pickNullable(language, row.long_text_en, row.long_text_de),
  quantity: row.quantity,
  unit: row.unit,
  category: row.category,
  contingency: row.contingency === 1
});

const toPosition = (row: PositionRow, language: Language): Position => ({
  oz: row.oz,
  text: pick(language, row.text_en, row.text_de),
  long_text: pickNullable(language, row.long_text_en, row.long_text_de),
  quantity: row.quantity,
  unit: row.unit,
  category: row.category,
  contingency: row.contingency === 1,
  my_unit_price: row.my_unit_price,
  line_total: row.my_unit_price === null ? null : round2(row.quantity * row.my_unit_price),
  set_by: row.set_by,
  note: row.note ?? null,
  source:
    row.source_id === null
      ? null
      : {
          price_book_id: row.source_id,
          source_project: row.source_project ?? "",
          source_date: row.source_date ?? "",
          source_position_text: row.source_position_text ?? ""
        }
});

const TENDER_COLUMNS = `
  t.id, t.title_en, t.title_de, t.client_name, t.city, t.trade, t.status, t.due_date,
  (SELECT COUNT(*) FROM positions p
    WHERE p.workspace_id = t.workspace_id AND p.tender_id = t.id) AS positions_count,
  (SELECT b.status FROM bids b
    WHERE b.workspace_id = t.workspace_id AND b.tender_id = t.id
      AND b.bidder_id = ?2) AS my_bid_status
`;

/**
 * Which bidder the read is for. The header lets the bidder change later without
 * a second set of routes; without it the demo bidder of the workspace is used.
 */
async function resolveBidder(db: D1Database, workspaceId: string, requested?: string) {
  if (requested) {
    const row = await db
      .prepare("SELECT id FROM bidders WHERE workspace_id = ?1 AND id = ?2")
      .bind(workspaceId, requested)
      .first<{ id: string }>();
    if (row) return row.id;
  }
  const demo = await db
    .prepare("SELECT id FROM bidders WHERE workspace_id = ?1 ORDER BY is_demo DESC, id LIMIT 1")
    .bind(workspaceId)
    .first<{ id: string }>();
  return demo?.id ?? "B-A";
}

app.get("/api/health", async (c) => {
  const startedAt = Date.now();
  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return c.json({
      ok: row?.ok === 1,
      service: "biddesk",
      d1: "reachable",
      duration_ms: Date.now() - startedAt
    });
  } catch (caught) {
    return c.json(
      fail(
        "d1_unreachable",
        caught instanceof Error ? caught.message : "The D1 binding DB did not answer."
      ),
      500
    );
  }
});

/**
 * Hands back a usable workspace, always. Pass the id from localStorage as
 * { id }: it is adopted when it still exists, and silently replaced by a fresh
 * seeded one when it does not. There is no error path for the visitor here:
 * an unknown or swept-up id is a new workspace, never an error screen.
 */
app.post("/api/workspace", async (c) => {
  const body = await c.req.json<{ id?: unknown }>().catch(() => ({}) as { id?: unknown });

  if (isWorkspaceId(body.id) && (await workspaceExists(c.env.DB, body.id))) {
    return c.json({ ok: true, workspace_id: body.id, created: false });
  }

  const workspaceId = await createWorkspace(c.env.DB);
  return c.json({ ok: true, workspace_id: workspaceId, created: true }, 201);
});

/** Back to the seed state. Delete and re-seed share one batch. */
app.post("/api/workspace/:id/reset", async (c) => {
  const workspaceId = c.req.param("id");
  if (!isWorkspaceId(workspaceId)) {
    return c.json(
      fail(
        "invalid_workspace_id",
        "A workspace id is a UUID. Create one with POST /api/workspace."
      ),
      400
    );
  }

  await resetWorkspace(c.env.DB, workspaceId);
  return c.json({ ok: true, workspace_id: workspaceId, reset: true });
});

// Read routes carry the workspace in a header, never in the URL: the page URL
// must stay free of state so a shared link can never leak someone else's state.
// A vanished workspace answers `unknown_workspace`; the client turns that into
// a fresh one instead of an error screen.
const requireWorkspace: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (c, next) => {
  const workspaceId = c.req.header("X-Workspace-Id");
  if (!isWorkspaceId(workspaceId) || !(await workspaceExists(c.env.DB, workspaceId))) {
    return c.json(
      fail(
        "unknown_workspace",
        "Create a workspace with POST /api/workspace and resend the X-Workspace-Id header."
      ),
      404
    );
  }
  c.set("workspaceId", workspaceId);
  c.set("role", readRole(c));
  await next();
};

/**
 * Refuses a route to the role it does not belong to. Registration keeps the
 * other side's tools out of sight; this keeps them out of reach -- a request
 * that arrives with the wrong role gets a 403 and a named reason, whatever
 * the page registered or a script sent by hand.
 */
const onlyRole =
  (allowed: Role, hint: string): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> =>
  async (c, next) => {
    if (c.get("role") !== allowed) {
      return c.json(fail("role_not_allowed", hint), 403);
    }
    await next();
  };

const bidderOnly = onlyRole(
  "bidder",
  "This belongs to the contractor role. The client reads prices through get_price_comparison alone, after the deadline; switch the role in the header for the contractor's work."
);
const clientOnly = onlyRole(
  "client",
  "This belongs to the client role. Switch the role in the header to compare bids or answer questions."
);

app.use("/api/tenders", requireWorkspace);
app.use("/api/tenders/*", requireWorkspace);

app.get("/api/tenders", async (c) => {
  const workspaceId = c.get("workspaceId");
  const role = c.get("role");
  // The client has no bidder. The subselect for my_bid_status then matches
  // nothing, and the projection below leaves the field out altogether.
  const bidderId =
    role === "client"
      ? ""
      : await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));
  const language = readLanguage(c);

  const status = c.req.query("status");
  const trade = c.req.query("trade");
  const city = c.req.query("city");
  const dueBefore = c.req.query("due_before");

  const where = ["t.workspace_id = ?1"];
  const params: (string | number)[] = [workspaceId, bidderId];

  if (status && status !== "all") {
    params.push(status);
    where.push(`t.status = ?${params.length}`);
  }
  if (trade) {
    params.push(trade.toLowerCase());
    where.push(`LOWER(t.trade) = ?${params.length}`);
  }
  if (city) {
    params.push(city.toLowerCase());
    where.push(`LOWER(t.city) = ?${params.length}`);
  }
  if (dueBefore) {
    params.push(dueBefore);
    where.push(`t.due_date < ?${params.length}`);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ${TENDER_COLUMNS}
       FROM tenders t
      WHERE ${where.join(" AND ")}
      ORDER BY (t.status = 'open') DESC, t.due_date`
  )
    .bind(...params)
    .all<TenderRow>();

  if (role === "client") {
    return c.json({
      ok: true,
      role,
      tenders: results.map((row) => toClientTender(row, language))
    });
  }

  return c.json({
    ok: true,
    role,
    bidder_id: bidderId,
    tenders: results.map((row) => toTender(row, language))
  });
});

app.get("/api/tenders/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
  const role = c.get("role");
  const language = readLanguage(c);

  if (role === "client") {
    // No bidder is resolved and no bid is joined: the client's read never
    // touches bid_prices, bids or bidder_documents at all.
    const tender = await c.env.DB.prepare(
      `SELECT ${TENDER_COLUMNS}
         FROM tenders t
        WHERE t.workspace_id = ?1 AND t.id = ?3`
    )
      .bind(workspaceId, "", tenderId)
      .first<TenderRow>();
    if (!tender) {
      return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
    }
    const positions = await c.env.DB.prepare(
      `SELECT p.oz, p.text_en, p.text_de, p.long_text_en, p.long_text_de,
              p.quantity, p.unit, p.category, p.contingency
         FROM positions p
        WHERE p.workspace_id = ?1 AND p.tender_id = ?2
        ORDER BY p.sort_no`
    )
      .bind(workspaceId, tenderId)
      .all<PositionRow>();

    return c.json({
      ok: true,
      role,
      tender: toClientTender(tender, language),
      positions: positions.results.map((row) => toClientPosition(row, language))
    });
  }

  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));

  const tender = await c.env.DB.prepare(
    `SELECT ${TENDER_COLUMNS}
       FROM tenders t
      WHERE t.workspace_id = ?1 AND t.id = ?3`
  )
    .bind(workspaceId, bidderId, tenderId)
    .first<TenderRow>();

  if (!tender) {
    return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
  }

  const [positions, documents] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.oz, p.text_en, p.text_de, p.long_text_en, p.long_text_de,
              p.quantity, p.unit, p.category, p.contingency,
              bp.unit_price AS my_unit_price, bp.set_by, bp.note,
              pb.id AS source_id, pb.source_project, pb.source_date, pb.source_position_text
         FROM positions p
         LEFT JOIN bids b
           ON b.workspace_id = p.workspace_id
          AND b.tender_id = p.tender_id
          AND b.bidder_id = ?3
         LEFT JOIN bid_prices bp
           ON bp.workspace_id = p.workspace_id
          AND bp.bid_id = b.id
          AND bp.oz = p.oz
         LEFT JOIN price_book pb
           ON pb.workspace_id = p.workspace_id
          AND pb.id = bp.price_book_id
        WHERE p.workspace_id = ?1 AND p.tender_id = ?2
        ORDER BY p.sort_no`
    )
      .bind(workspaceId, tenderId, bidderId)
      .all<PositionRow>(),
    c.env.DB.prepare(
      "SELECT doc_type, valid_until FROM bidder_documents WHERE workspace_id = ?1 AND bidder_id = ?2"
    )
      .bind(workspaceId, bidderId)
      .all<{ doc_type: string; valid_until: string }>()
  ]);

  const held = new Map(documents.results.map((row) => [row.doc_type, row.valid_until]));

  return c.json({
    ok: true,
    role,
    bidder_id: bidderId,
    tender: toTender(tender, language),
    positions: positions.results.map((row) => toPosition(row, language)),
    required_documents: requiredDocuments(language, held)
  });
});

type PriceBookDbRow = Omit<PriceBookEntry, "keywords"> & { keywords: string };

/**
 * The bidder's price book, ordered by id. The order is not cosmetic: ties in the
 * matcher go to the earlier entry, so it has to stay the seed order.
 */
async function readPriceBook(
  db: D1Database,
  workspaceId: string,
  bidderId: string
): Promise<PriceBookEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT id, category, unit, keywords, unit_price,
              source_project, source_date, source_position_text
         FROM price_book
        WHERE workspace_id = ?1 AND bidder_id = ?2
        ORDER BY id`
    )
    .bind(workspaceId, bidderId)
    .all<PriceBookDbRow>();

  return results.map((row) => ({
    ...row,
    keywords: JSON.parse(row.keywords) as string[]
  }));
}

app.use("/api/price-book", requireWorkspace);

app.get("/api/price-book", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));
  const category = c.req.query("category");
  const query = c.req.query("query");

  let entries = await readPriceBook(c.env.DB, workspaceId, bidderId);

  if (category) {
    entries = entries.filter((entry) => entry.category === category.toLowerCase());
  }
  if (query) {
    // Same normalisation as the matcher, so what a search finds and what a
    // suggestion matches on cannot drift apart.
    const needle = normalise(query);
    entries = entries.filter(
      (entry) =>
        entry.keywords.some((keyword) => normalise(keyword).includes(needle)) ||
        normalise(entry.source_position_text).includes(needle)
    );
  }

  const rows: PriceBookRow[] = entries;
  return c.json({ ok: true, bidder_id: bidderId, entries: rows });
});

app.get("/api/tenders/:id/suggestions", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));

  const requested = c.req
    .query("oz")
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const [positions, priceBook] = await Promise.all([
    c.env.DB.prepare(
      `SELECT oz, text_de, unit, category, sort_no
         FROM positions
        WHERE workspace_id = ?1 AND tender_id = ?2
        ORDER BY sort_no`
    )
      .bind(workspaceId, tenderId)
      .all<{ oz: string; text_de: string; unit: string; category: string }>(),
    readPriceBook(c.env.DB, workspaceId, bidderId)
  ]);

  if (positions.results.length === 0) {
    return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
  }

  const wanted = requested?.length ? new Set(requested) : null;
  const unknown = requested?.filter(
    (oz) => !positions.results.some((position) => position.oz === oz)
  );
  if (unknown && unknown.length > 0) {
    return c.json(
      fail("unknown_position", `Not a position of ${tenderId}: ${unknown.join(", ")}.`),
      400
    );
  }

  const suggestions: Suggestion[] = positions.results
    .filter((position) => wanted === null || wanted.has(position.oz))
    .map((position) => {
      const match = findMatch(priceBook, position);

      if (match === null) {
        return {
          oz: position.oz,
          unit_price: null,
          matched_terms: 0,
          // Says whether the price book held nothing of this shape at all, or
          // held lines of the right shape whose wording did not match.
          matched_on: hasComparableShape(priceBook, position) ? ["category", "unit"] : [],
          based_on: null,
          reason: "no comparable entry in your price book"
        } satisfies Suggestion;
      }

      const terms = match.matchedKeywords.length;
      return {
        oz: position.oz,
        unit_price: match.entry.unit_price,
        matched_terms: terms,
        matched_on: ["category", "unit"],
        based_on: {
          price_book_id: match.entry.id,
          source_project: match.entry.source_project,
          source_date: match.entry.source_date,
          source_position_text: match.entry.source_position_text
        },
        reason:
          terms === 1
            ? "Same category and unit; one search term matched."
            : `Same category and unit; ${terms} search terms matched.`
      } satisfies Suggestion;
    });

  return c.json({ ok: true, bidder_id: bidderId, tender_id: tenderId, suggestions });
});

type BidRow = { id: string; status: "draft" | "submitted" };

async function findBid(db: D1Database, workspaceId: string, tenderId: string, bidderId: string) {
  return db
    .prepare(
      "SELECT id, status FROM bids WHERE workspace_id = ?1 AND tender_id = ?2 AND bidder_id = ?3"
    )
    .bind(workspaceId, tenderId, bidderId)
    .first<BidRow>();
}

/** Net, contingency and how much of the bill of quantities is covered. */
async function readTotals(
  db: D1Database,
  workspaceId: string,
  tenderId: string,
  bidderId: string
): Promise<BidTotals> {
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN p.contingency = 0 THEN p.quantity * bp.unit_price END), 0) AS net,
         COALESCE(SUM(CASE WHEN p.contingency = 1 THEN p.quantity * bp.unit_price END), 0) AS contingency,
         COUNT(CASE WHEN p.contingency = 0 AND bp.unit_price IS NOT NULL THEN 1 END) AS positions_priced,
         COUNT(CASE WHEN p.contingency = 0 THEN 1 END) AS positions_billable
       FROM positions p
       LEFT JOIN bids b
         ON b.workspace_id = p.workspace_id AND b.tender_id = p.tender_id AND b.bidder_id = ?3
       LEFT JOIN bid_prices bp
         ON bp.workspace_id = p.workspace_id AND bp.bid_id = b.id AND bp.oz = p.oz
      WHERE p.workspace_id = ?1 AND p.tender_id = ?2`
    )
    .bind(workspaceId, tenderId, bidderId)
    .first<{
      net: number;
      contingency: number;
      positions_priced: number;
      positions_billable: number;
    }>();

  const net = round2(row?.net ?? 0);
  const contingency = round2(row?.contingency ?? 0);
  const priced = row?.positions_priced ?? 0;
  const billable = row?.positions_billable ?? 0;

  // Contingency positions are quoted but never counted into the bid total.
  return {
    net,
    contingency,
    positions_priced: priced,
    positions_open: billable - priced
  };
}

app.post("/api/tenders/:id/prices", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));

  const body = await c.req
    .json<{ prices?: unknown; set_by?: unknown }>()
    .catch(() => ({}) as { prices?: unknown; set_by?: unknown });

  const rows = Array.isArray(body.prices) ? (body.prices as PriceWriteInput[]) : null;
  if (rows === null || rows.length === 0) {
    return c.json(fail("no_prices", "Send prices as a non-empty array of rows."), 400);
  }
  if (rows.length > MAX_ROWS_PER_CALL) {
    return c.json(
      fail("too_many_prices", `At most ${MAX_ROWS_PER_CALL} rows per call, got ${rows.length}.`),
      400
    );
  }
  const setBy: SetBy = body.set_by === "human" ? "human" : "agent";

  const [positionRows, priceBook, bid] = await Promise.all([
    c.env.DB.prepare(
      "SELECT oz, quantity, contingency FROM positions WHERE workspace_id = ?1 AND tender_id = ?2"
    )
      .bind(workspaceId, tenderId)
      .all<{ oz: string; quantity: number; contingency: number }>(),
    readPriceBook(c.env.DB, workspaceId, bidderId),
    findBid(c.env.DB, workspaceId, tenderId, bidderId)
  ]);

  if (positionRows.results.length === 0) {
    return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
  }

  const plan = planPriceWrites(rows, {
    positions: new Map(
      positionRows.results.map((row) => [
        row.oz,
        { quantity: row.quantity, contingency: row.contingency === 1 }
      ])
    ),
    priceBook: new Map(priceBook.map((entry) => [entry.id, { unit_price: entry.unit_price }])),
    setBy,
    bidSubmitted: bid?.status === "submitted"
  });

  if (plan.applied.length > 0) {
    const bidId = bid?.id ?? crypto.randomUUID();
    const createdBid = bid === null;

    // What the rows looked like before, so undo can put them back exactly.
    const { results: previous } = await c.env.DB.prepare(
      `SELECT oz, unit_price, note, set_by, price_book_id
         FROM bid_prices
        WHERE workspace_id = ?1 AND bid_id = ?2`
    )
      .bind(workspaceId, bidId)
      .all<{
        oz: string;
        unit_price: number;
        note: string | null;
        set_by: string;
        price_book_id: string | null;
      }>();
    const before = new Map(previous.map((row) => [row.oz, row]));

    const statements = [];
    if (createdBid) {
      statements.push(
        c.env.DB.prepare(
          "INSERT INTO bids (workspace_id, id, tender_id, bidder_id, status) VALUES (?1, ?2, ?3, ?4, 'draft')"
        ).bind(workspaceId, bidId, tenderId, bidderId)
      );
    }

    for (const row of plan.applied) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO bid_prices (workspace_id, bid_id, oz, unit_price, note, set_by, price_book_id)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT (workspace_id, bid_id, oz)
           DO UPDATE SET unit_price = excluded.unit_price,
                         note = excluded.note,
                         set_by = excluded.set_by,
                         price_book_id = excluded.price_book_id`
        ).bind(
          workspaceId,
          bidId,
          row.oz,
          row.unit_price,
          row.note,
          row.set_by,
          row.price_book_id
        )
      );
    }

    // One write is one block in the change log, so undo takes back the whole
    // batch rather than a single line of it.
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO change_log (workspace_id, bid_id, kind, payload) VALUES (?1, ?2, 'set_unit_price', ?3)"
      ).bind(
        workspaceId,
        bidId,
        JSON.stringify({
          tender_id: tenderId,
          bidder_id: bidderId,
          created_bid: createdBid,
          entries: plan.applied.map((row) => ({
            oz: row.oz,
            previous: before.get(row.oz) ?? null
          }))
        })
      )
    );

    // Every valid row travels in one batch: no infrastructure hiccup can leave
    // half a block behind.
    await c.env.DB.batch(statements);
  }

  // The chip has to survive the write, so the source travels back with the row.
  const sources = new Map(priceBook.map((entry) => [entry.id, entry]));

  return c.json({
    ok: true,
    bidder_id: bidderId,
    tender_id: tenderId,
    applied: plan.applied.map((row) => {
      const entry = row.price_book_id === null ? undefined : sources.get(row.price_book_id);
      return {
        ...row,
        source: entry
          ? {
              price_book_id: entry.id,
              source_project: entry.source_project,
              source_date: entry.source_date,
              source_position_text: entry.source_position_text
            }
          : null
      };
    }),
    rejected: plan.rejected,
    totals: await readTotals(c.env.DB, workspaceId, tenderId, bidderId)
  });
});

app.post("/api/tenders/:id/undo", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));

  const body = await c.req.json<{ steps?: unknown }>().catch(() => ({}) as { steps?: unknown });
  const steps = body.steps === undefined ? 1 : body.steps;
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1 || steps > 20) {
    return c.json(fail("invalid_steps", "steps must be a whole number between 1 and 20."), 400);
  }

  const bid = await findBid(c.env.DB, workspaceId, tenderId, bidderId);
  if (bid === null) {
    return c.json({
      ok: true,
      undone: 0,
      totals: await readTotals(c.env.DB, workspaceId, tenderId, bidderId)
    });
  }
  if (bid.status === "submitted") {
    return c.json(
      fail("bid_already_submitted", "This bid has been handed in and cannot be changed."),
      409
    );
  }

  const { results: blocks } = await c.env.DB.prepare(
    `SELECT id, payload FROM change_log
      WHERE workspace_id = ?1 AND bid_id = ?2
      ORDER BY id DESC LIMIT ?3`
  )
    .bind(workspaceId, bid.id, steps)
    .all<{ id: number; payload: string }>();

  const statements = [];
  for (const block of blocks) {
    const payload = JSON.parse(block.payload) as {
      entries: { oz: string; previous: PreviousPrice | null }[];
    };
    // Newest block first, so an older block's state is restored on top.
    for (const entry of payload.entries) {
      statements.push(
        entry.previous === null
          ? c.env.DB.prepare(
              "DELETE FROM bid_prices WHERE workspace_id = ?1 AND bid_id = ?2 AND oz = ?3"
            ).bind(workspaceId, bid.id, entry.oz)
          : c.env.DB.prepare(
              `INSERT INTO bid_prices (workspace_id, bid_id, oz, unit_price, note, set_by, price_book_id)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
               ON CONFLICT (workspace_id, bid_id, oz)
               DO UPDATE SET unit_price = excluded.unit_price,
                             note = excluded.note,
                             set_by = excluded.set_by,
                             price_book_id = excluded.price_book_id`
            ).bind(
              workspaceId,
              bid.id,
              entry.oz,
              entry.previous.unit_price,
              entry.previous.note,
              entry.previous.set_by,
              entry.previous.price_book_id
            )
      );
    }
    statements.push(
      c.env.DB.prepare("DELETE FROM change_log WHERE workspace_id = ?1 AND id = ?2").bind(
        workspaceId,
        block.id
      )
    );
  }

  if (statements.length > 0) {
    // An empty draft that only exists because of the undone block goes too, so
    // the tender reads "no bid yet" again rather than "draft with nothing in it".
    statements.push(
      c.env.DB.prepare(
        `DELETE FROM bids
          WHERE workspace_id = ?1 AND id = ?2 AND status = 'draft'
            AND NOT EXISTS (SELECT 1 FROM bid_prices
                             WHERE workspace_id = ?1 AND bid_id = ?2)`
      ).bind(workspaceId, bid.id)
    );
    await c.env.DB.batch(statements);
  }

  return c.json({
    ok: true,
    undone: blocks.length,
    totals: await readTotals(c.env.DB, workspaceId, tenderId, bidderId)
  });
});

/** A price is an outlier once it is more than 30 % away from the past line. */
const OUTLIER_PCT = 30;
const MAX_QUESTION_LENGTH = 500;

/** The required documents this bidder lacks or holds expired, labelled in the reader's language. */
async function readMissingDocuments(
  db: D1Database,
  workspaceId: string,
  bidderId: string,
  language: Language
): Promise<MissingDocument[]> {
  const documents = await db
    .prepare(
      `SELECT doc_type, valid_until, valid_until < date('now') AS expired
         FROM bidder_documents WHERE workspace_id = ?1 AND bidder_id = ?2`
    )
    .bind(workspaceId, bidderId)
    .all<{ doc_type: string; valid_until: string; expired: number }>();

  const held = new Map(documents.results.map((row) => [row.doc_type, row]));
  return REQUIRED_DOCUMENTS.flatMap<MissingDocument>((required) => {
    const row = held.get(required.doc_type);
    // The label is the name of a document a person holds in their hand, so it
    // follows the language. Everything else in a check result -- the warnings,
    // the reasons, the field names -- is read by an agent and stays English.
    const document = {
      doc_type: required.doc_type,
      label: pick(language, required.label_en, required.label_de)
    };
    if (row === undefined) {
      return [{ ...document, valid_until: null, reason: "not_held" }];
    }
    if (row.expired === 1) {
      return [{ ...document, valid_until: row.valid_until, reason: "expired" }];
    }
    return [];
  });
}

/**
 * What stands between this draft and the dialog, read afresh. The submit
 * route asks this before it writes, so a blocker the check would report is a
 * blocker the submit refuses -- one function, one answer.
 */
async function readBlockers(
  db: D1Database,
  workspaceId: string,
  tenderId: string,
  bidId: string,
  bidderId: string,
  language: Language
): Promise<SubmissionBlocker[]> {
  const [positions, missingDocuments] = await Promise.all([
    db
      .prepare(
        `SELECT p.oz, p.text_en, p.text_de, p.contingency, bp.unit_price AS my_unit_price
           FROM positions p
           LEFT JOIN bid_prices bp
             ON bp.workspace_id = p.workspace_id AND bp.bid_id = ?3 AND bp.oz = p.oz
          WHERE p.workspace_id = ?1 AND p.tender_id = ?2
          ORDER BY p.sort_no`
      )
      .bind(workspaceId, tenderId, bidId)
      .all<{
        oz: string;
        text_en: string;
        text_de: string;
        contingency: number;
        my_unit_price: number | null;
      }>(),
    readMissingDocuments(db, workspaceId, bidderId, language)
  ]);

  return submissionBlockers({
    positions: positions.results.map((row) => ({
      oz: row.oz,
      text: pick(language, row.text_en, row.text_de),
      contingency: row.contingency === 1,
      my_unit_price: row.my_unit_price
    })),
    missingDocuments
  });
}

app.get("/api/tenders/:id/check", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));
  const language = readLanguage(c);

  const tender = await c.env.DB.prepare(
    `SELECT t.id, t.due_date,
            CAST(julianday(t.due_date) - julianday('now') AS INTEGER) AS due_in_days
       FROM tenders t WHERE t.workspace_id = ?1 AND t.id = ?2`
  )
    .bind(workspaceId, tenderId)
    .first<{ id: string; due_date: string; due_in_days: number }>();

  if (!tender) {
    return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
  }

  const bid = await findBid(c.env.DB, workspaceId, tenderId, bidderId);

  const [positions, priceBook, missingDocuments, changes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.oz, p.text_en, p.text_de, p.unit, p.category, p.contingency, p.sort_no,
              bp.unit_price AS my_unit_price
         FROM positions p
         LEFT JOIN bid_prices bp
           ON bp.workspace_id = p.workspace_id AND bp.bid_id = ?3 AND bp.oz = p.oz
        WHERE p.workspace_id = ?1 AND p.tender_id = ?2
        ORDER BY p.sort_no`
    )
      .bind(workspaceId, tenderId, bid?.id ?? "")
      .all<{
        oz: string;
        text_en: string;
        text_de: string;
        unit: string;
        category: string;
        contingency: number;
        my_unit_price: number | null;
      }>(),
    readPriceBook(c.env.DB, workspaceId, bidderId),
    readMissingDocuments(c.env.DB, workspaceId, bidderId, language),
    c.env.DB.prepare(
      "SELECT COUNT(*) AS blocks FROM change_log WHERE workspace_id = ?1 AND bid_id = ?2"
    )
      .bind(workspaceId, bid?.id ?? "")
      .first<{ blocks: number }>()
  ]);

  // "Open" means unpriced, and that includes the contingency positions: asked
  // which positions are still open, the honest answer names 03.04 AND 04.02.
  // Completeness is a different question -- only the billable ones decide that,
  // because contingency positions never count towards the bid total.
  const unpriced = positions.results.filter((row) => row.my_unit_price === null);
  const openPositions = unpriced.map((row) => row.oz);
  const openBillable = unpriced.filter((row) => row.contingency === 0);
  const openContingency = unpriced.filter((row) => row.contingency === 1);

  // Compared against this contractor's own past prices, not against a market:
  // BidDesk makes no claim about what work is worth anywhere else.
  const outliers = positions.results
    .filter((row) => row.my_unit_price !== null)
    .flatMap((row) => {
      const match = findMatch(priceBook, row);
      if (match === null) return [];
      const reference = match.entry.unit_price;
      const deviation = ((row.my_unit_price! - reference) / reference) * 100;
      if (Math.abs(deviation) <= OUTLIER_PCT) return [];
      return [
        {
          oz: row.oz,
          unit_price: row.my_unit_price!,
          price_book_price: reference,
          price_book_id: match.entry.id,
          deviation_pct: Math.round(deviation * 10) / 10
        }
      ];
    });

  // The same function the submit route asks. What the check names as a
  // blocker is exactly what keeps the dialog shut.
  const blockers = submissionBlockers({
    positions: positions.results.map((row) => ({
      oz: row.oz,
      text: pick(language, row.text_en, row.text_de),
      contingency: row.contingency === 1,
      my_unit_price: row.my_unit_price
    })),
    missingDocuments
  });

  const totals = await readTotals(c.env.DB, workspaceId, tenderId, bidderId);

  // Wording, not facts. Every number in here was read or calculated, never
  // produced: the agent may phrase, the application may not invent.
  const warnings: string[] = [];
  if (openBillable.length > 0) {
    warnings.push(
      `${openBillable.length} position${openBillable.length === 1 ? "" : "s"} without a price: ${openBillable.map((row) => row.oz).join(", ")}.`
    );
  }
  if (openContingency.length > 0) {
    warnings.push(
      `${openContingency.length} contingency position${openContingency.length === 1 ? "" : "s"} without a price: ${openContingency.map((row) => row.oz).join(", ")}. These are quoted separately and do not count towards the total.`
    );
  }
  for (const outlier of outliers) {
    warnings.push(
      `${outlier.oz} is ${outlier.deviation_pct > 0 ? "above" : "below"} your own past price of ${outlier.price_book_price} by ${Math.abs(outlier.deviation_pct)} %.`
    );
  }
  for (const missing of missingDocuments) {
    warnings.push(
      missing.reason === "expired"
        ? `${missing.label} expired on ${missing.valid_until}.`
        : `${missing.label} is not on file.`
    );
  }
  if (tender.due_in_days < 0) {
    warnings.push(`The deadline passed ${Math.abs(tender.due_in_days)} days ago.`);
  } else if (tender.due_in_days <= 3) {
    warnings.push(`Only ${tender.due_in_days} days left until the deadline.`);
  }

  // One sentence per finding saying what to do next -- ours, in the reader's
  // language. The warnings above stay English: they are read by an agent.
  const actions: CheckAction[] = [];
  for (const row of unpriced) {
    const match = findMatch(priceBook, row);
    const action =
      match !== null
        ? CHECK_ACTIONS.open_has_proposal[language](match.entry.unit_price, match.entry.id)
        : hasComparableShape(priceBook, row)
          ? CHECK_ACTIONS.open_no_match[language](row.category, row.unit)
          : CHECK_ACTIONS.open_no_shape[language](row.category, row.unit);
    actions.push({ finding: "open_position", oz: row.oz, action });
  }
  for (const outlier of outliers) {
    actions.push({
      finding: "outlier",
      oz: outlier.oz,
      action: CHECK_ACTIONS.outlier[language](outlier.deviation_pct, outlier.price_book_id)
    });
  }
  for (const missing of missingDocuments) {
    actions.push({
      finding: "document",
      doc_type: missing.doc_type,
      action:
        missing.reason === "expired"
          ? CHECK_ACTIONS.document_expired[language]
          : CHECK_ACTIONS.document_not_held[language]
    });
  }
  if (tender.due_in_days < 0) {
    actions.push({ finding: "deadline", action: CHECK_ACTIONS.deadline_passed[language] });
  } else if (tender.due_in_days <= 3) {
    actions.push({ finding: "deadline", action: CHECK_ACTIONS.deadline_close[language] });
  }

  return c.json({
    ok: true,
    bidder_id: bidderId,
    tender_id: tenderId,
    status: bid?.status ?? "none",
    complete: openBillable.length === 0,
    open_positions: openPositions,
    outliers,
    missing_documents: missingDocuments,
    due_date: tender.due_date,
    due_in_days: tender.due_in_days,
    totals,
    positions_priced: totals.positions_priced,
    positions_open: totals.positions_open,
    undo_available: (changes?.blocks ?? 0) > 0,
    warnings,
    actions,
    blockers
  });
});

app.use("/api/clarifications", requireWorkspace);
app.use("/api/clarifications/*", requireWorkspace);

app.get("/api/clarifications", async (c) => {
  const workspaceId = c.get("workspaceId");
  const language = readLanguage(c);
  const tenderId = c.req.query("tender_id");
  const status = c.req.query("status");

  const where = ["c.workspace_id = ?1"];
  const params: string[] = [workspaceId];
  if (tenderId) {
    params.push(tenderId);
    where.push(`c.tender_id = ?${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`c.status = ?${params.length}`);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.tender_id, c.oz, c.question, c.answer, c.question_de, c.answer_de,
            c.status, c.created_at, b.name AS bidder
       FROM clarifications c
       LEFT JOIN bidders b ON b.workspace_id = c.workspace_id AND b.id = c.bidder_id
      WHERE ${where.join(" AND ")}
      ORDER BY c.created_at DESC, c.id DESC`
  )
    .bind(...params)
    .all<{
      id: string;
      tender_id: string;
      oz: string | null;
      question: string;
      answer: string | null;
      question_de: string | null;
      answer_de: string | null;
      status: string;
      created_at: string;
      bidder: string | null;
    }>();

  // Same boundary as the position texts: one text per field, in the reader's
  // language. Only seed rows carry a German version; what a person or an agent
  // typed comes back exactly as typed, in either language -- nobody translates
  // other parties' text, and the German columns are NULL for those rows.
  const questions = results.map(({ question_de, answer_de, ...row }) => ({
    ...row,
    question: language === "de" ? (question_de ?? row.question) : row.question,
    answer: language === "de" ? (answer_de ?? row.answer) : row.answer
  }));

  return c.json({ ok: true, questions });
});

app.post("/api/clarifications", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));
  const body = await c.req
    .json<{ tender_id?: unknown; oz?: unknown; question?: unknown }>()
    .catch(() => ({}) as Record<string, unknown>);

  const tenderId = typeof body.tender_id === "string" ? body.tender_id.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const oz = typeof body.oz === "string" && body.oz.trim().length > 0 ? body.oz.trim() : null;

  if (tenderId.length === 0) {
    return c.json(fail("invalid_input", "tender_id is required."), 400);
  }
  if (question.length === 0) {
    return c.json(fail("invalid_input", "question is required."), 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return c.json(
      fail("invalid_input", `question must be at most ${MAX_QUESTION_LENGTH} characters.`),
      400
    );
  }

  const tender = await c.env.DB.prepare(
    "SELECT id FROM tenders WHERE workspace_id = ?1 AND id = ?2"
  )
    .bind(workspaceId, tenderId)
    .first<{ id: string }>();
  if (!tender) {
    return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
  }
  if (oz !== null) {
    const position = await c.env.DB.prepare(
      "SELECT oz FROM positions WHERE workspace_id = ?1 AND tender_id = ?2 AND oz = ?3"
    )
      .bind(workspaceId, tenderId, oz)
      .first<{ oz: string }>();
    if (!position) {
      return c.json(fail("unknown_position", `${oz} is not a position of ${tenderId}.`), 400);
    }
  }

  const id = `Q-${crypto.randomUUID().slice(0, 8)}`;
  await c.env.DB.prepare(
    `INSERT INTO clarifications (workspace_id, id, tender_id, bidder_id, oz, question, status)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'open')`
  )
    .bind(workspaceId, id, tenderId, bidderId, oz, question)
    .run();

  return c.json({ ok: true, question_id: id, status: "open" }, 201);
});

app.post("/api/tenders/:id/submit", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));

  const bid = await findBid(c.env.DB, workspaceId, tenderId, bidderId);
  if (bid === null) {
    return c.json(fail("no_bid", "There is nothing to hand in: no prices have been entered."), 400);
  }
  if (bid.status === "submitted") {
    return c.json(fail("bid_already_submitted", "This bid has already been handed in."), 409);
  }

  // A blocker is not a confirmation. The page never opens the dialog while
  // one exists; the Worker refuses all the same, so a script cannot hand in
  // what the check would not let through.
  const blockers = await readBlockers(
    c.env.DB,
    workspaceId,
    tenderId,
    bid.id,
    bidderId,
    readLanguage(c)
  );
  if (blockers.length > 0) {
    return c.json(
      {
        ...fail(
          "bid_blocked",
          "The bid cannot be handed in yet: price every billable position and bring the required documents up to date first."
        ),
        blockers
      },
      409
    );
  }

  await c.env.DB.prepare(
    "UPDATE bids SET status = 'submitted', submitted_at = datetime('now') WHERE workspace_id = ?1 AND id = ?2"
  )
    .bind(workspaceId, bid.id)
    .run();

  const row = await c.env.DB.prepare(
    "SELECT submitted_at FROM bids WHERE workspace_id = ?1 AND id = ?2"
  )
    .bind(workspaceId, bid.id)
    .first<{ submitted_at: string }>();

  const totals = await readTotals(c.env.DB, workspaceId, tenderId, bidderId);

  return c.json({
    ok: true,
    tender_id: tenderId,
    bidder_id: bidderId,
    submitted_at: row?.submitted_at ?? "",
    total_net: totals.net,
    totals
  });
});

app.use("/api/bidders", requireWorkspace);

app.use("/api/documents/*", requireWorkspace);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (value: string) =>
  ISO_DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/**
 * Records the expiry date of one of this contractor's required documents, as
 * a person stated it and confirmed it on the page.
 *
 * Nothing is uploaded and nothing is verified here. A document in this demo is
 * metadata -- a label and a date -- and this route writes the date a person
 * put their hand on. Only the page's confirmation calls it; the tool that
 * relays the date writes nothing. A date already on file is not an error and
 * not a write. Contractor master data, not part of the bid: it works after the
 * bid is handed in, and undo does not cover it.
 */
app.post("/api/documents/:doc_type", bidderOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));
  const language = readLanguage(c);
  const docType = c.req.param("doc_type");

  const required = REQUIRED_DOCUMENTS.find((document) => document.doc_type === docType);
  if (required === undefined) {
    return c.json(
      fail(
        "unknown_document",
        `${docType} is not a document this client requires. Known: ${REQUIRED_DOCUMENTS.map((document) => document.doc_type).join(", ")}.`
      ),
      400
    );
  }

  const body = await c.req
    .json<{ valid_until?: unknown }>()
    .catch(() => ({}) as { valid_until?: unknown });
  const validUntil = typeof body.valid_until === "string" ? body.valid_until.trim() : "";
  if (!isRealDate(validUntil)) {
    return c.json(fail("invalid_date", "valid_until must be a calendar date written as YYYY-MM-DD."), 400);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (validUntil < today) {
    return c.json(
      fail(
        "date_in_the_past",
        `${validUntil} is in the past. A certificate that has already expired cannot be recorded as valid; state the date on the current one.`
      ),
      400
    );
  }

  const current = await c.env.DB.prepare(
    "SELECT valid_until FROM bidder_documents WHERE workspace_id = ?1 AND bidder_id = ?2 AND doc_type = ?3"
  )
    .bind(workspaceId, bidderId, docType)
    .first<{ valid_until: string }>();
  const previous = current?.valid_until ?? null;
  const label = pick(language, required.label_en, required.label_de);

  if (previous === validUntil) {
    return c.json({
      ok: true,
      changed: false,
      doc_type: docType,
      label,
      previous_valid_until: previous,
      valid_until: validUntil
    });
  }

  await c.env.DB.prepare(
    `INSERT INTO bidder_documents (workspace_id, bidder_id, doc_type, label_en, label_de, valid_until)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (workspace_id, bidder_id, doc_type) DO UPDATE SET valid_until = excluded.valid_until`
  )
    .bind(workspaceId, bidderId, docType, required.label_en, required.label_de, validUntil)
    .run();

  return c.json({
    ok: true,
    changed: true,
    doc_type: docType,
    label,
    previous_valid_until: previous,
    valid_until: validUntil
  });
});

app.get("/api/bidders", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, city, is_demo FROM bidders WHERE workspace_id = ?1 ORDER BY id"
  )
    .bind(c.get("workspaceId"))
    .all<{ id: string; name: string; city: string; is_demo: number }>();

  return c.json({
    ok: true,
    bidders: results.map((row) => ({ ...row, is_demo: row.is_demo === 1 }))
  });
});

app.get("/api/tenders/:id/comparison", clientOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
  const language = readLanguage(c);

  const tender = await c.env.DB.prepare(
    `SELECT id, title_en, title_de, status, due_date
       FROM tenders WHERE workspace_id = ?1 AND id = ?2`
  )
    .bind(workspaceId, tenderId)
    .first<{
      id: string;
      title_en: string;
      title_de: string;
      status: string;
      due_date: string;
    }>();

  if (!tender) {
    return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
  }

  const submissions = await c.env.DB.prepare(
    `SELECT submitted_at FROM bids
      WHERE workspace_id = ?1 AND tender_id = ?2 AND status = 'submitted'
      ORDER BY submitted_at`
  )
    .bind(workspaceId, tenderId)
    .all<{ submitted_at: string }>();

  // Sealed until the deadline. Not a setting, not a permission: there is simply
  // no branch here that hands out a price before the tender closes.
  if (tender.status !== "closed") {
    return c.json({
      ok: true,
      tender_id: tenderId,
      title: pick(language, tender.title_en, tender.title_de),
      sealed: true,
      sealed_until: tender.due_date,
      bids_received: submissions.results.length,
      received_at: submissions.results.map((row) => row.submitted_at),
      bidders: [],
      positions: [],
      note: `Bids are sealed until ${tender.due_date}. Until then the client can see how many arrived and when, and nothing else.`
    });
  }

  // One query, folded in memory. No UNION ALL: D1 caps the number of terms in a
  // compound SELECT (SQLITE_ERROR 7500, see docs/07).
  const { results } = await c.env.DB.prepare(
    `SELECT p.oz, p.text_en, p.text_de, p.quantity, p.unit, p.contingency,
            b.bidder_id, bd.name AS bidder_name, bp.unit_price
       FROM positions p
       LEFT JOIN bids b
         ON b.workspace_id = p.workspace_id AND b.tender_id = p.tender_id
        AND b.status = 'submitted'
       LEFT JOIN bidders bd
         ON bd.workspace_id = b.workspace_id AND bd.id = b.bidder_id
       LEFT JOIN bid_prices bp
         ON bp.workspace_id = p.workspace_id AND bp.bid_id = b.id AND bp.oz = p.oz
      WHERE p.workspace_id = ?1 AND p.tender_id = ?2
      ORDER BY p.sort_no, b.bidder_id`
  )
    .bind(workspaceId, tenderId)
    .all<{
      oz: string;
      text_en: string;
      text_de: string;
      quantity: number;
      unit: string;
      contingency: number;
      bidder_id: string | null;
      bidder_name: string | null;
      unit_price: number | null;
    }>();

  const comparison = buildComparison(
    results.map((row) => ({
      oz: row.oz,
      text: pick(language, row.text_en, row.text_de),
      quantity: row.quantity,
      unit: row.unit,
      contingency: row.contingency === 1,
      bidder_id: row.bidder_id,
      bidder_name: row.bidder_name,
      unit_price: row.unit_price
    }))
  );

  return c.json({
    ok: true,
    tender_id: tenderId,
    title: pick(language, tender.title_en, tender.title_de),
    sealed: false,
    sealed_until: null,
    bids_received: submissions.results.length,
    received_at: submissions.results.map((row) => row.submitted_at),
    ...comparison
  });
});

app.post("/api/clarifications/:id/answer", clientOnly, async (c) => {
  const workspaceId = c.get("workspaceId");
  const questionId = c.req.param("id");
  const body = await c.req
    .json<{ answer?: unknown }>()
    .catch(() => ({}) as { answer?: unknown });

  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (answer.length === 0) {
    return c.json(fail("invalid_input", "answer is required."), 400);
  }
  if (answer.length > MAX_QUESTION_LENGTH) {
    return c.json(
      fail("invalid_input", `answer must be at most ${MAX_QUESTION_LENGTH} characters.`),
      400
    );
  }

  const question = await c.env.DB.prepare(
    "SELECT id FROM clarifications WHERE workspace_id = ?1 AND id = ?2"
  )
    .bind(workspaceId, questionId)
    .first<{ id: string }>();
  if (!question) {
    return c.json(fail("question_not_found", `No question ${questionId} in this workspace.`), 404);
  }

  await c.env.DB.prepare(
    "UPDATE clarifications SET answer = ?3, status = 'answered' WHERE workspace_id = ?1 AND id = ?2"
  )
    .bind(workspaceId, questionId, answer)
    .run();

  // An answer to one bidder is an answer to all of them: equal information is
  // the point of a clarification round.
  return c.json({ ok: true, question_id: questionId, published_to: "all bidders" });
});

/**
 * Takes a bill of quantities that came from outside as a file.
 *
 * There is deliberately NO tool for this. The bill of quantities is the client's
 * document; in a real procurement a bidder may not create or alter one, and the
 * agent has no business doing it either. A person drags a file in, and from then
 * on the agent can price it like any other tender.
 */
app.post("/api/tenders/import", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = await c.req
    .json<{ title?: unknown; reference?: unknown; client?: unknown; positions?: unknown }>()
    .catch(() => ({}) as Record<string, unknown>);

  const rows = Array.isArray(body.positions) ? body.positions : [];
  if (rows.length === 0) {
    return c.json(fail("no_positions", "The file produced no positions."), 400);
  }
  if (rows.length > 200) {
    return c.json(
      fail("too_many_positions", `At most 200 positions per import, got ${rows.length}.`),
      400
    );
  }

  const title =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 200)
      : "Imported tender";
  const client =
    typeof body.client === "string" && body.client.trim().length > 0
      ? body.client.trim().slice(0, 120)
      : "Imported from file";

  // Keep the file's own reference when it is free, so the id a person reads in
  // their AVA software is the id they see here.
  const wanted =
    typeof body.reference === "string" && /^[A-Za-z0-9._-]{1,24}$/.test(body.reference.trim())
      ? body.reference.trim()
      : null;
  let tenderId = wanted ?? `T-IMP-${crypto.randomUUID().slice(0, 6)}`;
  const taken = await c.env.DB.prepare(
    "SELECT id FROM tenders WHERE workspace_id = ?1 AND id = ?2"
  )
    .bind(workspaceId, tenderId)
    .first<{ id: string }>();
  if (taken) tenderId = `${tenderId}-${crypto.randomUUID().slice(0, 4)}`;

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO tenders (workspace_id, id, title_en, title_de, client_name, city, trade, status, due_date)
            VALUES (?1, ?2, ?3, ?3, ?4, 'Düsseldorf', 'painting', 'open', date('now','+14 day'))`
    ).bind(workspaceId, tenderId, title, client)
  ];

  const seen = new Set<string>();
  let sortNo = 0;
  for (const entry of rows as Record<string, unknown>[]) {
    const oz = typeof entry.oz === "string" ? entry.oz.trim().slice(0, 24) : "";
    const text = typeof entry.text === "string" ? entry.text.trim().slice(0, 500) : "";
    const quantity = typeof entry.quantity === "number" ? entry.quantity : Number.NaN;
    const unit = typeof entry.unit === "string" ? entry.unit.trim().slice(0, 12) : "";
    if (oz === "" || text === "" || unit === "" || !Number.isFinite(quantity) || quantity < 0) {
      continue;
    }
    if (seen.has(oz)) continue;
    seen.add(oz);
    sortNo += 1;

    statements.push(
      c.env.DB.prepare(
        `INSERT INTO positions (workspace_id, tender_id, oz, sort_no, text_en, text_de,
                                long_text_en, long_text_de, quantity, unit, category, contingency)
              VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?6, ?7, ?8, ?9, ?10)`
      ).bind(
        workspaceId,
        tenderId,
        oz,
        sortNo,
        text,
        typeof entry.long_text === "string" ? entry.long_text.slice(0, 2000) : null,
        quantity,
        unit,
        typeof entry.category === "string" ? entry.category.trim().slice(0, 24) : "prep",
        entry.contingency === true ? 1 : 0
      )
    );
  }

  if (sortNo === 0) {
    return c.json(fail("no_usable_positions", "No position carried an item number, a quantity and a unit."), 400);
  }

  // One batch: a half-imported tender would be worse than none.
  await c.env.DB.batch(statements);

  return c.json({ ok: true, tender_id: tenderId, title, positions: sortNo }, 201);
});

app.all("/api/*", (c) => c.json(fail("not_found", "Unknown API route."), 404));

app.onError((err, c) =>
  c.json(
    fail("internal_error", err instanceof Error ? err.message : "Unexpected failure."),
    500
  )
);

export default {
  fetch: app.fetch
} satisfies ExportedHandler<Env>;
