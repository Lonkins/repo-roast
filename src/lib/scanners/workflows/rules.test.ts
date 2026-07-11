import { parse } from "yaml";
import { describe, expect, test } from "vitest";
import { analyzeWorkflow } from "./rules";
import type { RepoRef } from "../../engine/types";
import {
  CLEAN_WORKFLOW,
  DANGEROUS_PR_TARGET,
  SCRIPT_INJECTION_ONLY,
} from "../fixtures/workflows";

const repo: RepoRef = {
  owner: "octo",
  repo: "flows",
  defaultBranch: "main",
  isPrivate: false,
  isFork: false,
};

function analyze(content: string) {
  return analyzeWorkflow(
    repo,
    ".github/workflows/x.yml",
    content,
    parse(content),
  );
}

describe("analyzeWorkflow", () => {
  test("flags pull_request_target checking out PR head as critical", () => {
    const ids = analyze(DANGEROUS_PR_TARGET).map((f) => f.id);
    expect(ids).toContain("workflows/pull-request-target-checkout");
    const f = analyze(DANGEROUS_PR_TARGET).find(
      (x) => x.id === "workflows/pull-request-target-checkout",
    );
    expect(f?.severity).toBe("critical");
    expect(f?.fix).toMatch(/workflow_run|pull_request\b/);
  });

  test("flags write-all permissions", () => {
    expect(analyze(DANGEROUS_PR_TARGET).map((f) => f.id)).toContain(
      "workflows/broad-permissions",
    );
  });

  test("flags an unpinned third-party action", () => {
    const f = analyze(DANGEROUS_PR_TARGET).find(
      (x) => x.id === "workflows/unpinned-action",
    );
    expect(f).toBeDefined();
    expect(f?.title).toMatch(/some-vendor\/setup@main/);
  });

  test("flags script injection from an untrusted context", () => {
    expect(analyze(DANGEROUS_PR_TARGET).map((f) => f.id)).toContain(
      "workflows/script-injection",
    );
  });

  test("does not flag first-party actions/checkout@v4 as unpinned", () => {
    const ids = analyze(CLEAN_WORKFLOW).map((f) => f.id);
    expect(ids).not.toContain("workflows/unpinned-action");
  });

  test("does not flag a SHA-pinned third-party action", () => {
    const ids = analyze(CLEAN_WORKFLOW).map((f) => f.id);
    expect(ids).not.toContain("workflows/unpinned-action");
  });

  test("a clean workflow produces no findings", () => {
    expect(analyze(CLEAN_WORKFLOW)).toHaveLength(0);
  });

  test("script injection is found on a benign trigger too", () => {
    const findings = analyze(SCRIPT_INJECTION_ONLY);
    expect(findings.map((f) => f.id)).toEqual(["workflows/script-injection"]);
  });

  test("evidence carries a file path and a line link", () => {
    const f = analyze(DANGEROUS_PR_TARGET)[0];
    expect(f?.evidence.path).toBe(".github/workflows/x.yml");
    expect(f?.evidence.url).toMatch(/#L\d+$/);
  });
});
