import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";

test("renders the header and the deploy-path marker", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "BidDesk" })).toBeInTheDocument();
  expect(screen.getByText("deploy path ok")).toBeInTheDocument();
});
