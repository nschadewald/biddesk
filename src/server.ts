import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import {
  findMatch,
  hasComparableShape,
  normalise,
  type PriceBookEntry
} from "./matching";
import {
  MAX_ROWS_PER_CALL,
  planPriceWrites,
  type PriceWriteInput,
  type SetBy
} from "./pricing";
import type {
  BidStatus,
  BidTotals,
  Position,
  PreviousPrice,
  PriceBookRow,
  RequiredDocument,
  Suggestion,
  Tender
} from "./types";
import {
  createWorkspace,
  isWorkspaceId,
  resetWorkspace,
  workspaceExists
} from "./workspace";

type Variables = { workspaceId: string };

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
const REQUIRED_DOCUMENTS: ReadonlyArray<Omit<RequiredDocument, "valid_until">> = [
  { doc_type: "trade_registration", label: "Trade registration", label_de: "Handwerkskarte" },
  {
    doc_type: "liability_insurance",
    label: "Liability insurance",
    label_de: "Haftpflichtversicherung"
  },
  { doc_type: "reference_project", label: "Reference project", label_de: "Referenzprojekt" },
  {
    doc_type: "tax_clearance",
    label: "Tax clearance certificate",
    label_de: "Unbedenklichkeitsbescheinigung"
  }
];

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
  source_id: string | null;
  source_project: string | null;
  source_date: string | null;
  source_position_text: string | null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const toTender = (row: TenderRow): Tender => ({
  id: row.id,
  title: row.title_en,
  title_de: row.title_de,
  client: row.client_name,
  city: row.city,
  trade: row.trade,
  status: row.status,
  due_date: row.due_date,
  positions_count: row.positions_count,
  my_bid_status: (row.my_bid_status ?? "none") as BidStatus
});

const toPosition = (row: PositionRow): Position => ({
  oz: row.oz,
  text: row.text_en,
  text_de: row.text_de,
  long_text: row.long_text_en,
  long_text_de: row.long_text_de,
  quantity: row.quantity,
  unit: row.unit,
  category: row.category,
  contingency: row.contingency === 1,
  my_unit_price: row.my_unit_price,
  line_total: row.my_unit_price === null ? null : round2(row.quantity * row.my_unit_price),
  set_by: row.set_by,
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
  await next();
};

app.use("/api/tenders", requireWorkspace);
app.use("/api/tenders/*", requireWorkspace);

app.get("/api/tenders", async (c) => {
  const workspaceId = c.get("workspaceId");
  const bidderId = await resolveBidder(c.env.DB, workspaceId, c.req.header("X-Bidder-Id"));

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

  return c.json({ ok: true, bidder_id: bidderId, tenders: results.map(toTender) });
});

app.get("/api/tenders/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");
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
              bp.unit_price AS my_unit_price, bp.set_by,
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
    bidder_id: bidderId,
    tender: toTender(tender),
    positions: positions.results.map(toPosition),
    required_documents: REQUIRED_DOCUMENTS.map((document) => ({
      ...document,
      valid_until: held.get(document.doc_type) ?? null
    }))
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

app.get("/api/price-book", async (c) => {
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

app.get("/api/tenders/:id/suggestions", async (c) => {
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

app.post("/api/tenders/:id/prices", async (c) => {
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

app.post("/api/tenders/:id/undo", async (c) => {
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
