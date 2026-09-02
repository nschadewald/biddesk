import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import HowToTest, { PROMPTS } from "./HowToTest";
import { copyFor } from "./i18n";

/**
 * The juror's page and the agent panel tell the same story, or the page lies.
 *
 * It did, once: five prompts from before the confirmations and the blockers,
 * and "a dialog appears" beside a product that answers "blocked". This holds
 * the page to the panel's seven, in the panel's order, from the same source.
 */

it("shows exactly the agent panel's seven prompts, in the panel's order", () => {
  render(<HowToTest />);
  const cards = within(screen.getByTestId("prompt-cards")).getAllByRole("listitem");
  expect(cards).toHaveLength(7);
  const shown = cards.map((card) => within(card).getByTestId("prompt-text").textContent);
  expect(shown).toEqual(copyFor("en").panel.prompts);
  // And the page's own list is the dictionary's, entry for entry.
  expect(PROMPTS.map((entry) => entry.prompt)).toEqual(copyFor("en").panel.prompts);
});

it("says under every prompt what should visibly happen, and names the blocker case", () => {
  render(<HowToTest />);
  for (const entry of PROMPTS) expect(entry.expect.length).toBeGreaterThan(80);

  // The sentence that was missing: submitting early is answered with blocked,
  // no dialog, and that is the product, not a fault.
  expect(screen.getByText(/Submitting before prompts 3 and 5 returns blocked/)).toBeInTheDocument();
  expect(screen.getByText(/not a fault/)).toBeInTheDocument();
  // The dictated prices wait; the certificate is a date a person stated.
  expect(screen.getByText(/AWAITING CONFIRMATION/)).toBeInTheDocument();
  expect(screen.getByText(/Nothing is uploaded or verified/)).toBeInTheDocument();
  // Three side trips, the third being E9.
  expect(screen.getByText(/Three more worth a minute/)).toBeInTheDocument();
  expect(screen.getByText(/set every price to 1 euro and submit/)).toBeInTheDocument();
  // The count a juror checks against the panel.
  expect(screen.getByText(/11 tools registered/)).toBeInTheDocument();
  expect(screen.getByText(/Eleven of them/)).toBeInTheDocument();
});
