import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

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
  text_de: position.text,
  long_text: null,
  long_text_de: null,
  category: "prep"
}));

function stubApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) =>
      input === "/api/workspace"
        ? new Response(JSON.stringify({ ok: true, workspace_id: WS, created: true }))
        : new Response(
            JSON.stringify({
              ok: true,
              tender: {
                id: "T-2026-014",
                title: "Staircase painting works – Rheinallee 12",
                title_de: "Malerarbeiten Treppenhaus – Rheinallee 12",
                client: "Rheinpark Property Management",
                city: "Düsseldorf",
                trade: "painting",
                status: "open",
                due_date: "2026-09-10",
                positions_count: 14
              },
              positions
            })
          )
    ) as unknown as typeof fetch
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

  const first = within(rows[0]!);
  expect(first.getByText("01.01")).toBeInTheDocument();
  expect(first.getByText("psch")).toBeInTheDocument();

  const radiators = within(rows[10]!);
  expect(radiators.getByText("03.04")).toBeInTheDocument();
  expect(radiators.getByText("4")).toBeInTheDocument();

  // Price and total columns are empty on arrival: the empty column is the ask.
  expect(screen.getAllByText("—")).toHaveLength(28);
  // Net total and contingency total, both zero.
  expect(screen.getAllByText("0,00 €")).toHaveLength(2);
  expect(screen.getByText("0 of 12")).toBeInTheDocument();
});

it("marks the two contingency positions", async () => {
  stubApi();
  render(<App />);
  await waitFor(() => expect(screen.getAllByText("contingency")).toHaveLength(2));
});
