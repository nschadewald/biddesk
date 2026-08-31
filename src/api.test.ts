import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ensureWorkspace, loadTender } from "./api";

const OLD = "11111111-1111-4111-8111-111111111111";
const FRESH = "22222222-2222-4222-8222-222222222222";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

const tenderDetail = {
  ok: true,
  tender: { id: "T-2026-014", positions_count: 14 },
  positions: []
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("adopts the stored workspace id when the server still knows it", async () => {
  localStorage.setItem("biddesk.workspace", OLD);
  const fetchMock = vi.fn(async (_input: string, init?: RequestInit) =>
    json({ ok: true, workspace_id: OLD, created: false })
  );
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

  await expect(ensureWorkspace()).resolves.toBe(OLD);
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ id: OLD });
});

it("replaces a swept-up workspace silently instead of failing the read", async () => {
  localStorage.setItem("biddesk.workspace", OLD);
  const fetchMock = vi.fn(async (input: string) => {
    if (input === "/api/workspace") {
      return json({ ok: true, workspace_id: FRESH, created: true }, 201);
    }
    return fetchMock.mock.calls.filter((call) => call[0] !== "/api/workspace").length === 1
      ? json({ ok: false, error: "unknown_workspace", hint: "gone" }, 404)
      : json(tenderDetail);
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

  const result = await loadTender("T-2026-014", OLD);

  expect(result.workspaceId).toBe(FRESH);
  expect(result.detail.tender.id).toBe("T-2026-014");
  expect(localStorage.getItem("biddesk.workspace")).toBe(FRESH);
});

it("still works when localStorage is unavailable", async () => {
  const boom = () => {
    throw new Error("localStorage is disabled");
  };
  vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
  const fetchMock = vi.fn(async (_input: string, init?: RequestInit) =>
    json({ ok: true, workspace_id: FRESH, created: true }, 201)
  );
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

  await expect(ensureWorkspace()).resolves.toBe(FRESH);
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({});
});
