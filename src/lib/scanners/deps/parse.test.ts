import { describe, expect, test } from "vitest";
import {
  dedupePackages,
  parseCargoLock,
  parsePackageJson,
  parsePackageLock,
  parseRequirementsTxt,
  type Package,
} from "./parse";
import {
  CARGO_LOCK,
  PACKAGE_JSON,
  PACKAGE_LOCK_V3,
  REQUIREMENTS_TXT,
} from "../fixtures/manifests";

describe("parsePackageLock", () => {
  test("extracts npm packages from a v3 lockfile", () => {
    const pkgs = parsePackageLock(PACKAGE_LOCK_V3, "package-lock.json");
    const byName = Object.fromEntries(pkgs.map((p) => [p.name, p.version]));
    expect(byName["lodash"]).toBe("4.17.11");
    expect(byName["left-pad"]).toBe("1.1.3");
    expect(byName["@scope/pkg"]).toBe("2.0.0");
  });

  test("ignores the root package entry", () => {
    const pkgs = parsePackageLock(PACKAGE_LOCK_V3, "package-lock.json");
    expect(pkgs.every((p) => p.name !== "app")).toBe(true);
  });

  test("returns nothing for invalid JSON", () => {
    expect(parsePackageLock("{not json", "x")).toEqual([]);
  });
});

describe("parsePackageJson", () => {
  test("keeps exact-pinned versions, drops ranges", () => {
    const pkgs = parsePackageJson(PACKAGE_JSON, "package.json");
    const names = pkgs.map((p) => p.name);
    expect(names).toContain("express");
    expect(names).toContain("vitest");
    // react is ^18.2.0 — a range, not queryable, dropped
    expect(names).not.toContain("react");
  });
});

describe("parseRequirementsTxt", () => {
  test("parses == pins and ignores ranges and comments", () => {
    const pkgs = parseRequirementsTxt(REQUIREMENTS_TXT, "requirements.txt");
    const byName = Object.fromEntries(pkgs.map((p) => [p.name, p.version]));
    expect(byName["flask"]).toBe("0.12.2");
    expect(byName["requests"]).toBe("2.20.0");
    expect(byName["urllib3"]).toBeUndefined();
    expect(pkgs.every((p) => p.ecosystem === "PyPI")).toBe(true);
  });
});

describe("parseCargoLock", () => {
  test("parses [[package]] blocks", () => {
    const pkgs = parseCargoLock(CARGO_LOCK, "Cargo.lock");
    const byName = Object.fromEntries(pkgs.map((p) => [p.name, p.version]));
    expect(byName["time"]).toBe("0.1.42");
    expect(byName["serde"]).toBe("1.0.130");
    expect(pkgs.every((p) => p.ecosystem === "crates.io")).toBe(true);
  });
});

describe("dedupePackages", () => {
  test("dedupes on ecosystem+name+version", () => {
    const dupes: Package[] = [
      { ecosystem: "npm", name: "a", version: "1", source: "x" },
      { ecosystem: "npm", name: "a", version: "1", source: "y" },
      { ecosystem: "npm", name: "a", version: "2", source: "x" },
    ];
    expect(dedupePackages(dupes)).toHaveLength(2);
  });
});
