import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getAppState } from "../store";
import { bidderReadTools } from "./tools";

const WS = "44444444-4444-4444-8444-444444444444";

const listTenders = bidderReadTools.find((tool) => tool.name === "list_tenders")!;
const getTender = bidderReadTools.find((tool) => tool.name === "get_tender")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

const detail = (id: string) => ({
  ok: true,
  bidder_id: "B-A",
  tender: {
    id,
    title: "Staircase painting works",
    title_de: "Malerarbeiten Treppenhaus",
    client: "Rheinpark Property Management",
    city: "Düsseldorf",
    trade: "painting",
    status: "open",
    due_date: "2026-09-10",
    positions_count: 1,
    my_bid_status: "none"
  },
  positions: [
    {
      oz: "01.01",
      text: "Site setup",
      text_de: "Baustelleneinrichtung",
      long_text: null,
      long_text_de: null,
      quantity: 1,
      unit: "psch",
      category: "prep",
      contingency: false,
      my_unit_price: null,
      line_total: null
    }
  ],
  required_documents: [
    { doc_type: "tax_clearance", label: "Tax clearance certificate", label_de: "U", valid_until: "2026-08-11" }
  ]
});

let requests: string[] = [];

beforeEach(() => {
  requests = [];
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      requests.push(input);
      if (input === "/api/workspace") {
        return json({ ok: true, workspace_id: WS, created: true }, 201);
      }
      if (input.startsWith("/api/tenders/")) {
        const id = decodeURIComponent(input.slice("/api/tenders/".length));
        return id === "T-2026-999"
          ? json({ ok: false, error: "tender_not_found", hint: `No tender ${id} in this workspace.` }, 404)
          : json(detail(id));
      }
      return json({ ok: true, bidder_id: "B-A", tenders: [detail("T-2026-014").tender] });
    }) as unknown as typeof fetch
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("declares read-only hints, titles and closed schemas", () => {
  for (const tool of bidderReadTools) {
    expect(tool.annotations.readOnlyHint).toBe(true);
    expect(tool.title.length).toBeGreaterThan(0);
    expect(tool.inputSchema.additionalProperties).toBe(false);
    for (const property of Object.values(tool.inputSchema.properties)) {
      expect((property as { description?: string }).description).toBeTruthy();
    }
  }
});

it("says in the description when to use it and what it does on screen", () => {
  expect(getTender.description).toContain("Visible effect");
  expect(getTender.description).toContain("Use it");
  expect(listTenders.description).toContain("Use it");
  // A read tool must not claim it changes the screen.
  expect(listTenders.description).toContain("does not open a tender on screen");
});

it("list_tenders passes its filters through as query parameters", async () => {
  const result = await listTenders.execute({ status: "open", city: "Düsseldorf" });
  expect(result.ok).toBe(true);
  const call = requests.find((path) => path.startsWith("/api/tenders?"))!;
  expect(call).toContain("status=open");
  expect(call).toContain(encodeURIComponent("Düsseldorf"));
});

it("rejects an unknown status instead of guessing one", async () => {
  const result = await listTenders.execute({ status: "expired" });
  expect(result).toEqual({
    ok: false,
    error: "invalid_input",
    hint: "status must be one of open, closed, all."
  });
});

it("holds to additionalProperties:false and names the offending argument", async () => {
  const result = await listTenders.execute({ limit: 5 });
  expect(result.ok).toBe(false);
  expect(result.error).toBe("invalid_input");
  expect(String(result.hint)).toContain("limit");
});

it("get_tender opens the tender on screen and returns the bill of quantities", async () => {
  const result = await getTender.execute({ tender_id: "T-2026-015" });

  expect(result.ok).toBe(true);
  expect(result.id).toBe("T-2026-015");
  expect(Array.isArray(result.positions)).toBe(true);
  expect(Array.isArray(result.required_documents)).toBe(true);
  // The visible effect the description promises: the store now holds it.
  expect(getAppState().tenderId).toBe("T-2026-015");
  expect(getAppState().detail?.tender.id).toBe("T-2026-015");
});

it("requires tender_id rather than falling back to a default", async () => {
  const result = await getTender.execute({});
  expect(result).toEqual({
    ok: false,
    error: "invalid_input",
    hint: "tender_id is required and must be a non-empty string."
  });
});

it("passes the machine-readable error code on when a tender does not exist", async () => {
  const result = await getTender.execute({ tender_id: "T-2026-999" });
  expect(result.ok).toBe(false);
  expect(result.error).toBe("tender_not_found");
});
