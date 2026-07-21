import { describe, expect, test } from "vitest";
import { agentsScanner } from "./index";
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

describe("agents scanner", () => {
  test("finds an unpinned MCP server and a skipped approval gate across files", async () => {
    const findings = await agentsScanner.scan(
      repo,
      ctxWith({
        ".mcp.json": JSON.stringify({
          mcpServers: { fs: { command: "npx", args: ["-y", "srv"] } },
        }),
        ".claude/settings.json": JSON.stringify({
          permissions: { defaultMode: "bypassPermissions" },
        }),
        "README.md": "# unrelated",
      }),
    );
    const idsFound = findings.map((f) => f.id);
    expect(idsFound).toContain("agents/unpinned-mcp-server");
    expect(idsFound).toContain("agents/auto-approved-execution");
  });

  test("ignores vendored config", async () => {
    const findings = await agentsScanner.scan(
      repo,
      ctxWith({
        "node_modules/pkg/.mcp.json": JSON.stringify({
          mcpServers: { x: { command: "npx", args: ["-y", "srv"] } },
        }),
      }),
    );
    expect(findings).toHaveLength(0);
  });

  test("a repo with no agent config is clean", async () => {
    const findings = await agentsScanner.scan(
      repo,
      ctxWith({ "src/index.ts": "export const x = 1;" }),
    );
    expect(findings).toHaveLength(0);
  });
});
