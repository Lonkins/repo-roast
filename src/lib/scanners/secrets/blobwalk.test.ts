import { describe, expect, test } from "vitest";
import { blobWalkSecrets } from "./blobwalk";
import type { GitHubClient, RepoRef, ScanContext } from "../../engine/types";
import { FAKE_AWS_KEY } from "../fixtures/secrets";

const repo: RepoRef = {
  owner: "octo",
  repo: "leaky",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};

interface Fixture {
  paths?: string[];
  commits?: { sha: string; message: string }[];
  patches?: Record<string, { path: string; patch: string }[]>;
}

function ctxWith(fx: Fixture): ScanContext {
  const github: GitHubClient = {
    getRepo: async () => repo,
    listProfileRepos: async () => [repo],
    getFile: async () => null,
    getTree: async () => ({ paths: fx.paths ?? [], truncated: false }),
    listCommits: async () => fx.commits ?? [],
    getCommitPatches: async (_r, sha) => fx.patches?.[sha] ?? [],
  };
  return {
    github,
    gitleaksAvailable: false,
    now: () => new Date("2026-07-11T00:00:00Z"),
  };
}

/** Build an added-lines patch hunk. */
function addedPatch(path: string, ...lines: string[]) {
  return {
    path,
    patch: ["@@ -0,0 +1 @@", ...lines.map((l) => `+${l}`)].join("\n"),
  };
}

describe("blobWalkSecrets", () => {
  test("flags a committed .env in the current tree", async () => {
    const findings = await blobWalkSecrets(
      repo,
      ctxWith({ paths: ["src/app.ts", ".env"] }),
    );
    const dotenv = findings.find((f) => f.id === "secrets/committed-dotenv");
    expect(dotenv).toBeDefined();
    expect(dotenv?.severity).toBe("high");
    expect(dotenv?.fix).toMatch(/rotate/i);
  });

  test("does not flag .env.example", async () => {
    const findings = await blobWalkSecrets(
      repo,
      ctxWith({ paths: [".env.example", ".env.sample"] }),
    );
    expect(
      findings.filter((f) => f.id === "secrets/committed-dotenv"),
    ).toHaveLength(0);
  });

  test("flags a leaked credential still present in the tree as critical", async () => {
    const findings = await blobWalkSecrets(
      repo,
      ctxWith({
        paths: ["config.ts"],
        commits: [{ sha: "abc123", message: "add config" }],
        patches: {
          abc123: [addedPatch("config.ts", `const key = "${FAKE_AWS_KEY}";`)],
        },
      }),
    );
    const leak = findings.find((f) => f.id === "secrets/leaked-credential");
    expect(leak).toBeDefined();
    expect(leak?.severity).toBe("critical");
  });

  test("flags a deleted-but-in-history credential distinctly", async () => {
    const findings = await blobWalkSecrets(
      repo,
      ctxWith({
        paths: ["config.ts"], // secrets.ts was deleted; not in tree
        commits: [{ sha: "def456", message: "oops add secret" }],
        patches: {
          def456: [addedPatch("secrets.ts", `aws = "${FAKE_AWS_KEY}"`)],
        },
      }),
    );
    const leak = findings.find(
      (f) => f.id === "secrets/leaked-credential-history",
    );
    expect(leak).toBeDefined();
    expect(leak?.title).toMatch(/still in history/i);
    expect(leak?.fix).toMatch(/git remembers/i);
  });

  test("a clean repo yields no secret findings", async () => {
    const findings = await blobWalkSecrets(
      repo,
      ctxWith({
        paths: ["src/index.ts", ".env.example"],
        commits: [{ sha: "c1", message: "init" }],
        patches: { c1: [addedPatch("src/index.ts", "export const x = 1;")] },
      }),
    );
    expect(findings).toHaveLength(0);
  });
});
