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
  due_date: "2026-09-10",
  due_in_days: 9,
  totals: { net: 13213.5, contingency: 370, positions_priced: 11, positions_open: 1 },
  positions_priced: 11,
  positions_open: 1,
  undo_available: true,
  warnings: [],
  ...over
});

it("names the three findings of the demo run", () => {
  render(<CheckPanel check={check()} onClose={() => {}} />);

  expect(screen.getByText("03.04, 04.02")).toBeInTheDocument();
  expect(screen.getByText(/Tax clearance certificate/)).toBeInTheDocument();
  expect(screen.getByText(/9 days left/)).toBeInTheDocument();
  expect(screen.getByText(/PB-A-005/)).toBeInTheDocument();
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
