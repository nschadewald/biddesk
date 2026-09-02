import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import SubmitDialog from "./SubmitDialog";

/**
 * The dialog after the demo run: twelve billable positions priced, one of the
 * two contingency rows still empty. In the run-through "Positions priced
 * 12 of 12" above a table with an empty row read as a bug. The rule was right
 * -- contingency rows are quoted apart and never block -- and the dialog now
 * says so, in words and in a second count.
 */

const totals = { net: 13457.5, contingency: 370, positions_priced: 12, positions_open: 0 };

const positions = (contingencyPriced: boolean) => [
  { oz: "01.01", contingency: false, my_unit_price: 480 },
  { oz: "03.04", contingency: false, my_unit_price: 61 },
  { oz: "04.01", contingency: true, my_unit_price: 18.5 },
  { oz: "04.02", contingency: true, my_unit_price: contingencyPriced ? 48 : null }
];

it("counts the contingency positions apart and says that the empty one does not block", () => {
  const { container } = render(
    <SubmitDialog
      tenderId="T-2026-014"
      totals={totals}
      positions={positions(false)}
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  );

  expect(screen.getByText("12 of 12")).toBeInTheDocument();
  expect(screen.getByText("Contingency positions priced")).toBeInTheDocument();
  expect(screen.getByText("1 of 2")).toBeInTheDocument();
  expect(
    screen.getByText(
      "04.02 is without a price — a contingency position, quoted apart; it does not block the hand-in."
    )
  ).toBeInTheDocument();
  // Slate, not red: red stays with the check's blockers.
  expect(container.innerHTML).not.toMatch(/text-red|border-red/);
  // And the sentence about billable positions is not on screen: none is open.
  expect(screen.queryByText(/still without a price/)).not.toBeInTheDocument();
});

it("drops the sentence once the contingency row is priced, and counts 2 of 2", () => {
  render(
    <SubmitDialog
      tenderId="T-2026-014"
      totals={{ ...totals, contingency: 850 }}
      positions={positions(true)}
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  );

  expect(screen.getByText("2 of 2")).toBeInTheDocument();
  expect(screen.queryByText(/does not block the hand-in/)).not.toBeInTheDocument();
  expect(screen.getByText("850,00 €")).toBeInTheDocument();
});
