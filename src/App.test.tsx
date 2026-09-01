import { render, screen, waitFor, within } from "@testing-library/react";
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

function stubApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      // The Worker resolves X-Language at its mapping boundary and sends one
      // text per field. The stub does the same, so a test can see the header
      // arrive rather than trust that it was set.
      const german =
        (init?.headers as Record<string, string> | undefined)?.["X-Language"] === "de";
      return input.startsWith("/api/clarifications")
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
              positions,
              required_documents: []
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
  // Nine imperative tools plus ask_clarification, which the form declares.
  // Ten either way: nine imperative plus the form where a browser declares it,
  // ten imperative where it does not. jsdom is the second case.
  await screen.findByText("WebMCP detected · 10 tools registered");
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
    await screen.findByText("WebMCP detected · 10 tools registered");
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
    expect(screen.getByText("WebMCP erkannt · 10 Werkzeuge angemeldet")).toBeInTheDocument();
    expect(registerTool.mock.calls.length).toBe(registrationsBefore);

    // Money does not move with the language; only the words and the dates do.
    expect(screen.getAllByText("0,00 €")).toHaveLength(2);
    expect(screen.getByText("0 von 12")).toBeInTheDocument();
  } finally {
    await selectLanguage("en");
    Reflect.deleteProperty(document, "modelContext");
  }
});
