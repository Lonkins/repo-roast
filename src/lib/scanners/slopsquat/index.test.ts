import { describe, expect, test } from "vitest";
import { createSlopsquatScanner } from "./index";
import type { RegistryClient, RegistryProbe } from "./registry";
import type { GitHubClient, RepoRef, ScanContext } from "../../engine/types";

const repo: RepoRef = {
  owner: "octo",
  repo: "app",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};

function ctxWith(files: Record<string, string>): ScanContext {
  const github: GitHubClient = {
    getRepo: async () => repo,
    listProfileRepos: async () => [repo],
    getFile: async (_r, path) =>
      files[path] ? { content: files[path]!, sha: "s" } : null,
    getTree: async () => ({ paths: Object.keys(files), truncated: false }),
    listCommits: async () => [],
    getCommitPatches: async () => [],
  };
  return {
    github,
    gitleaksAvailable: false,
    // Fixed clock so "newborn" age math is deterministic.
    now: () => new Date("2026-07-21T00:00:00Z"),
  };
}

function registryReturning(probes: RegistryProbe[]): RegistryClient {
  return { probe: async () => probes };
}

const pkgJson = (deps: Record<string, string>) =>
  JSON.stringify({ dependencies: deps });

describe("slopsquat scanner", () => {
  test("flags a nonexistent dependency as critical with a paste-ready fix", async () => {
    const scanner = createSlopsquatScanner(
      registryReturning([{ ecosystem: "npm", name: "expres", exists: false }]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package.json": pkgJson({ expres: "^1.0.0" }) }),
    );
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.id).toBe("slopsquat/nonexistent-dependency");
    expect(f.severity).toBe("critical");
    expect(f.title).toMatch(/does not exist/);
    expect(f.evidence.path).toBe("package.json");
    // near-popular enrichment
    expect(f.fix).toMatch(/express/);
    expect(f.why).toMatch(/slopsquat/i);
    expect(f.agentPrompt).toMatch(/package\.json/);
  });

  test("flags an existing typosquat of a popular package as high", async () => {
    const scanner = createSlopsquatScanner(
      registryReturning([
        {
          ecosystem: "npm",
          name: "axio",
          exists: true,
          createdAt: "2026-07-10T00:00:00Z",
          versionCount: 1,
        },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package.json": pkgJson({ axio: "^1.0.0" }) }),
    );
    const f = findings[0]!;
    expect(f.id).toBe("slopsquat/typosquat-suspect");
    expect(f.severity).toBe("high");
    expect(f.title).toMatch(/axios/);
  });

  test("flags a brand-new, barely-published dependency as medium", async () => {
    const scanner = createSlopsquatScanner(
      registryReturning([
        {
          ecosystem: "npm",
          name: "my-fresh-utils",
          exists: true,
          createdAt: "2026-07-10T00:00:00Z", // 11 days old
          versionCount: 1,
        },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package.json": pkgJson({ "my-fresh-utils": "^0.0.1" }) }),
    );
    const f = findings[0]!;
    expect(f.id).toBe("slopsquat/newborn-dependency");
    expect(f.severity).toBe("medium");
  });

  test("escalates a newborn dependency with install scripts to high", async () => {
    const scanner = createSlopsquatScanner(
      registryReturning([
        {
          ecosystem: "npm",
          name: "my-fresh-utils",
          exists: true,
          createdAt: "2026-07-10T00:00:00Z",
          versionCount: 1,
          hasInstallScripts: true,
        },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package.json": pkgJson({ "my-fresh-utils": "^0.0.1" }) }),
    );
    expect(findings[0]!.severity).toBe("high");
    expect(findings[0]!.why).toMatch(/install/i);
  });

  test("does not flag an established package that merely resembles a popular one", async () => {
    // preact is one edit from "react" but is old and heavily published.
    const scanner = createSlopsquatScanner(
      registryReturning([
        {
          ecosystem: "npm",
          name: "preact",
          exists: true,
          createdAt: "2018-01-01T00:00:00Z",
          versionCount: 200,
        },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package.json": pkgJson({ preact: "^10.0.0" }) }),
    );
    expect(findings).toHaveLength(0);
  });

  test("never guesses when the registry couldn't be reached", async () => {
    const scanner = createSlopsquatScanner(
      registryReturning([
        { ecosystem: "npm", name: "mystery", exists: undefined },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package.json": pkgJson({ mystery: "^1.0.0" }) }),
    );
    expect(findings).toHaveLength(0);
  });

  test("no manifests means the registry is never queried", async () => {
    let called = false;
    const registry: RegistryClient = {
      probe: async () => {
        called = true;
        return [];
      },
    };
    const scanner = createSlopsquatScanner(registry);
    const findings = await scanner.scan(repo, ctxWith({ "README.md": "# hi" }));
    expect(findings).toHaveLength(0);
    expect(called).toBe(false);
  });

  test("every finding ships a fix, a why, and an agent prompt", async () => {
    const scanner = createSlopsquatScanner(
      registryReturning([
        { ecosystem: "npm", name: "expres", exists: false },
        {
          ecosystem: "PyPI",
          name: "my-fresh-lib",
          exists: true,
          createdAt: "2026-07-15T00:00:00Z",
          versionCount: 1,
        },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({
        "package.json": pkgJson({ expres: "1.0.0" }),
        "requirements.txt": "my-fresh-lib==0.0.1\n",
      }),
    );
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((f) => f.fix && f.why && f.agentPrompt)).toBe(true);
  });
});
