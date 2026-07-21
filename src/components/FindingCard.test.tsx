import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FindingCard } from "./FindingCard";
import type { RoastLine } from "@/lib/roast";

const line: RoastLine = {
  findingId: "exposure/llm-key-in-browser",
  burn: "You shipped your API key to every visitor. Generous.",
  fix: "Move the LLM call server-side.",
  severity: "critical",
};

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(cleanup);

test("renders the burn, the fix, the why, and the copy-paste agent prompt", () => {
  render(
    <FindingCard
      line={line}
      title="LLM key in the browser"
      why="Anyone can lift the key from the page and run up your bill."
      agentPrompt="Move the LLM call to a server route and rotate the key."
    />,
  );
  expect(screen.getByText(line.burn)).toBeInTheDocument();
  expect(screen.getByText(line.fix)).toBeInTheDocument();
  // "Why it bites" label + its content (mixed inline text — assert on the <p>).
  expect(screen.getByText(/why it bites/i).closest("p")).toHaveTextContent(
    /anyone can lift the key/i,
  );
  expect(screen.getByText(/fix it with your ai agent/i)).toBeInTheDocument();
  expect(
    screen.getByText("Move the LLM call to a server route and rotate the key."),
  ).toBeInTheDocument();
});

test("the copy button puts the agent prompt on the clipboard and confirms", async () => {
  render(
    <FindingCard line={line} title="t" why="w" agentPrompt="PROMPT-TEXT-123" />,
  );
  fireEvent.click(screen.getByRole("button", { name: /copy prompt/i }));
  await waitFor(() =>
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "PROMPT-TEXT-123",
    ),
  );
  expect(
    await screen.findByRole("button", { name: /copied/i }),
  ).toBeInTheDocument();
});

test("omits the why and agent-prompt blocks when a finding has neither", () => {
  render(<FindingCard line={line} title="t" />);
  expect(screen.queryByText(/why it bites/i)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/fix it with your ai agent/i),
  ).not.toBeInTheDocument();
});
