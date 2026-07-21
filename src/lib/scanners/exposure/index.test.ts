import { describe, expect, test } from "vitest";
import { exposureScanner } from "./index";
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

describe("exposure scanner", () => {
  test("finds a client-exposed secret and a browser LLM key across files", async () => {
    const findings = await exposureScanner.scan(
      repo,
      ctxWith({
        ".env.local": "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJ.secret\n",
        "src/ai.ts": "new OpenAI({ dangerouslyAllowBrowser: true });",
        "README.md": "# nothing here",
      }),
    );
    const idsFound = findings.map((f) => f.id);
    expect(idsFound).toContain("exposure/secret-behind-public-prefix");
    expect(idsFound).toContain("exposure/llm-key-in-browser");
  });

  test("does not read vendored/build files", async () => {
    const findings = await exposureScanner.scan(
      repo,
      ctxWith({
        "node_modules/pkg/index.js": "dangerouslyAllowBrowser: true",
        "dist/bundle.js": "dangerouslyAllowBrowser: true",
      }),
    );
    expect(findings).toHaveLength(0);
  });

  test("a clean repo produces no findings", async () => {
    const findings = await exposureScanner.scan(
      repo,
      ctxWith({
        ".env":
          "DATABASE_URL=postgres://x\nNEXT_PUBLIC_SITE_URL=https://x.com\n",
        "src/index.ts": "export const x = 1;",
      }),
    );
    expect(findings).toHaveLength(0);
  });

  test("every finding carries a fix, a why, and an agent prompt", async () => {
    const findings = await exposureScanner.scan(
      repo,
      ctxWith({
        ".env": "NEXT_PUBLIC_API_SECRET=live\n",
        "src/server.ts": 'app.use(cors({ origin: "*", credentials: true }));',
      }),
    );
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((f) => f.fix && f.why && f.agentPrompt)).toBe(true);
  });
});
