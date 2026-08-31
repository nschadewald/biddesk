import { describe, expect, it } from "vitest";
import { isWorkspaceId, SEED_STATEMENTS } from "./workspace";

describe("seed statements", () => {
  it("keeps every INSERT from seed.sql and drops the comments", () => {
    expect(SEED_STATEMENTS).toHaveLength(127);
    expect(SEED_STATEMENTS.every((sql) => sql.startsWith("INSERT"))).toBe(true);
  });

  it("creates the workspace row before anything references it", () => {
    expect(SEED_STATEMENTS[0]).toContain("INSERT OR IGNORE INTO workspaces");
  });

  it("binds the workspace id instead of pasting it into the SQL text", () => {
    expect(SEED_STATEMENTS.some((sql) => sql.includes("{{WS}}"))).toBe(false);
    expect(SEED_STATEMENTS.every((sql) => sql.includes("?1"))).toBe(true);
  });

  it("keeps deadlines and document validity relative so nothing expires during judging", () => {
    // Only price_book.source_date is a fixed date: it records where a historical
    // price came from. Everything with a clock on it stays relative.
    const dated = SEED_STATEMENTS.filter((sql) => /'20\d\d-\d\d-\d\d'/.test(sql));
    expect(dated.every((sql) => sql.includes("INSERT INTO price_book"))).toBe(true);

    const timeSensitive = SEED_STATEMENTS.filter((sql) =>
      ["INTO tenders", "INTO bidder_documents", "INTO bids"].some((table) => sql.includes(table))
    );
    expect(timeSensitive.length).toBeGreaterThan(0);
    expect(timeSensitive.every((sql) => /date(time)?\('now'/.test(sql))).toBe(true);
  });
});

describe("isWorkspaceId", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(isWorkspaceId("3f1d2c4e-5b6a-4c8d-9e0f-1a2b3c4d5e6f")).toBe(true);
    expect(isWorkspaceId("../../etc/passwd")).toBe(false);
    expect(isWorkspaceId("'; DROP TABLE tenders; --")).toBe(false);
    expect(isWorkspaceId(undefined)).toBe(false);
  });
});
