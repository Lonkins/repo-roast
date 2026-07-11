import { describe, expect, test } from "vitest";
import { scanAndRoast } from "./scan-service";
import type { GitHubClient, RepoRef } from "./engine/types";
import { DANGEROUS_PR_TARGET } from "./scanners/fixtures/workflows";
import { FAKE_AWS_KEY } from "./scanners/fixtures/secrets";
import { PACKAGE_LOCK_V3 } from "./scanners/fixtures/manifests";

const repo: RepoRef = {
  owner: "octo",
  repo: "landmine",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};

/**
 * A repo wired up to trip three of the four scanners at once — the
 * definition-of-done acceptance scenario: a secret in history, a
 * pull_request_target misconfig, and a (fake-vulnerable) dependency.
 */
function landmineGitHub(): GitHubClient {
  const files: Record<string, string> = {
    ".github/workflows/ci.yml": DANGEROUS_PR_TARGET,
    "package-lock.json": PACKAGE_LOCK_V3,
  };
  const paths = [
    ...Object.keys(files),
    "src/index.ts",
    "SECURITY.md",
    "LICENSE",
  ];
  return {
    getRepo: async () => repo,
    listProfileRepos: async () => [repo],
    getFile: async (_r, path) =>
      files[path] ? { content: files[path]!, sha: "s" } : null,
    getTree: async () => ({ paths, truncated: false }),
    listCommits: async () => [{ sha: "c1", message: "add config" }],
    getCommitPatches: async () => [
      {
        path: "src/index.ts",
        patch: `@@ -0,0 +1 @@\n+const key = "${FAKE_AWS_KEY}";`,
      },
    ],
  };
}

function cleanGitHub(): GitHubClient {
  const paths = ["src/index.ts", "SECURITY.md", "LICENSE", "README.md"];
  return {
    getRepo: async () => ({ ...repo, repo: "immaculate" }),
    listProfileRepos: async () => [{ ...repo, repo: "immaculate" }],
    getFile: async () => null,
    getTree: async () => ({ paths, truncated: false }),
    listCommits: async () => [],
    getCommitPatches: async () => [],
  };
}

describe("scanAndRoast (integration)", () => {
  test("surfaces the planted secret, workflow misconfig and vulnerable dep", async () => {
    const outcome = await scanAndRoast(
      { kind: "repo", owner: "octo", repo: "landmine" },
      { github: landmineGitHub(), env: {} },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const ids = new Set(outcome.report.findings.map((f) => f.id));
    expect(ids).toContain("secrets/leaked-credential");
    expect(ids).toContain("workflows/pull-request-target-checkout");
    // package-lock has lodash@4.17.11 etc. — but OSV isn't queried here; assert
    // the two deterministic-from-fixture findings and that every finding has a fix.
    expect(outcome.report.burnScore).toBeGreaterThan(0);
    expect(outcome.report.findings.every((f) => f.fix.length > 0)).toBe(true);
    expect(outcome.roast.lines.length).toBeGreaterThan(0);
  });

  test("a clean repo gets a complimentary roast, not invented flaws", async () => {
    const outcome = await scanAndRoast(
      { kind: "repo", owner: "octo", repo: "immaculate" },
      { github: cleanGitHub(), env: {} },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.report.findings).toHaveLength(0);
    expect(outcome.report.grade).toBe("Suspiciously clean");
    expect(outcome.roast.lines).toHaveLength(0);
    expect(outcome.roast.intro.length).toBeGreaterThan(0);
  });

  test("translates a 404 into a friendly not-found error", async () => {
    const gh: GitHubClient = {
      ...cleanGitHub(),
      getRepo: async () => {
        throw Object.assign(new Error("Not Found"), { status: 404 });
      },
    };
    const outcome = await scanAndRoast(
      { kind: "repo", owner: "octo", repo: "ghost" },
      { github: gh, env: {} },
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.kind).toBe("not-found");
  });
});
