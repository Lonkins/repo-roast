import { describe, expect, test } from "vitest";
import { burnScore, grade, sortFindings } from "./score";
import type { Finding, Severity } from "./types";

function finding(severity: Severity, id = `x/${severity}`): Finding {
  return {
    id,
    scanner: "hygiene",
    severity,
    title: "t",
    evidence: { repo: "a/b" },
    fix: "f",
  };
}

describe("burnScore", () => {
  test("empty findings score zero", () => {
    expect(burnScore([])).toBe(0);
  });

  test("weights severities and sums", () => {
    expect(burnScore([finding("critical"), finding("low")])).toBe(28);
  });

  test("caps at 100", () => {
    const many = Array.from({ length: 10 }, () => finding("critical"));
    expect(burnScore(many)).toBe(100);
  });
});

describe("grade", () => {
  test("zero is suspiciously clean", () => {
    expect(grade(0)).toBe("Suspiciously clean");
  });

  test("100 is a five-alarm fire", () => {
    expect(grade(100)).toBe("Five-alarm fire");
  });

  test("mid scores land in a middle band", () => {
    expect(grade(50)).toBe("Smoke detected");
  });
});

describe("sortFindings", () => {
  test("orders hottest first without mutating input", () => {
    const input = [finding("low"), finding("critical"), finding("medium")];
    const sorted = sortFindings(input);
    expect(sorted.map((f) => f.severity)).toEqual([
      "critical",
      "medium",
      "low",
    ]);
    expect(input[0]?.severity).toBe("low");
  });
});
