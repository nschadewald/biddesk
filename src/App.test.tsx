import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { selectLanguage } from "./store";

const WS = "33333333-3333-4333-8333-333333333333";

const positions = [
  { oz: "01.01", text: "Site setup", quantity: 1, unit: "psch", contingency: false },
  { oz: "01.02", text: "Clean and sand existing wall coating", quantity: 320, unit: "m2", contingency: false },
  { oz: "01.03", text: "Fill cracks and holes", quantity: 320, unit: "m2", contingency: false },
  { oz: "02.01", text: "Primer on wall surfaces", quantity: 320, unit: "m2", contingency: false },
  { oz: "02.02", text: "Two coats emulsion, walls", quantity: 320, unit: "m2", contingency: false },
  { oz: "02.03", text: "Two coats emulsion, ceilings", quantity: 60, unit: "m2", contingency: false },
  { oz: "02.04", text: "Latex dado coating", quantity: 90, unit: "m2", contingency: false },
  { oz: "03.01", text: "Steel balustrade", quantity: 45, unit: "m", contingency: false },
  { oz: "03.02", text: "Wooden handrail", quantity: 45, unit: "m", contingency: false },
  { oz: "03.03", text: "Apartment entrance doors", quantity: 10, unit: "pcs", contingency: false },
  { oz: "03.04", text: "Radiators incl. pipes", quantity: 4, unit: "pcs", contingency: false },
  { oz: "03.05", text: "Window frames inside", quantity: 5, unit: "pcs", contingency: false },
  { oz: "04.01", text: "Mould treatment", quantity: 20, unit: "m2", contingency: true },
  { oz: "04.02", text: "Hourly rate skilled painter", quantity: 10, unit: "h", contingency: true }
].map((position) => ({
  ...position,
  long_text: null,
  category: "prep",
  my_unit_price: null,
  line_total: null
}));

const GERMAN_TITLE = "Malerarbeiten Treppenhaus – Rheinallee 12";
const RATIONALE = "4 radiators at 25 min each at your rate of 58 EUR";

/** What the page sent to POST /prices, for the tests that click. */
let priceWrites: { set_by: string; prices: Record<string, unknown>[] }[] = [];
/** What the page sent to POST /api/documents/..., and whether the stub still reports the expiry. */
let documentWrites: Record<string, unknown>[] = [];
let taxClearanceExpired = true;

const REQUIRED_DOCUMENTS = [
  { doc_type: "trade_registration", label: "Trade registration", valid_until: "2027-09-01" },
  { doc_type: "liability_insurance", label: "Liability insurance", valid_until: "2027-03-20" },
  { doc_type: "reference_project", label: "Reference project", valid_until: "2027-10-06" },
  { doc_type: "tax_clearance", label: "Tax clearance certificate", valid_until: "2026-08-12" }
];

