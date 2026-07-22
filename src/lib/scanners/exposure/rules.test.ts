import { describe, expect, test } from "vitest";
import { analyzeFile, fileKind, isSecretPublicVar } from "./rules";
import type { RepoRef } from "../../engine/types";

const repo: RepoRef = {
  owner: "octo",
  repo: "app",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};

const ids = (path: string, content: string) =>
  analyzeFile(repo, path, content).map((f) => f.id);

describe("isSecretPublicVar", () => {
  test("flags a server secret behind a public prefix", () => {
    expect(isSecretPublicVar("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")).toBe(
      true,
    );
    expect(isSecretPublicVar("VITE_STRIPE_SECRET_KEY")).toBe(true);
    expect(isSecretPublicVar("PUBLIC_DB_PASSWORD")).toBe(true);
  });

  test("does not flag genuinely public values or unprefixed secrets", () => {
    // Ambiguous words that are often legitimately public.
    expect(isSecretPublicVar("NEXT_PUBLIC_SUPABASE_ANON_KEY")).toBe(false);
    expect(isSecretPublicVar("NEXT_PUBLIC_API_KEY")).toBe(false);
    expect(isSecretPublicVar("NEXT_PUBLIC_SITE_URL")).toBe(false);
    // A secret with no public prefix is server-side and fine.
    expect(isSecretPublicVar("SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
  });
});

describe("fileKind", () => {
  test("classifies env files, examples, and code", () => {
    expect(fileKind(".env")).toBe("env-committed");
    expect(fileKind("apps/web/.env.local")).toBe("env-committed");
    expect(fileKind(".env.example")).toBe("env-example");
    expect(fileKind("src/app/page.tsx")).toBe("code");
  });
});

describe("analyzeFile — secret behind public prefix", () => {
  test("a committed env file is critical and never leaks the value", () => {
    const content =
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGci.superSecretValue123\n";
    const findings = analyzeFile(repo, ".env.local", content);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.id).toBe("exposure/secret-behind-public-prefix");
    expect(findings[0]!.severity).toBe("critical");
    // Value redaction: the secret must not appear anywhere in the finding.
    expect(JSON.stringify(findings[0])).not.toContain("superSecretValue123");
  });

  test("an example env file is high, not critical", () => {
    const findings = analyzeFile(
      repo,
      ".env.example",
      "VITE_STRIPE_SECRET_KEY=your-key-here\n",
    );
    expect(findings[0]!.severity).toBe("high");
  });

  test("detects the reference in source code", () => {
    expect(
      ids(
        "src/lib/db.ts",
        "const k = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;",
      ),
    ).toContain("exposure/secret-behind-public-prefix");
  });

  test("clean env vars produce nothing", () => {
    expect(
      analyzeFile(
        repo,
        ".env",
        "NEXT_PUBLIC_SITE_URL=https://x.com\nDATABASE_URL=postgres://…\n",
      ),
    ).toHaveLength(0);
  });
});

describe("analyzeFile — code smells", () => {
  test("flags an LLM SDK running in the browser as critical", () => {
    const findings = analyzeFile(
      repo,
      "src/ai.ts",
      "new OpenAI({ apiKey: k, dangerouslyAllowBrowser: true });",
    );
    expect(findings[0]!.id).toBe("exposure/llm-key-in-browser");
    expect(findings[0]!.severity).toBe("critical");
  });

  test("flags wildcard CORS as medium, and high with credentials", () => {
    const plain = analyzeFile(
      repo,
      "src/api/route.ts",
      'res.setHeader("Access-Control-Allow-Origin", "*");',
    );
    expect(plain[0]!.id).toBe("exposure/permissive-cors");
    expect(plain[0]!.severity).toBe("medium");

    const withCreds = analyzeFile(
      repo,
      "src/server.ts",
      'app.use(cors({ origin: "*", credentials: true }));',
    );
    expect(withCreds[0]!.severity).toBe("high");
  });

  test("flags an unsafe-eval CSP", () => {
    expect(
      ids("next.config.js", "const csp = \"script-src 'self' 'unsafe-eval'\";"),
    ).toContain("exposure/unsafe-eval-csp");
  });

  test("code smells are not searched inside env files", () => {
    // The string appears, but an env file is not code — no code-smell finding.
    expect(analyzeFile(repo, ".env", "X=dangerouslyAllowBrowser:true")).toEqual(
      [],
    );
  });

  test("every finding ships a fix, a why, and an agent prompt", () => {
    const findings = analyzeFile(
      repo,
      "src/api/route.ts",
      'setHeader("Access-Control-Allow-Origin","*"); const x = process.env.NEXT_PUBLIC_APP_SECRET;',
    );
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((f) => f.fix && f.why && f.agentPrompt)).toBe(true);
  });
});
