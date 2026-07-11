import { describe, expect, test } from "vitest";
import { runScan } from "./orchestrator";
import type {
  Finding,
  GitHubClient,
  RepoRef,
  Scanner,
  ScanContext,
} from "./types";

const repoA: RepoRef = {
  owner: "octo",
  repo: "a",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};
const repoB: RepoRef = { ...repoA, repo: "b" };

function fakeGitHub(repos: RepoRef[]): GitHubClient {
  return {
    getRepo: async (owner, repo) => {
      const found = repos.find((r) => r.owner === owner && r.repo === repo);
      if (!found) throw new Error("not found");
      return found;
    },
    listProfileRepos: async (_owner, limit) => repos.slice(0, limit),
    getFile: async () => null,
    getTree: async () => ({ paths: [], truncated: false }),
    listCommits: async () => [],
    getCommitPatches: async () => [],
  };
}

function ctx(repos: RepoRef[]): ScanContext {
  return {
    github: fakeGitHub(repos),
    gitleaksAvailable: false,
    now: () => new Date("2026-07-11T00:00:00Z"),
  };
}

function scannerReturning(findings: Finding[]): Scanner {
  return { id: "hygiene", scan: async () => findings };
}

const aFinding: Finding = {
  id: "hygiene/test",
  scanner: "hygiene",
  severity: "high",
  title: "t",
  evidence: { repo: "octo/a" },
  fix: "f",
};

describe("runScan", () => {
  test("repo target scans exactly that repo", async () => {
    const report = await runScan(
      { kind: "repo", owner: "octo", repo: "a" },
      [scannerReturning([aFinding])],
      ctx([repoA, repoB]),
    );
    expect(report.repos).toHaveLength(1);
    expect(report.findings).toHaveLength(1);
    expect(report.burnScore).toBe(15);
    expect(report.grade).toBe("Mild heat");
  });

  test("profile target expands to listed repos", async () => {
    const report = await runScan(
      { kind: "profile", owner: "octo" },
      [scannerReturning([aFinding])],
      ctx([repoA, repoB]),
    );
    expect(report.repos).toHaveLength(2);
    expect(report.findings).toHaveLength(2);
  });

  test("a throwing scanner yields partial results and is reported", async () => {
    const boom: Scanner = {
      id: "secrets",
      scan: async () => {
        throw new Error("boom");
      },
    };
    const report = await runScan(
      { kind: "repo", owner: "octo", repo: "a" },
      [boom, scannerReturning([aFinding])],
      ctx([repoA]),
    );
    expect(report.findings).toHaveLength(1);
    expect(report.repos[0]?.failedScanners).toEqual(["secrets"]);
  });

  test("clean scan reports zero score and clean grade", async () => {
    const report = await runScan(
      { kind: "repo", owner: "octo", repo: "a" },
      [scannerReturning([])],
      ctx([repoA]),
    );
    expect(report.burnScore).toBe(0);
    expect(report.grade).toBe("Suspiciously clean");
  });
});
