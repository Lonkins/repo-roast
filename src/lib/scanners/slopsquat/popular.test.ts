import { describe, expect, test } from "vitest";
import { editDistance, isPopular, nearestPopular } from "./popular";

describe("editDistance", () => {
  test("identical strings are distance 0", () => {
    expect(editDistance("react", "react")).toBe(0);
  });

  test("single substitution/insertion/deletion is distance 1", () => {
    expect(editDistance("reqeusts", "reqeust")).toBe(1); // deletion
    expect(editDistance("expres", "express")).toBe(1); // insertion
    expect(editDistance("lodahs", "lodash")).toBe(2); // transposition = 2 edits
  });

  test("bails past the cap instead of computing the exact large distance", () => {
    expect(editDistance("react", "tensorflow", 1)).toBe(2);
  });
});

describe("nearestPopular", () => {
  test("finds the popular name a typo is one edit from", () => {
    expect(nearestPopular("npm", "expres")).toBe("express");
    expect(nearestPopular("PyPI", "requsts")).toBe("requests");
  });

  test("returns null for a popular name itself", () => {
    expect(nearestPopular("npm", "react")).toBeNull();
    expect(nearestPopular("PyPI", "requests")).toBeNull();
  });

  test("returns null when nothing is within one edit", () => {
    expect(nearestPopular("npm", "my-totally-unique-lib")).toBeNull();
  });

  test("compares scoped npm names on their bare part", () => {
    expect(isPopular("npm", "@tanstack/react-query")).toBe(true);
  });
});
