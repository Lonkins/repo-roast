import { runScan } from "./engine/orchestrator";
import type { GitHubClient, ScanReport, ScanTarget } from "./engine/types";
import { createGitHubClient } from "./github";
import { allScanners } from "./scanners";
import { getRoaster, type Roast } from "./roast";

export interface ScanOptions {
  /** OAuth/personal token — present only in private mode, scoped to the caller. */
  token?: string;
  /** override env (tests) */
  env?: Record<string, string | undefined>;
  /** inject a GitHub client (tests); defaults to the Octokit adapter */
  github?: GitHubClient;
}

export type ScanError =
  | { kind: "not-found"; message: string }
  | { kind: "rate-limited"; message: string; retryAfterSec?: number }
  | { kind: "unknown"; message: string };

export type ScanOutcome =
  | { ok: true; report: ScanReport; roast: Roast }
  | { ok: false; error: ScanError };

/** True when the gitleaks binary + git clone path should be used (self-host). */
function gitleaksAvailable(env: Record<string, string | undefined>): boolean {
  return env.GITLEAKS_BINARY === "1" || env.GITLEAKS_BINARY === "true";
}

/**
 * The one entry point the UI and API share: run all deterministic scanners
 * over a target and roast the result. Translates GitHub failures into typed,
 * user-facing errors — no raw stack traces, no leaked tokens.
 */
export async function scanAndRoast(
  target: ScanTarget,
  opts: ScanOptions = {},
): Promise<ScanOutcome> {
  const env = opts.env ?? process.env;
  const github =
    opts.github ?? createGitHubClient(opts.token ?? env.GITHUB_TOKEN);

  try {
    const report = await runScan(target, allScanners, {
      github,
      gitleaksAvailable: gitleaksAvailable(env),
      token: opts.token,
      now: () => new Date(),
    });
    const roast = await getRoaster(env).roast(report);
    return { ok: true, report, roast };
  } catch (err) {
    return { ok: false, error: classifyError(err) };
  }
}

function classifyError(err: unknown): ScanError {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status: unknown }).status
      : undefined;

  if (status === 404) {
    return {
      kind: "not-found",
      message: "That user or repo doesn't exist, or is private.",
    };
  }
  if (status === 403 || status === 429) {
    return {
      kind: "rate-limited",
      message:
        "GitHub's API rate limit was hit. Try again shortly, or self-host with your own token for higher limits.",
    };
  }
  return {
    kind: "unknown",
    message: "Something went wrong running the scan. Try again in a moment.",
  };
}
