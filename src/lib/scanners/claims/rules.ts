/**
 * claims — does the repo do what it says? AI-written READMEs promise commands
 * that were never wired up, badges that point at workflows that don't exist,
 * and green status that nothing measures. Every check compares a *claim in the
 * docs* against a *fact in the repo* — fully deterministic, no model judgment.
 */

import type { Finding, RepoRef } from "../../engine/types";

export interface PackageInfo {
  scripts: Record<string, string>;
}

export interface ClaimsInput {
  readmePath: string;
  readme: string;
  /** parsed root package.json, or null if absent/unparseable */
  pkg: PackageInfo | null;
  /** basenames present under .github/workflows (e.g. "ci.yml") */
  workflowFiles: Set<string>;
}

function repoName(repo: RepoRef): string {
  return `${repo.owner}/${repo.repo}`;
}

function lineOf(content: string, needle: string): number | undefined {
  const idx = content.split("\n").findIndex((l) => l.includes(needle));
  return idx === -1 ? undefined : idx + 1;
}

/* ---------------------------------------------------------------- *
 * Claim 1: a documented package script that isn't defined
 * ---------------------------------------------------------------- */

/** npm/pnpm/yarn/bun subcommands that are built in, not package scripts. */
const RUNNER_BUILTINS = new Set([
  "install",
  "i",
  "ci",
  "add",
  "remove",
  "rm",
  "update",
  "up",
  "upgrade",
  "publish",
  "pack",
  "init",
  "create",
  "dlx",
  "exec",
  "x",
  "link",
  "unlink",
  "audit",
  "outdated",
  "why",
  "dedupe",
  "config",
  "login",
  "logout",
  "whoami",
  "version",
  "run",
  "global",
  "set",
  "get",
  "store",
  "patch",
  "fetch",
  "import",
  "rebuild",
  "prune",
  "help",
  "list",
  "ls",
  "test",
  "start",
]);

const PLACEHOLDER_TEST = /no test specified/i;

/** Script names a README asks the reader to run. */
export function referencedScripts(readme: string): string[] {
  const names = new Set<string>();
  if (/\bnpm\s+test\b/.test(readme)) names.add("test");
  if (/\bnpm\s+start\b/.test(readme)) names.add("start");
  // Explicit `<runner> run <name>`.
  for (const m of readme.matchAll(
    /\b(?:npm|pnpm|yarn|bun)\s+run\s+([A-Za-z][\w:.-]*)/g,
  )) {
    names.add(m[1]!);
  }
  // Shorthand `pnpm|yarn|bun <name>` (npm has no shorthand). Drop builtins.
  for (const m of readme.matchAll(
    /\b(?:pnpm|yarn|bun)\s+([A-Za-z][\w:.-]*)/g,
  )) {
    const name = m[1]!;
    if (!RUNNER_BUILTINS.has(name)) names.add(name);
  }
  return [...names];
}

function undefinedScriptFindings(repo: RepoRef, input: ClaimsInput): Finding[] {
  const { readme, readmePath, pkg } = input;
  const scripts = pkg?.scripts ?? {};
  const findings: Finding[] = [];
  for (const name of referencedScripts(readme)) {
    const defined = scripts[name];
    const placeholder =
      name === "test" && defined && PLACEHOLDER_TEST.test(defined);
    if (defined && !placeholder) continue;
    const isTest = name === "test";
    findings.push({
      id: "claims/undefined-script",
      scanner: "claims",
      severity: isTest ? "high" : "medium",
      title: placeholder
        ? `README tells people to run tests, but the test script is the empty placeholder`
        : `README documents \`${name}\`, but no "${name}" script exists in package.json`,
      evidence: {
        repo: repoName(repo),
        path: readmePath,
        line: lineOf(readme, name),
        detail: placeholder
          ? `package.json's "test" script is still the \`npm init\` default ("no test specified"), so the documented test command does nothing.`
          : `The README references running "${name}", but package.json has no matching script — the command fails for anyone who copies it.`,
      },
      fix: placeholder
        ? `Replace the placeholder "test" script with a real one (e.g. \`vitest run\` or \`jest\`), or remove the promise of tests from the README.`
        : `Either add a "${name}" script to package.json, or fix the README to match what the project actually provides.`,
      why: isTest
        ? `"Run the tests" is the first thing a contributor or reviewer tries. When it fails immediately, they conclude the project is abandoned or broken — and there's no safety net catching regressions either.`
        : `A documented command that doesn't exist wastes the reader's time and signals the docs were never run. It's the fastest way to lose a first-time contributor.`,
      agentPrompt: placeholder
        ? `In this repo, package.json's "test" script is the empty "no test specified" placeholder but the README tells people to run the tests. Set up a real test runner appropriate to the stack, add a working "test" script, and add at least one smoke test so the command actually verifies something.`
        : `The README documents running "${name}" (via ${readmePath}) but package.json defines no "${name}" script. Decide which is right: if the command should work, add the "${name}" script to package.json; if not, correct the README. Make the docs and the scripts agree.`,
    });
  }
  return findings;
}

