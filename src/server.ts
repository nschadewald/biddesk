import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { Position, Tender } from "./types";
import {
  createWorkspace,
  isWorkspaceId,
  resetWorkspace,
  workspaceExists
} from "./workspace";

type Variables = { workspaceId: string };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// The API never throws at the caller. Errors are data, in the same shape the
// WebMCP tools will use: { ok:false, error, hint }.
const fail = (error: string, hint: string) => ({ ok: false as const, error, hint });

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
};

const toTender = (row: TenderRow): Tender => ({
  id: row.id,
  title: row.title_en,
  title_de: row.title_de,
  client: row.client_name,
  city: row.city,
  trade: row.trade,
  status: row.status,
  due_date: row.due_date,
  positions_count: row.positions_count
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
  contingency: row.contingency === 1
});

const TENDER_COLUMNS = `
  t.id, t.title_en, t.title_de, t.client_name, t.city, t.trade, t.status, t.due_date,
  (SELECT COUNT(*) FROM positions p
    WHERE p.workspace_id = t.workspace_id AND p.tender_id = t.id) AS positions_count
`;

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
 * seeded one when it does not. There is no error path for the visitor here --
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
      fail("invalid_workspace_id", "A workspace id is a UUID. Create one with POST /api/workspace."),
      400
    );
  }

  await resetWorkspace(c.env.DB, workspaceId);
  return c.json({ ok: true, workspace_id: workspaceId, reset: true });
});

// Read routes carry the workspace in a header, never in the URL: the page URL
// must stay free of state so a shared link can never leak someone's workspace.
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
  const { results } = await c.env.DB.prepare(
    `SELECT ${TENDER_COLUMNS}
       FROM tenders t
      WHERE t.workspace_id = ?1
      ORDER BY (t.status = 'open') DESC, t.due_date`
  )
    .bind(c.get("workspaceId"))
    .all<TenderRow>();

  return c.json({ ok: true, tenders: results.map(toTender) });
});

app.get("/api/tenders/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const tenderId = c.req.param("id");

  const tender = await c.env.DB.prepare(
    `SELECT ${TENDER_COLUMNS}
       FROM tenders t
      WHERE t.workspace_id = ?1 AND t.id = ?2`
  )
    .bind(workspaceId, tenderId)
    .first<TenderRow>();

  if (!tender) {
    return c.json(fail("tender_not_found", `No tender ${tenderId} in this workspace.`), 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT oz, text_en, text_de, long_text_en, long_text_de,
            quantity, unit, category, contingency
       FROM positions
      WHERE workspace_id = ?1 AND tender_id = ?2
      ORDER BY sort_no`
  )
    .bind(workspaceId, tenderId)
    .all<PositionRow>();

  return c.json({
    ok: true,
    tender: toTender(tender),
    positions: results.map(toPosition)
  });
});

app.all("/api/*", (c) => c.json(fail("not_found", "Unknown API route."), 404));

app.onError((err, c) =>
  c.json(fail("internal_error", err instanceof Error ? err.message : "Unexpected failure."), 500)
);

export default {
  fetch: app.fetch
} satisfies ExportedHandler<Env>;