function stubApi(options: { priced?: boolean } = {}) {
  priceWrites = [];
  documentWrites = [];
  taxClearanceExpired = true;
  // With `priced`, the first row already carries the net of the demo run, so
  // confirming 61 EUR on the four radiators lands on the figure the spec names.
  const rows = options.priced
    ? positions.map((row, index) =>
        index === 0
          ? {
              ...row,
              my_unit_price: 13213.5,
              line_total: 13213.5,
              set_by: "agent",
              source: { price_book_id: "PB-A-001", source_project: "Luegallee 40", source_date: "2026-03-14", source_position_text: "x" }
            }
          : row
      )
    : positions;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      // The Worker resolves X-Language at its mapping boundary and sends one
      // text per field. The stub does the same, so a test can see the header
      // arrive rather than trust that it was set.
      const german =
        (init?.headers as Record<string, string> | undefined)?.["X-Language"] === "de";
      if (input.includes("/api/documents/") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        documentWrites.push(sent);
        taxClearanceExpired = false;
        return new Response(
          JSON.stringify({
            ok: true,
            changed: true,
            doc_type: "tax_clearance",
            label: "Tax clearance certificate",
            previous_valid_until: "2026-08-12",
            valid_until: sent.valid_until
          })
        );
      }
      if (input.endsWith("/check")) {
        return new Response(
          JSON.stringify({
            ok: true,
            bidder_id: "B-A",
            tender_id: "T-2026-014",
            status: "none",
            complete: false,
            open_positions: ["03.04", "04.02"],
            outliers: [],
            missing_documents: taxClearanceExpired
              ? [{ doc_type: "tax_clearance", label: "Tax clearance certificate", valid_until: "2026-08-12", reason: "expired" }]
              : [],
            due_date: "2026-09-10",
            due_in_days: 9,
            totals: { net: 0, contingency: 0, positions_priced: 0, positions_open: 12 },
            positions_priced: 0,
            positions_open: 12,
            undo_available: false,
            warnings: [],
            actions: taxClearanceExpired
              ? [{ finding: "document", doc_type: "tax_clearance", action: "tell your agent the new expiry date — you confirm it on the page — or upload a current certificate." }]
              : []
          })
        );
      }
      if (input.endsWith("/prices") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body)) as { set_by: string; prices: Record<string, unknown>[] };
        priceWrites.push(sent);
        return new Response(
          JSON.stringify({
            ok: true,
            bidder_id: "B-A",
            tender_id: "T-2026-014",
            applied: sent.prices.map((row) => ({
              oz: row.oz,
              unit_price: row.unit_price,
              line_total: (row.unit_price as number) * 4,
              note: row.note ?? null,
              set_by: sent.set_by,
              price_book_id: null,
              source: null
            })),
            rejected: [],
            totals: { net: 13457.5, contingency: 0, positions_priced: 2, positions_open: 10 }
          })
        );
      }
      return input === "/api/tenders"
        ? new Response(JSON.stringify({ ok: true, bidder_id: "B-A", tenders: [] }))
        : input.endsWith("/comparison")
          ? new Response(
              JSON.stringify({
                ok: true,
                tender_id: "T-2026-014",
                title: "Staircase painting works – Rheinallee 12",
                sealed: true,
                sealed_until: "2026-09-10",
                bids_received: 2,
                received_at: [],
                bidders: [],
                positions: []
              })
            )
        : input.startsWith("/api/clarifications")
        ? new Response(JSON.stringify({ ok: true, questions: [] }))
        : input === "/api/bidders"
          ? new Response(
              JSON.stringify({
                ok: true,
                bidders: [
                  { id: "B-A", name: "Farbwerk Meier GmbH", city: "D", is_demo: true },
                  { id: "B-B", name: "Malerei Brandt & Sohn", city: "N", is_demo: false },
                  { id: "B-C", name: "Colorpoint Anstrich UG", city: "D", is_demo: false }
                ]
              })
            )
          : input === "/api/workspace"
        ? new Response(JSON.stringify({ ok: true, workspace_id: WS, created: true }))
        : new Response(
            JSON.stringify({
              ok: true,
              bidder_id: "B-A",
              tender: {
                id: "T-2026-014",
                title: german
                  ? GERMAN_TITLE
                  : "Staircase painting works – Rheinallee 12",
                client: "Rheinpark Property Management",
                city: "Düsseldorf",
                trade: "painting",
                status: "open",
                due_date: "2026-09-10",
                positions_count: 14,
                my_bid_status: "none"
              },
              positions: rows,
              required_documents: REQUIRED_DOCUMENTS
            })
          );
    }) as unknown as typeof fetch
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows the 14 positions with quantity and unit, no prices and a zero total", async () => {
  stubApi();
  render(<App />);

  const rows = await waitFor(() => {
    const found = screen.getAllByRole("row").slice(1);
    expect(found).toHaveLength(14);
    return found;
  });

  // Where this plays, and that none of it is real. Until now that notice
  // stood only in the README, where a juror looking at the screen never is.
  expect(
    screen.getByText("A German public tender (VOB/GAEB). Names, prices and firms are invented.")
  ).toBeInTheDocument();

  const first = within(rows[0]!);
  expect(first.getByText("01.01")).toBeInTheDocument();
  expect(first.getByText("psch")).toBeInTheDocument();

  const radiators = within(rows[10]!);
  expect(radiators.getByText("03.04")).toBeInTheDocument();
  expect(radiators.getByText("4")).toBeInTheDocument();

  // The empty price column is the ask: every cell editable, every one blank.
  const inputs = screen.getAllByLabelText(/^Unit price for /);
  expect(inputs).toHaveLength(14);
  expect(inputs.every((input) => (input as HTMLInputElement).value === "")).toBe(true);
  // And no line totals yet.
  expect(screen.getAllByText("—")).toHaveLength(14);
  // Net total and contingency total, both zero.
  expect(screen.getAllByText("0,00 €")).toHaveLength(2);
  expect(screen.getByText("0 of 12")).toBeInTheDocument();
});

