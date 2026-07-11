import { describe, expect, test } from "vitest";
import { createDepsScanner } from "./index";
import type { OsvClient, OsvResult } from "./osv";
import type { GitHubClient, RepoRef, ScanContext } from "../../engine/types";
import { PACKAGE_LOCK_V3 } from "../fixtures/manifests";

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
    now: () => new Date("2026-07-11T00:00:00Z"),
  };
}

function osvReturning(results: OsvResult[]): OsvClient {
  return { query: async () => results };
}

describe("deps scanner", () => {
  test("reports a known vulnerability with a CVE alias and fix", async () => {
    const scanner = createDepsScanner(
      osvReturning([
        {
          pkg: {
            ecosystem: "npm",
            name: "lodash",
            version: "4.17.11",
            source: "package-lock.json",
          },
          vulns: [
            {
              id: "GHSA-xxxx",
              aliases: ["CVE-2019-10744"],
              summary: "Prototype pollution in lodash",
            },
          ],
        },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package-lock.json": PACKAGE_LOCK_V3 }),
    );
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.id).toBe("deps/known-vulnerability");
    expect(f.title).toMatch(/lodash@4\.17\.11/);
    expect(f.title).toMatch(/CVE-2019-10744/);
    expect(f.fix).toMatch(/upgrade/i);
    expect(f.evidence.url).toBe("https://osv.dev/vulnerability/GHSA-xxxx");
  });

  test("summarizes multiple advisories on one package", async () => {
    const scanner = createDepsScanner(
      osvReturning([
        {
          pkg: {
            ecosystem: "npm",
            name: "left-pad",
            version: "1.1.3",
            source: "package-lock.json",
          },
          vulns: [{ id: "A" }, { id: "B" }],
        },
      ]),
    );
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package-lock.json": PACKAGE_LOCK_V3 }),
    );
    expect(findings[0]?.title).toMatch(/\+1 more/);
  });

  test("clean dependencies produce no findings", async () => {
    const scanner = createDepsScanner(osvReturning([]));
    const findings = await scanner.scan(
      repo,
      ctxWith({ "package-lock.json": PACKAGE_LOCK_V3 }),
    );
    expect(findings).toHaveLength(0);
  });

  test("no manifests means the OSV client is never queried", async () => {
    let called = false;
    const osv: OsvClient = {
      query: async () => {
        called = true;
        return [];
      },
    };
    const scanner = createDepsScanner(osv);
    const findings = await scanner.scan(repo, ctxWith({ "README.md": "# hi" }));
    expect(findings).toHaveLength(0);
    expect(called).toBe(false);
  });
});
