import { describe, expect, test } from "vitest";
import { claimsScanner } from "./index";
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
    now: () => new Date("2026-07-21T00:00:00Z"),
  };
}

describe("claims scanner", () => {
  test("catches a promised test command with no test script", async () => {
    const findings = await claimsScanner.scan(
      repo,
      ctxWith({
        "README.md": "## Testing\nRun `npm test` to check everything.",
        "package.json": JSON.stringify({ scripts: { dev: "next dev" } }),
      }),
    );
    expect(findings.map((f) => f.id)).toContain("claims/undefined-script");
  });

  test("a repo with no README yields nothing", async () => {
    const findings = await claimsScanner.scan(
      repo,
      ctxWith({ "package.json": "{}" }),
    );
    expect(findings).toHaveLength(0);
  });

  test("an honest README with matching scripts and workflow is clean", async () => {
    const findings = await claimsScanner.scan(
      repo,
      ctxWith({
        "README.md":
          "Run `npm test`. ![CI](https://github.com/octo/app/actions/workflows/ci.yml/badge.svg)",
        "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
        ".github/workflows/ci.yml": "name: CI",
      }),
    );
    expect(findings).toHaveLength(0);
  });
});