/* ---------------------------------------------------------------- *
 * Claim 2: a CI badge pointing at a workflow that isn't there
 * ---------------------------------------------------------------- */

function brokenBadgeFindings(repo: RepoRef, input: ClaimsInput): Finding[] {
  const { readme, readmePath, workflowFiles } = input;
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const m of readme.matchAll(
    /\/actions\/workflows\/([A-Za-z0-9._-]+\.ya?ml)\/badge\.svg/g,
  )) {
    const file = m[1]!;
    if (workflowFiles.has(file) || seen.has(file)) continue;
    seen.add(file);
    findings.push({
      id: "claims/broken-ci-badge",
      scanner: "claims",
      severity: "medium",
      title: `README shows a CI badge for a workflow that doesn't exist (${file})`,
      evidence: {
        repo: repoName(repo),
        path: readmePath,
        line: lineOf(readme, file),
        detail: `The badge points at .github/workflows/${file}, which isn't in the repo — the badge renders broken or misleadingly green.`,
      },
      fix: `Add the workflow at .github/workflows/${file}, or point the badge at a workflow that actually exists (or remove it).`,
      why: `A broken or fake CI badge tells visitors the project is tested and passing when nothing runs. It's a trust signal that's actively lying — worse than no badge at all.`,
      agentPrompt: `In ${readmePath}, a CI status badge references the workflow \`.github/workflows/${file}\`, which does not exist in the repo. Either create that workflow (a basic CI that installs, builds, and tests), or update the badge URL to match an existing workflow, or remove the badge. Ensure the badge reflects a real pipeline.`,
    });
  }
  return findings;
}

/* ---------------------------------------------------------------- *
 * Claim 3: a static badge asserting a status nothing measures
 * ---------------------------------------------------------------- */

function decorativeBadgeFindings(repo: RepoRef, input: ClaimsInput): Finding[] {
  const { readme, readmePath } = input;
  const re =
    /img\.shields\.io\/badge\/(coverage|build|tests?|ci)-(\d{1,3}%25|passing|pass|success|100|green)/gi;
  const m = re.exec(readme);
  if (!m) return [];
  return [
    {
      id: "claims/decorative-status-badge",
      scanner: "claims",
      severity: "low",
      title: `A "${m[1]}" badge is hardcoded, not wired to anything that measures it`,
      evidence: {
        repo: repoName(repo),
        path: readmePath,
        line: lineOf(readme, "img.shields.io/badge/"),
        detail: `This is a static shields.io badge — the "${m[1]}" status is a fixed label the author typed, not a live measurement, so it stays green even when reality isn't.`,
      },
      fix: `Wire the badge to a real source (a CI workflow badge, or Codecov/Coveralls for coverage), or drop it. A status badge should report, not decorate.`,
      why: `A hardcoded "coverage 100%" or "build passing" badge reads as a measured fact. It misleads visitors and future-you, and it never turns red when things actually break.`,
      agentPrompt: `In ${readmePath}, there's a static shields.io "${m[1]}" badge that displays a fixed status rather than a measured one. Replace it with a dynamic source — a GitHub Actions workflow-status badge for build/test state, or a Codecov/Coveralls badge for coverage — or remove it if that status isn't actually tracked.`,
    },
  ];
}

export function analyzeClaims(repo: RepoRef, input: ClaimsInput): Finding[] {
  return [
    ...undefinedScriptFindings(repo, input),
    ...brokenBadgeFindings(repo, input),
    ...decorativeBadgeFindings(repo, input),
  ];
}
