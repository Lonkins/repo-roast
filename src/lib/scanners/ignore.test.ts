import { describe, expect, test } from "vitest";
import { isTestOrFixturePath } from "./ignore";

describe("isTestOrFixturePath", () => {
  test("matches test/spec files and fixture directories", () => {
    expect(isTestOrFixturePath("src/foo.test.ts")).toBe(true);
    expect(isTestOrFixturePath("src/foo.spec.tsx")).toBe(true);
    expect(isTestOrFixturePath("app/bar.test.js")).toBe(true);
    expect(isTestOrFixturePath("src/lib/fixtures/manifests.ts")).toBe(true);
    expect(isTestOrFixturePath("a/__tests__/b.ts")).toBe(true);
  });

  test("does not match ordinary source", () => {
    expect(isTestOrFixturePath("src/app.ts")).toBe(false);
    expect(isTestOrFixturePath("src/api/route.ts")).toBe(false);
    expect(isTestOrFixturePath(".env")).toBe(false);
  });
});
