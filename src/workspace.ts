import seedSql from "../seed/seed.sql?raw";

// Every visitor gets an isolated copy of the seed data. seed/seed.sql is
// generated from seed/seed.json and must not be hand-edited (seed/README.md).
//
// The file ships one statement per line, each carrying exactly one '{{WS}}'
// literal. We turn that literal into a bound parameter instead of doing string
// substitution: the workspace id then never becomes part of the SQL text.
export const SEED_STATEMENTS: string[] = seedSql
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("--"))
  .map((line) => line.replace(/;$/, "").replaceAll("'{{WS}}'", "?1"));

// Deleted on reset. `workspaces` keys the id column, every other table has
// workspace_id. Order is irrelevant: the schema declares no foreign keys.
const WORKSPACE_TABLES = [
  "change_log",
  "bid_prices",
  "bids",
  "clarifications",
  "price_book",
  "bidder_documents",
  "bidders",
  "positions",
  "tenders"
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWorkspaceId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function seedStatements(db: D1Database, workspaceId: string) {
  return SEED_STATEMENTS.map((sql) => db.prepare(sql).bind(workspaceId));
}

function clearStatements(db: D1Database, workspaceId: string) {
  return [
    ...WORKSPACE_TABLES.map((table) =>
      db.prepare(`DELETE FROM ${table} WHERE workspace_id = ?1`).bind(workspaceId)
    ),
    db.prepare("DELETE FROM workspaces WHERE id = ?1").bind(workspaceId)
  ];
}

export async function workspaceExists(db: D1Database, workspaceId: string) {
  const row = await db
    .prepare("SELECT 1 AS present FROM workspaces WHERE id = ?1")
    .bind(workspaceId)
    .first<{ present: number }>();
  return row !== null;
}

/** Creates a workspace and seeds it. One D1 batch, so it is all or nothing. */
export async function createWorkspace(db: D1Database) {
  const workspaceId = crypto.randomUUID();
  await db.batch(seedStatements(db, workspaceId));
  return workspaceId;
}

/**
 * Wipes the workspace and seeds it again. Delete and insert travel in the SAME
 * batch, so there is no moment in which the workspace is half gone. Idempotent:
 * resetting an id that no longer exists simply recreates it.
 */
export async function resetWorkspace(db: D1Database, workspaceId: string) {
  await db.batch([
    ...clearStatements(db, workspaceId),
    ...seedStatements(db, workspaceId)
  ]);
}
