/**
 * Core domain model. Pure TypeScript — no Next.js, no I/O.
 * Scanners produce Findings; the comedy layer only phrases them.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type ScannerId =
  | "secrets"
  | "workflows"
  | "deps"
  | "hygiene"
  | "slopsquat"
  | "exposure"
  | "agents"
  | "claims";

/** Where a finding was observed. Everything factual, nothing invented. */
export interface Evidence {
  /** owner/name of the repo the finding is in */
  repo: string;
  /** file path within the repo, when applicable */
  path?: string;
  /** commit sha or ref pinpointing the evidence */
  ref?: string;
  line?: number;
  /**
   * Rule-specific factual detail shown to the user. For secrets this MUST be
   * redacted (rule name + location only — never the matched value).
   */
  detail?: string;
  /** direct link to the evidence on github.com when constructible */
  url?: string;
}

export interface Finding {
  /** stable rule id, e.g. "secrets/dotenv-in-history" */
  id: string;
  scanner: ScannerId;
  severity: Severity;
  /** short factual statement of the problem */
  title: string;
  evidence: Evidence;
  /** concrete, actionable remediation — every finding ships one */
  fix: string;
  /**
   * One plain-language sentence on why this bites you — a concrete failure
   * story, not a category label. The teaching half of the differentiator.
   */
  why?: string;
  /**
   * A copy-paste prompt for the user's own AI coding agent (Cursor, Claude
   * Code, Copilot) to apply the fix in their repo. Never contains secret
   * values. The remediation half of the differentiator (see ADR 0002).
   */
  agentPrompt?: string;
}

export type ScanTarget =
  | { kind: "repo"; owner: string; repo: string }
  | { kind: "profile"; owner: string };

/** A repo selected for scanning (profile targets expand to several). */
export interface RepoRef {
  owner: string;
  repo: string;
  defaultBranch: string;
  isPrivate: boolean;
  isFork: boolean;
  /** primary language as reported by GitHub, if any */
  language?: string;
  pushedAt?: string;
}

export interface Scanner {
  id: ScannerId;
  scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]>;
}

/** Minimal GitHub surface the engine needs — implemented by Octokit adapter. */
export interface GitHubClient {
  getRepo(owner: string, repo: string): Promise<RepoRef>;
  /** public, non-fork repos most recently pushed, capped */
  listProfileRepos(owner: string, limit: number): Promise<RepoRef[]>;
  /** decoded file content at ref (default branch when omitted), null if absent */
  getFile(
    repo: RepoRef,
    path: string,
    ref?: string,
  ): Promise<{ content: string; sha: string } | null>;
  /** paths in the repo tree at the default branch (truncated flag per API) */
  getTree(repo: RepoRef): Promise<{ paths: string[]; truncated: boolean }>;
  /** recent commits on the default branch, newest first */
  listCommits(
    repo: RepoRef,
    limit: number,
  ): Promise<{ sha: string; message: string }[]>;
  /** unified patch text for a commit (files + patches), null when unavailable */
  getCommitPatches(
    repo: RepoRef,
    sha: string,
  ): Promise<{ path: string; patch: string }[]>;
}

export interface ScanContext {
  github: GitHubClient;
  /** true when the gitleaks binary + git clone strategy is available (self-host) */
  gitleaksAvailable: boolean;
  /** auth token, present only in private mode; never logged, never forwarded */
  token?: string;
  /** clock injected for testability */
  now(): Date;
}

export interface RepoReport {
  repo: RepoRef;
  findings: Finding[];
  /** scanner ids that errored (partial results, reported honestly) */
  failedScanners: ScannerId[];
}

export interface ScanReport {
  target: ScanTarget;
  repos: RepoReport[];
  findings: Finding[];
  /** 0 (immaculate) to 100 (five-alarm fire) */
  burnScore: number;
  /** comedic grade label derived from burnScore */
  grade: string;
  scannedAt: string;
  /** which secrets strategy ran, for honest reporting */
  secretsStrategy: "gitleaks" | "api-blob-walk";
}
