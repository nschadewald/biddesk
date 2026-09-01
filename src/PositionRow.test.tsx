import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import PositionRow, { parsePrice } from "./PositionRow";
import type { Position, PriceRejection, Suggestion, SuggestionSource } from "./types";

const SOURCE: SuggestionSource = {
  price_book_id: "PB-A-001",
  source_project: "Luegallee 40",
  source_date: "2026-03-14",
  source_position_text: "Baustelleneinrichtung, Abdecken Treppenhaus und Böden"
};

const position = (over: Partial<Position> = {}): Position => ({
  oz: "01.01",
  text: "Site setup",
  long_text: null,
  quantity: 1,
  unit: "psch",
  category: "prep",
  contingency: false,
  my_unit_price: null,
  line_total: null,
  set_by: null,
  source: null,
  ...over
});

const proposal = (over: Partial<Suggestion> = {}): Suggestion => ({
  oz: "01.01",
  unit_price: 480,
  matched_terms: 2,
  matched_on: ["category", "unit"],
  based_on: SOURCE,
  reason: "Same category and unit; 2 search terms matched.",
  ...over
});

function row(props: {
  position: Position;
  suggestion?: Suggestion;
  rejection?: PriceRejection;
  locked?: boolean;
  onAccept?: (suggestion: Suggestion) => void;
  onEnter?: (oz: string, unitPrice: number) => void;
}) {
  return render(
    <table>
      <tbody>
        <PositionRow
          position={props.position}
          suggestion={props.suggestion}
          rejection={props.rejection}
          locked={props.locked ?? false}
          onAccept={props.onAccept ?? (() => {})}
          onEnter={props.onEnter ?? (() => {})}
        />
      </tbody>
    </table>
  );
}

it("parses both German and English decimals, and refuses anything else", () => {
  expect(parsePrice("8,40")).toBe(8.4);
  expect(parsePrice("8.40")).toBe(8.4);
  expect(parsePrice(" 148 ")).toBe(148);
  expect(parsePrice("")).toBeNull();
  expect(parsePrice("teuer")).toBeNull();
});

it("keeps the price cell empty and puts the proposal on a chip beside it", () => {
  row({ position: position(), suggestion: proposal() });

  const chip = screen.getByRole("button", { name: /Luegallee 40/ });
  expect(within(chip).getByText("480,00 €")).toBeInTheDocument();
  expect(screen.getByLabelText("Unit price for 01.01")).toHaveValue("");
  expect(screen.getByText("—")).toBeInTheDocument();
});

it("offers a Use button that hands the proposal back with its source", async () => {
  const onAccept = vi.fn();
  row({ position: position(), suggestion: proposal(), onAccept });

  await userEvent.click(screen.getByRole("button", { name: "Use" }));

  expect(onAccept).toHaveBeenCalledTimes(1);
  expect(onAccept.mock.calls[0]?.[0].based_on.price_book_id).toBe("PB-A-001");
});

it("keeps the source chip after the value is in the cell", () => {
  row({
    position: position({ my_unit_price: 480, line_total: 480, set_by: "agent", source: SOURCE }),
    suggestion: proposal()
  });

  expect(screen.getByLabelText("Unit price for 01.01")).toHaveValue("480,00");
  // The provenance does not disappear at the moment it starts to count.
  expect(screen.getByRole("button", { name: /Luegallee 40/ })).toBeInTheDocument();
  // Nothing left to accept, so no Use button.
  expect(screen.queryByRole("button", { name: "Use" })).not.toBeInTheDocument();
});

it("opens the original price book line, with matched_terms, when the chip is clicked", async () => {
  row({ position: position(), suggestion: proposal() });

  expect(screen.queryByText(/matched_terms/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Luegallee 40/ }));

  expect(screen.getByText(SOURCE.source_position_text)).toBeInTheDocument();
  expect(screen.getByText("matched_terms 2 · matched_on category, unit")).toBeInTheDocument();
  expect(screen.getByText(/PB-A-001/)).toBeInTheDocument();
});

