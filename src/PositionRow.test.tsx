import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import PositionRow from "./PositionRow";
import type { Position, Suggestion } from "./types";

const position = (over: Partial<Position> = {}): Position => ({
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
  line_total: null,
  ...over
});

const proposal = (over: Partial<Suggestion> = {}): Suggestion => ({
  oz: "01.01",
  unit_price: 480,
  matched_terms: 2,
  matched_on: ["category", "unit"],
  based_on: {
    price_book_id: "PB-A-001",
    source_project: "Luegallee 40",
    source_date: "2026-03-14",
    source_position_text: "Baustelleneinrichtung, Abdecken Treppenhaus und Böden"
  },
  reason: "Same category and unit; 2 search terms matched.",
  ...over
});

const table = (children: React.ReactNode) => render(<table><tbody>{children}</tbody></table>);

it("keeps the price cell empty and puts the proposal on a chip beside it", () => {
  table(<PositionRow position={position()} suggestion={proposal()} />);

  const chip = screen.getByRole("button");
  expect(within(chip).getByText("480,00 €")).toBeInTheDocument();
  expect(within(chip).getByText("Luegallee 40, March 2026")).toBeInTheDocument();
  // Nothing has been entered, so the line total stays empty.
  expect(screen.getByText("—")).toBeInTheDocument();
});

it("opens the original price book line, with matched_terms, when the chip is clicked", async () => {
  table(<PositionRow position={position()} suggestion={proposal()} />);

  expect(screen.queryByText(/matched_terms/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button"));

  expect(
    screen.getByText("Baustelleneinrichtung, Abdecken Treppenhaus und Böden")
  ).toBeInTheDocument();
  expect(screen.getByText("matched_terms 2 · matched_on category, unit")).toBeInTheDocument();
  expect(screen.getByText(/PB-A-001/)).toBeInTheDocument();
});

it("gives every chip the same look, whatever the number of matched terms", () => {
  const { container } = table(
    <>
      <PositionRow position={position({ oz: "a" })} suggestion={proposal({ matched_terms: 1 })} />
      <PositionRow position={position({ oz: "b" })} suggestion={proposal({ matched_terms: 4 })} />
    </>
  );

  const [weak, strong] = [...container.querySelectorAll("button")];
  // No filled-versus-outlined, no shading by strength: a grading would be the
  // confidence scale we deliberately do not have.
  expect(weak?.className).toBe(strong?.className);
});

it("shows a gap as plain words, with no price and no warning", () => {
  const { container } = table(
    <PositionRow
      position={position({ oz: "03.04", text: "Radiators" })}
      suggestion={proposal({
        oz: "03.04",
        unit_price: null,
        matched_terms: 0,
        matched_on: [],
        based_on: null,
        reason: "no comparable entry in your price book"
      })}
    />
  );

  expect(screen.getByText("no comparable entry")).toBeInTheDocument();
  // No chip to open, and nothing red or yellow anywhere in the row.
  expect(container.querySelector("button")).toBeNull();
  expect(container.innerHTML).not.toMatch(/red|amber|yellow|⚠/);
});

it("shows a price entered by a person without any chip", () => {
  const { container } = table(
    <PositionRow
      position={position({ quantity: 4, unit: "pcs", my_unit_price: 61, line_total: 244 })}
      suggestion={undefined}
    />
  );

  expect(screen.getByText("61,00 €")).toBeInTheDocument();
  expect(screen.getByText("244,00 €")).toBeInTheDocument();
  expect(container.querySelector("button")).toBeNull();
});
