import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exitCodeFor, parseArgs, runLocalScan } from "./scan";
import type { Finding, Severity } from "../lib/engine/types";

describe("parseArgs", () => {
  test("sensible defaults", () => {
    const o = parseArgs([]);
    expect(o.failOn).toBe("high");
    expect(o.noNetwork).toBe(false);
    expect(o.format).toBe("pretty");
  });

  test("parses flags and a positional path", () => {
    const o = parseArgs([
      "--no-network",
      "--fail-on",
      "critical",
      "--format",
      "json",
      "/some/path",
    ]);
    expect(o.noNetwork).toBe(true);
    expect(o.failOn).toBe("critical");
    expect(o.format).toBe("json");
    expect(o.cwd).toBe("/some/path");
  });

  test("rejects a bad or missing --fail-on (fail closed, never open)", () => {
    expect(() => parseArgs(["--fail-on", "bogus"])).toThrow(/fail-on/);
    expect(() => parseArgs(["--fail-on"])).toThrow(/fail-on/); // no value
    expect(() => parseArgs(["--format", "yaml"])).toThrow(/format/);
  });
});

describe("exitCodeFor", () => {
  const f = (severity: Severity) => ({ severity }) as Finding;

  test("trips (exit 1) when a finding meets the threshold", () => {
    expect(exitCodeFor([f("high")], "high")).toBe(1);
    expect(exitCodeFor([f("critical")], "high")).toBe(1);
  });

  test("passes (exit 0) when everything is below the threshold", () => {
    expect(exitCodeFor([f("medium"), f("info")], "high")).toBe(0);
    expect(exitCodeFor([], "high")).toBe(0);
  });

  test("fails closed on an unrecognized threshold (never silently passes)", () => {
    expect(exitCodeFor([f("info")], "bogus" as Severity)).toBe(1);
    expect(exitCodeFor([], "bogus" as Severity)).toBe(0);
  });
});

describe("runLocalScan (offline, against a local working tree)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "rr-cli-"));
    await writeFile(
      join(dir, "ai-client.ts"),
      "new OpenAI({ dangerouslyAllowBrowser: true });",
    );
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("flags a local exposure issue and exits non-zero", async () => {
    const chunks: string[] = [];
    const code = await runLocalScan(
      { cwd: dir, failOn: "high", noNetwork: true, format: "json" },
      (s) => chunks.push(s),
    );
    expect(code).toBe(1);
    expect(chunks.join("")).toContain("exposure/llm-key-in-browser");
  });

  test("a clean tree passes with exit 0", async () => {
    const clean = await mkdtemp(join(tmpdir(), "rr-clean-"));
    await writeFile(join(clean, "index.ts"), "export const x = 1;");
    const code = await runLocalScan(
      { cwd: clean, failOn: "high", noNetwork: true, format: "pretty" },
      () => {},
    );
    await rm(clean, { recursive: true, force: true });
    expect(code).toBe(0);
  });
});