it("marks the two contingency positions", async () => {
  stubApi();
  render(<App />);
  await waitFor(() => expect(screen.getAllByText("contingency")).toHaveLength(2));
});

it("diagnoses a browser without WebMCP and names both ways to get it", async () => {
  stubApi();
  render(<App />);

  await screen.findByText("WebMCP not available in this browser");
  expect(screen.getByText(/ChatGPT desktop app browser/)).toBeInTheDocument();
  expect(screen.getByText("chrome://flags/#enable-webmcp-testing")).toBeInTheDocument();
  expect(
    screen.getByText("This log stays in your browser. Nothing is sent anywhere.")
  ).toBeInTheDocument();
  expect(screen.getByText("tool calls appear here")).toBeInTheDocument();
});

it("counts the registered tools from the registry when WebMCP is present", async () => {
  stubApi();
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: { registerTool: () => Promise.resolve() }
  });

  render(<App />);

  // Counted from the block, not written down: the panel does the same.
  // Ten imperative tools plus ask_clarification, which the form declares.
  // Eleven either way: ten imperative plus the form where a browser declares
  // it, eleven imperative where it does not. jsdom is the second case.
  await screen.findByText("WebMCP detected · 11 tools registered");
  for (const name of [
    "list_tenders",
    "get_tender",
    "list_clarifications",
    "get_price_book",
    "suggest_prices",
    "set_unit_price",
    "check_bid",
    "undo_last_change",
    "submit_bid",
    "set_document_validity",
    "ask_clarification"
  ]) {
    expect(screen.getByText(name)).toBeInTheDocument();
  }

  Reflect.deleteProperty(document, "modelContext");
});

it("labels a log entry from an untrusted tool and caps the foreign text", async () => {
  stubApi();
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: { registerTool: () => Promise.resolve() }
  });

  const { logStore, appendLogEntry } = await import("./webmcp/log");
  logStore.clear();
  appendLogEntry({
    time: "12:00:00",
    tool: "list_clarifications",
    access: "read",
    untrusted: true,
    duration_ms: 4,
    waited_for_human_ms: 0,
    outcome: "ok",
    inputSummary: "{}",
    outputSummary: "1 questions",
    input: {},
    output: { ok: true, questions: [{ question: "a".repeat(300) }] }
  });

  render(<App />);

  expect(await screen.findByText("untrusted content")).toBeInTheDocument();
  Reflect.deleteProperty(document, "modelContext");
  logStore.clear();
});

it("switches the language without touching a single tool registration", async () => {
  stubApi();
  // Counting registrations is the whole point: a language switch that
  // re-registered a block would fire `toolchange` for a change no agent needs
  // to hear about, and the self-diagnosis would flicker while it happened.
  const registerTool = vi.fn(() => Promise.resolve());
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: { registerTool }
  });

  try {
    render(<App />);
    await screen.findByText("WebMCP detected · 11 tools registered");
    const registrationsBefore = registerTool.mock.calls.length;
    expect(registrationsBefore).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText(/Language/), "de");

    // The texts come from the Worker, so the tender is re-read in German.
    await screen.findByText(GERMAN_TITLE);
    expect(screen.getByText("Nettosumme")).toBeInTheDocument();
    expect(screen.getByText("Angebot prüfen")).toBeInTheDocument();
    expect(screen.getAllByText("Bedarf")).toHaveLength(2);
    expect(
      screen.getByText(
        "Eine deutsche Ausschreibung (VOB/GAEB). Namen, Preise und Firmen sind erfunden."
      )
    ).toBeInTheDocument();

    // The self-diagnosis says the same number, in German, and no tool was
    // registered a second time.
    expect(screen.getByText("WebMCP erkannt · 11 Werkzeuge angemeldet")).toBeInTheDocument();
    expect(registerTool.mock.calls.length).toBe(registrationsBefore);

    // Money does not move with the language; only the words and the dates do.
    expect(screen.getAllByText("0,00 €")).toHaveLength(2);
    expect(screen.getByText("0 von 12")).toBeInTheDocument();
  } finally {
    await selectLanguage("en");
    Reflect.deleteProperty(document, "modelContext");
  }
});

