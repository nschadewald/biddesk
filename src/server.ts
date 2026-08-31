import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// Deploy-path probe. Proves three things at once: the Worker runs, Hono routes
// /api/* before the static assets, and the D1 binding is reachable in
// production. Replaced by real routes in step 2.
app.get("/api/health", async (c) => {
  const startedAt = Date.now();
  try {
    const row = await c.env.DB.prepare("select 1 as ok").first<{ ok: number }>();
    return c.json({
      ok: row?.ok === 1,
      service: "biddesk",
      d1: "reachable",
      duration_ms: Date.now() - startedAt
    });
  } catch (caught) {
    // Tools and API never throw at the caller: errors come back as data.
    return c.json(
      {
        ok: false,
        error: "d1_unreachable",
        hint:
          caught instanceof Error
            ? caught.message
            : "The D1 binding DB did not answer."
      },
      500
    );
  }
});

app.all("/api/*", (c) =>
  c.json(
    { ok: false, error: "not_found", hint: "Unknown API route." },
    404
  )
);

export default {
  fetch: app.fetch
} satisfies ExportedHandler<Env>;
