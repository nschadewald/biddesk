import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { BidStatus, Position, RequiredDocument, Tender } from "./types";
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
  line_total: row.my_unit_price === null ? null : round2(row.quantity * row.my_unit_price)
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
              bp.unit_price AS my_unit_price
         FROM positions p
         LEFT JOIN bids b
           ON b.workspace_id = p.workspace_id
          AND b.tender_id = p.tender_id
          AND b.bidder_id = ?3
         LEFT JOIN bid_prices bp
           ON bp.workspace_id = p.workspace_id
          AND bp.bid_id = b.id
          AND bp.oz = p.oz
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
