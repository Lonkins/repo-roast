import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Home from "./page";

// RoastForm uses next/navigation's useRouter — stub it for the render smoke test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

test("landing page renders the repo-roast heading and the input", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { name: /repo-roast/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText(/github username or owner\/repo/i),
  ).toBeInTheDocument();
});
