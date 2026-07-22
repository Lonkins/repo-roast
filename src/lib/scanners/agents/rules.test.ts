import { describe, expect, test } from "vitest";
import { analyzeAgentFile } from "./rules";
import type { RepoRef } from "../../engine/types";

const repo: RepoRef = {
  owner: "octo",
  repo: "app",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};

const ids = (path: string, content: string) =>
  analyzeAgentFile(repo, path, content).map((f) => f.id);

const mcp = (servers: Record<string, unknown>) =>
  JSON.stringify({ mcpServers: servers });

describe("auto-approved execution", () => {
  test("flags a bypassPermissions default", () => {
    const findings = analyzeAgentFile(
      repo,
      ".claude/settings.json",
      JSON.stringify({ permissions: { defaultMode: "bypassPermissions" } }),
    );
    expect(findings[0]!.id).toBe("agents/auto-approved-execution");
    expect(findings[0]!.severity).toBe("high");
  });

  test("flags --dangerously-skip-permissions in a workflow", () => {
    expect(
      ids(
        ".github/workflows/agent.yml",
        "    - run: claude -p 'do it' --dangerously-skip-permissions",
      ),
    ).toContain("agents/auto-approved-execution");
  });

  test("flags autoApprove in an MCP config", () => {
    expect(ids(".mcp.json", JSON.stringify({ autoApprove: ["*"] }))).toContain(
      "agents/auto-approved-execution",
    );
  });

  test("a normal settings file is clean", () => {
    expect(
      analyzeAgentFile(
        repo,
        ".claude/settings.json",
        JSON.stringify({ permissions: { allow: ["Read"] } }),
      ),
    ).toHaveLength(0);
  });
});

describe("MCP server structure", () => {
  test("flags an unpinned package runner", () => {
    expect(
      ids(".mcp.json", mcp({ fs: { command: "npx", args: ["-y", "srv"] } })),
    ).toContain("agents/unpinned-mcp-server");
  });

  test("does not flag a version-pinned runner", () => {
    expect(
      ids(
        ".mcp.json",
        mcp({ fs: { command: "npx", args: ["-y", "srv@1.2.3"] } }),
      ),
    ).not.toContain("agents/unpinned-mcp-server");
  });

  test("flags a remote MCP server but not localhost", () => {
    expect(
      ids(".mcp.json", mcp({ x: { url: "https://mcp.evil.example/sse" } })),
    ).toContain("agents/remote-mcp-server");
    expect(
      ids(".mcp.json", mcp({ x: { url: "http://localhost:3000/sse" } })),
    ).not.toContain("agents/remote-mcp-server");
  });

  test("flags a hardcoded secret in env and never leaks the value", () => {
    const secret = "sk-abcdef0123456789ABCDEF0123456789";
    const findings = analyzeAgentFile(
      repo,
      ".mcp.json",
      mcp({ ai: { command: "node", env: { OPENAI_API_KEY: secret } } }),
    );
    expect(findings[0]!.id).toBe("agents/hardcoded-mcp-secret");
    expect(JSON.stringify(findings)).not.toContain(secret);
  });

  test("an env reference is not a hardcoded secret", () => {
    expect(
      ids(
        ".mcp.json",
        mcp({
          ai: { command: "node", env: { OPENAI_API_KEY: "${OPENAI_API_KEY}" } },
        }),
      ),
    ).not.toContain("agents/hardcoded-mcp-secret");
  });

  test("unparseable JSON produces nothing rather than throwing", () => {
    expect(analyzeAgentFile(repo, ".mcp.json", "{ not json")).toEqual([]);
  });

  test("every finding ships a fix, a why, and an agent prompt", () => {
    const findings = analyzeAgentFile(
      repo,
      ".mcp.json",
      mcp({
        fs: { command: "npx", args: ["-y", "srv"] },
        r: { url: "https://mcp.evil.example/sse" },
      }),
    );
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((f) => f.fix && f.why && f.agentPrompt)).toBe(true);
  });
});
