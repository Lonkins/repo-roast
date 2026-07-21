import { describe, expect, test } from "vitest";
import { hygieneScanner } from "./index";
import type { GitHubClient, RepoRef, ScanContext } from "../../engine/types";

function makeRepo(over: Partial<RepoRef> = {}): RepoRef {
  return {
    owner: "octo",
    repo: "app",
    defaultBranch: "main",
    isPrivate: false,
    isFork: false,
    ...over,
  };
}

function ctxWith(paths: string[]): ScanContext {
  const github: GitHubClient = {
    getRepo: async () => makeRepo(),
    listProfileRepos: async () => [makeRepo()],
    getFile: async () => null,
    getTree: async () => ({ paths, truncated: false }),
    listCommits: async () => [],
    getCommitPatches: async () => [],
  };
  return {
    github,
    gitleaksAvailable: false,
    now: () => new Date("2026-07-11T00:00:00Z"),
  };
}

async function idsFor(repo: RepoRef, paths: string[]) {
  return (await hygieneScanner.scan(repo, ctxWith(paths))).map((f) => f.id);
}

describe("hygiene scanner", () => {
  const cleanPaths = ["src/index.ts", "SECURITY.md", "LICENSE", "README.md"];

  test("a well-kept repo produces no findings", async () => {
    expect(await idsFor(makeRepo(), cleanPaths)).toHaveLength(0);
  });

  test("flags an id_rsa private key as high", async () => {
    const findings = await hygieneScanner.scan(
      makeRepo(),
      ctxWith([...cleanPaths, "deploy/id_rsa"]),
    );
    const f = findings.find((x) => x.id === "hygiene/suspicious-file");
    expect(f?.severity).toBe("high");
    expect(f?.title).toMatch(/id_rsa/);
  });

  test("flags a committed database dump", async () => {
    expect(await idsFor(makeRepo(), [...cleanPaths, "backup.sql"])).toContain(
      "hygiene/suspicious-file",
    );
  });

  test("flags committed node_modules as a low-severity artifact", async () => {
    const findings = await hygieneScanner.scan(
      makeRepo(),
      ctxWith([...cleanPaths, "node_modules/left-pad/index.js"]),
    );
    const f = findings.find((x) => x.id === "hygiene/committed-artifacts");
    expect(f?.severity).toBe("low");
  });

  test("nudges when SECURITY.md is missing", async () => {
    expect(await idsFor(makeRepo(), ["src/index.ts", "LICENSE"])).toContain(
      "hygiene/missing-security-md",
    );
  });

  test("accepts SECURITY.md under .github/", async () => {
    expect(
      await idsFor(makeRepo(), [
        "src/index.ts",
        "LICENSE",
        ".github/SECURITY.md",
      ]),
    ).not.toContain("hygiene/missing-security-md");
  });

  test("flags a public repo with no license", async () => {
    expect(await idsFor(makeRepo(), ["src/index.ts", "SECURITY.md"])).toContain(
      "hygiene/missing-license",
    );
  });

  test("does not flag a private repo for a missing license", async () => {
    const ids = await idsFor(makeRepo({ isPrivate: true }), [
      "src/index.ts",
      "SECURITY.md",
    ]);
    expect(ids).not.toContain("hygiene/missing-license");
  });

  test("every finding carries a fix, a why, and an agent prompt", async () => {
    const findings = await hygieneScanner.scan(
      makeRepo(),
      ctxWith(["deploy/id_rsa", "node_modules/x/i.js"]),
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.fix && f.why && f.agentPrompt)).toBe(true);
  });
});