it("says where this plays on the client screen too", async () => {
  stubApi();
  const { selectRole } = await import("./store");
  render(<App />);
  await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));

  try {
    await userEvent.selectOptions(screen.getByLabelText(/Acting as/), "client");
    await screen.findByText(/Tenders published by this client/);
    expect(
      screen.getByText("A German public tender (VOB/GAEB). Names, prices and firms are invented.")
    ).toBeInTheDocument();
  } finally {
    await selectRole("bidder");
  }
});

it("writes a proposed price only on the person's click, as theirs, and the total follows", async () => {
  stubApi({ priced: true });
  const { proposePrices } = await import("./store");
  render(<App />);
  // Twice on screen: the net total, and the line total of the row that makes it.
  await screen.findAllByText("13.213,50 €");

  // What the tool does for "set position 03.04 to 61 euros": no write, a
  // confirmation on the row.
  await act(async () => {
    await proposePrices("T-2026-014", [
      { oz: "03.04", unit_price: 61, price_book_id: null, note: RATIONALE }
    ]);
  });
  await screen.findByText("Confirm this price?");
  expect(screen.getByText("61,00 € × 4 pcs = 244,00 €")).toBeInTheDocument();
  expect(
    screen.getByText("not from your price book — you are setting this price yourself")
  ).toBeInTheDocument();
  expect(priceWrites).toEqual([]);
  expect(screen.getAllByText("13.213,50 €").length).toBeGreaterThan(0);
  expect(screen.queryByText("13.457,50 €")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

  // 13.213,50 + 4 x 61,00: the click wrote it, as a person's, with no source.
  await screen.findByText("13.457,50 €");
  expect(priceWrites).toHaveLength(1);
  expect(priceWrites[0]!.set_by).toBe("human");
  expect(priceWrites[0]!.prices).toEqual([{ oz: "03.04", unit_price: 61, note: RATIONALE }]);
  expect(priceWrites[0]!.prices[0]).not.toHaveProperty("price_book_id");

  const row = screen.getByText("03.04").closest("tr")!;
  expect(within(row).getByText(`set by you · ${RATIONALE}`)).toBeInTheDocument();
  expect(within(row).queryByText(/from your quote/)).not.toBeInTheDocument();
  expect(screen.queryByText("Confirm this price?")).not.toBeInTheDocument();
});

it("records a relayed document date only on the person's click, and the finding goes away", async () => {
  stubApi();
  const { proposeDocumentValidity } = await import("./store");
  render(<App />);
  await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));

  // What the tool does for "my new tax clearance certificate is valid until
  // 15 August 2027": no write, a confirmation at the finding it resolves.
  await act(async () => {
    await proposeDocumentValidity("tax_clearance", "2027-08-15");
  });
  await screen.findByText("Confirm this document?");
  expect(
    screen.getByText(
      "You confirm that a certificate valid until 15 Aug 2027 exists. Nothing is uploaded or checked here."
    )
  ).toBeInTheDocument();
  expect(screen.getByText("12 Aug 2026 → 15 Aug 2027")).toBeInTheDocument();
  expect(screen.getByText("Expired document")).toBeInTheDocument();
  expect(documentWrites).toEqual([]);

  await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

  // The click wrote the date, and the check no longer lists the document.
  await waitFor(() => expect(documentWrites).toEqual([{ valid_until: "2027-08-15" }]));
  await waitFor(() => expect(screen.queryByText("Expired document")).not.toBeInTheDocument());
  expect(screen.queryByText("Confirm this document?")).not.toBeInTheDocument();
});
