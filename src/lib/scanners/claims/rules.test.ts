import { describe, expect, test } from "vitest";
import { analyzeClaims, referencedScripts, type ClaimsInput } from "./rules";
import type { RepoRef } from "../../engine/types";

const repo: RepoRef = {
  owner: "octo",
  repo: "app",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};

function input(over: Partial<ClaimsInput>): ClaimsInput {
  return {
    readmePath: "README.md",
    readme: "",
    pkg: { scripts: {} },
    workflowFiles: new Set(),
    ...over,
  };
}

const ids = (over: Partial<ClaimsInput>) =>
  analyzeClaims(repo, input(over)).map((f) => f.id);

describe("referencedScripts", () => {
  test("collects test/start/run and shorthand invocations", () => {
    const names = referencedScripts(
      "Run `npm test`, then `npm run build`, or `pnpm dev`. Install with `pnpm install`.",
    );
    expect(names.sort()).toEqual(["build", "dev", "test"]);
  });

  test("ignores runner builtins used as shorthand", () => {
    expect(referencedScripts("`yarn add react` and `pnpm dlx foo`")).toEqual(
      [],
    );
  });
});

describe("undefined-script", () => {
  test("flags a documented script missing from package.json as medium", () => {
    const findings = analyzeClaims(
      repo,
      input({
        readme: "Build it: `npm run build`.",
        pkg: { scripts: { dev: "vite" } },
      }),
    );
    expect(findings[0]!.id).toBe("claims/undefined-script");
    expect(findings[0]!.severity).toBe("medium");
  });

  test("flags a missing test script as high", () => {
    const findings = analyzeClaims(
      repo,
      input({ readme: "Run `npm test`.", pkg: { scripts: {} } }),
    );
    expect(findings[0]!.severity).toBe("high");
  });

  test("flags the npm-init placeholder test script", () => {
    expect(
      ids({
        readme: "Run `npm test`.",
        pkg: { scripts: { test: 'echo "Error: no test specified" && exit 1' } },
      }),
    ).toContain("claims/undefined-script");
  });

  test("does not flag when the script really exists", () => {
    expect(
      ids({
        readme: "Run `npm test` and `npm run build`.",
        pkg: { scripts: { test: "vitest run", build: "tsc" } },
      }),
    ).not.toContain("claims/undefined-script");
  });
});

describe("broken-ci-badge", () => {
  test("flags a badge pointing at a missing workflow", () => {
    expect(
      ids({
        readme:
          "![CI](https://github.com/octo/app/actions/workflows/ci.yml/badge.svg)",
        workflowFiles: new Set(["release.yml"]),
      }),
    ).toContain("claims/broken-ci-badge");
  });

  test("does not flag when the workflow exists", () => {
    expect(
      ids({
        readme:
          "![CI](https://github.com/octo/app/actions/workflows/ci.yml/badge.svg)",
        workflowFiles: new Set(["ci.yml"]),
      }),
    ).not.toContain("claims/broken-ci-badge");
  });
});

describe("decorative-status-badge", () => {
  test("flags a hardcoded coverage badge", () => {
    expect(
      ids({
        readme:
          "![cov](https://img.shields.io/badge/coverage-100%25-brightgreen)",
      }),
    ).toContain("claims/decorative-status-badge");
  });

  test("does not flag a non-status static badge", () => {
    expect(
      ids({
        readme: "![spend](https://img.shields.io/badge/cost-%240-brightgreen)",
      }),
    ).not.toContain("claims/decorative-status-badge");
  });
});

test("every finding ships a fix, a why, and an agent prompt", () => {
  const findings = analyzeClaims(
    repo,
    input({
      readme:
        "Run `npm test`. ![CI](https://github.com/octo/app/actions/workflows/ci.yml/badge.svg) ![c](https://img.shields.io/badge/build-passing-green)",
      pkg: { scripts: {} },
      workflowFiles: new Set(),
    }),
  );
  expect(findings.length).toBeGreaterThanOrEqual(3);
  expect(findings.every((f) => f.fix && f.why && f.agentPrompt)).toBe(true);
});