it("gives every chip the same look, whatever the number of matched terms", () => {
  const { container } = render(
    <table>
      <tbody>
        <PositionRow
          position={position({ oz: "a" })}
          suggestion={proposal({ oz: "a", matched_terms: 1 })}
          rejection={undefined}
          locked={false}
          onAccept={() => {}}
          onEnter={() => {}}
        />
        <PositionRow
          position={position({ oz: "b" })}
          suggestion={proposal({ oz: "b", matched_terms: 4 })}
          rejection={undefined}
          locked={false}
          onAccept={() => {}}
          onEnter={() => {}}
        />
      </tbody>
    </table>
  );

  const [weak, strong] = [...container.querySelectorAll("button")].filter((button) =>
    button.textContent?.includes("Luegallee")
  );
  // No filled-versus-outlined, no shading by strength: a grading would be the
  // confidence scale we deliberately do not have.
  expect(weak?.className).toBe(strong?.className);
});

it("shows a gap as plain words, with no price and no warning", () => {
  const { container } = row({
    position: position({ oz: "03.04", text: "Radiators" }),
    suggestion: proposal({
      oz: "03.04",
      unit_price: null,
      matched_terms: 0,
      matched_on: [],
      based_on: null,
      reason: "no comparable entry in your price book"
    })
  });

  expect(screen.getByText("no comparable entry")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Use/ })).not.toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/red|amber|yellow|⚠/);
});

it("shows a price entered by a person without any chip", () => {
  row({
    position: position({
      quantity: 4,
      unit: "pcs",
      my_unit_price: 61,
      line_total: 244,
      set_by: "human",
      source: null
    })
  });

  expect(screen.getByLabelText("Unit price for 01.01")).toHaveValue("61,00");
  expect(screen.getByText("244,00 €")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("lets a person type a price into a gap and reports it once, on Enter", async () => {
  const onEnter = vi.fn();
  row({
    position: position({ oz: "03.04", quantity: 4 }),
    suggestion: proposal({ oz: "03.04", unit_price: null, based_on: null, matched_terms: 0 }),
    onEnter
  });

  const input = screen.getByLabelText("Unit price for 03.04");
  await userEvent.type(input, "61,00{Enter}");

  expect(onEnter).toHaveBeenCalledExactlyOnceWith("03.04", 61);
});

it("marks a refused row in place, with its machine-readable reason", () => {
  const { container } = row({
    position: position({ oz: "02.01" }),
    rejection: {
      oz: "02.01",
      reason: "price_does_not_match_source",
      hint: "Price book line PB-A-004 is 2.9, not 5."
    }
  });

  expect(screen.getByText("price_does_not_match_source")).toBeInTheDocument();
  // The mark belongs to the row, and it is not red: red is for check_bid alone.
  expect(container.querySelector("tr[data-oz='02.01']")?.textContent).toContain("not written");
  expect(container.innerHTML).not.toMatch(/red|amber|yellow/);
});

it("locks the row once the bid has been handed in", () => {
  row({
    position: position({ my_unit_price: 480, line_total: 480, set_by: "agent", source: SOURCE }),
    suggestion: proposal(),
    locked: true
  });

  expect(screen.getByLabelText("Unit price for 01.01")).toHaveAttribute("readonly");
  // The source is still there; only the ability to change anything is gone.
  expect(screen.getByRole("button", { name: /Luegallee 40/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Use" })).not.toBeInTheDocument();
});

it("says on the chip what the chip is, not only where it points", () => {
  row({ position: position(), suggestion: proposal() });

  // The claim this whole application makes is that the number came from a
  // quote this firm wrote before. Before, the chip said "Luegallee 40, March
  // 2026" and you had to already know that to read it.
  const chip = screen.getByRole("button", { name: /from your quote/ });
  expect(within(chip).getByText("from your quote")).toBeInTheDocument();
  expect(within(chip).getByText("Luegallee 40 · March 2026")).toBeInTheDocument();
  expect(within(chip).getByText("480,00 €")).toBeInTheDocument();
});

it("names the original line before quoting it", async () => {
  row({ position: position(), suggestion: proposal() });
  await userEvent.click(screen.getByRole("button", { name: /from your quote/ }));

  expect(screen.getByText("the line you priced back then")).toBeInTheDocument();
  expect(screen.getByText(SOURCE.source_position_text)).toBeInTheDocument();
  // Still data underneath, still not a scale.
  expect(screen.getByText("matched_terms 2 · matched_on category, unit")).toBeInTheDocument();
});

it("keeps the wording off the chip when a person typed the price", () => {
  row({
    position: position({ my_unit_price: 61, line_total: 61, set_by: "human", source: null })
  });

  // No chip at all: a value without provenance must not borrow the words of
  // one. That distinction is the point of the three states.
  expect(screen.queryByText(/from your quote/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
