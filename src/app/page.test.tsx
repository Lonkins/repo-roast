import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("landing page renders the repo-roast heading", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { name: /repo-roast/i }),
  ).toBeInTheDocument();
});
