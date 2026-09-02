import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import CheckPanel from "./CheckPanel";
import type { CheckResult } from "./types";

const check = (over: Partial<CheckResult> = {}): CheckResult => ({
  ok: true,
  bidder_id: "B-A",
  tender_id: "T-2026-014",
  status: "draft",
  complete: false,
  open_positions: ["03.04", "04.02"],
  outliers: [
    {
      oz: "02.02",
      unit_price: 84,
      price_book_price: 8.4,
      price_book_id: "PB-A-005",
      deviation_pct: 900
    }
  ],
  missing_documents: [
    {
      doc_type: "tax_clearance",
      // Already in the reader's language: the Worker resolves the label.
      label: "Tax clearance certificate",
      valid_until: "2026-08-11",
      reason: "expired"
    }
  ],
  blockers: [],
  due_date: "2026-09-10",
  due_in_days: 9,
  totals: { net: 13213.5, contingency: 370, positions_priced: 11, positions_open: 1 },
  positions_priced: 11,
  positions_open: 1,
  undo_available: true,
  warnings: [],
  actions: [],
  ...over
});

it("names the three findings of the demo run", () => {
  render(<CheckPanel check={check()} onClose={() => {}} />);

  expect(screen.getByText("03.04, 04.02")).toBeInTheDocument();
  expect(screen.getByText(/Tax clearance certificate/)).toBeInTheDocument();
  expect(screen.getByText(/9 days left/)).toBeInTheDocument();
  expect(screen.getByText(/PB-A-005/)).toBeInTheDocument();
});

it("names an open contingency position as one, in slate, and says it does not block", () => {
  // After the demo run: 03.04 confirmed, 04.02 still empty. The check is
  // complete -- all twelve billable positions are priced -- and one
  // contingency row is open. Both are true; the panel has to say both.
  const { container } = render(
    <CheckPanel
      check={check({
        complete: true,
        open_positions: ["04.02"],
        outliers: [],
        missing_documents: [],
        totals: { net: 13457.5, contingency: 370, positions_priced: 12, positions_open: 0 },
        positions_priced: 12,
        positions_open: 0,
        actions: [
          {
            finding: "open_position",
            oz: "04.02",
            action:
              "no entry for labour/h — set the price yourself, or ask your agent to derive one; you confirm it."
          }
        ]
      })}
      positions={[
        { oz: "03.04", contingency: false },
        { oz: "04.01", contingency: true },
        { oz: "04.02", contingency: true }
      ]}
      onClose={() => {}}
    />
  );

  // The number and the frame, then the contingency sentence, in one summary line.
  expect(screen.getByText(/All 12 positions in the total are priced\./)).toBeInTheDocument();
  expect(
    screen.getByText(/1 contingency position is open; it does not block the hand-in\./)
  ).toBeInTheDocument();
  expect(screen.getByText(/1 finding\./)).toBeInTheDocument();

  // Its own finding, with the server's own way out under it -- and not red.
  const finding = screen.getByTestId("finding-contingency");
  expect(finding).toHaveTextContent("Contingency position without a price · does not block the hand-in");
  expect(finding).toHaveTextContent("04.02");
  expect(finding).toHaveTextContent(/no entry for labour\/h/);
  expect(finding.className).not.toMatch(/red/);
  expect(finding.innerHTML).not.toMatch(/text-red|border-red/);
  expect(screen.queryByText("Positions without a price")).not.toBeInTheDocument();
  // Nothing red is left on the panel at all: no blocker, no red.
  expect(container.innerHTML).not.toMatch(/text-red-700|border-red-600/);
});

it("keeps a billable position red and a contingency one slate, side by side", () => {
  render(
    <CheckPanel
      check={check({ open_positions: ["03.04", "04.02"], outliers: [], missing_documents: [] })}
      positions={[
        { oz: "03.04", contingency: false },
        { oz: "04.02", contingency: true }
      ]}
      onClose={() => {}}
    />
  );
  expect(screen.getByText("Positions without a price")).toBeInTheDocument();
  expect(screen.getByText("03.04")).toBeInTheDocument();
  expect(screen.getByTestId("finding-contingency")).toHaveTextContent("04.02");
  expect(screen.getByText(/2 findings\./)).toBeInTheDocument();
});

it("is the one place that uses red", () => {
  const { container } = render(<CheckPanel check={check()} onClose={() => {}} />);
  // Red carries meaning here only because it appears nowhere else in the app.
  expect(container.innerHTML).toMatch(/text-red-700|border-red-600/);
});

it("says the comparison is against the contractor's own history, not a market", () => {
  render(<CheckPanel check={check()} onClose={() => {}} />);
  expect(screen.getByText(/own price book, not against market rates/)).toBeInTheDocument();
});

it("says under each finding what to do next, in the page's words", () => {
  render(
    <CheckPanel
      check={check({
        actions: [
          {
            finding: "open_position",
            oz: "03.04",
            action:
              "no entry for metal/pcs — set the price yourself, or ask your agent to derive one; you confirm it."
          },
          {
            finding: "document",
            doc_type: "tax_clearance",
            action:
              "tell your agent the new expiry date — you confirm it on the page — or upload a current certificate."
          }
        ]
      })}
      onClose={() => {}}
    />
  );

  // A finding that only says what is wrong leaves the person in the chat with
  // "then it cannot be done". These sentences are the way out, fixed by us.
  expect(screen.getByText(/no entry for metal\/pcs — set the price yourself/)).toBeInTheDocument();
  expect(screen.getByText(/tell your agent the new expiry date/)).toBeInTheDocument();
});
