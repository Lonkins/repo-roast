import { describe, expect, test } from "vitest";
import { renderBadge, scoreColor } from "./badge";

describe("renderBadge", () => {
  test("produces valid SVG with label and message", () => {
    const svg = renderBadge({ label: "burn", message: "42", color: "#e5484d" });
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("burn");
    expect(svg).toContain("42");
    expect(svg).toContain("#e5484d");
  });

  test("escapes angle brackets and ampersands", () => {
    const svg = renderBadge({
      label: "a<b>&c",
      message: "x",
      color: "#000",
    });
    expect(svg).toContain("a&lt;b&gt;&amp;c");
    expect(svg).not.toMatch(/a<b>&c/);
  });

  test("has an accessible aria-label", () => {
    const svg = renderBadge({ label: "score", message: "10", color: "#000" });
    expect(svg).toContain('aria-label="score: 10"');
  });
});

describe("scoreColor", () => {
  test("clean is green, fire is red", () => {
    expect(scoreColor(0)).toBe("#3fb950");
    expect(scoreColor(90)).toBe("#e5484d");
  });

  test("bands are monotonic-ish across the range", () => {
    expect(scoreColor(5)).toBe("#8fbf6f");
    expect(scoreColor(30)).toBe("#d4c04a");
    expect(scoreColor(50)).toBe("#e2a336");
  });
});
