import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Finding, RepoRef, ScanContext } from "../../engine/types";
import { leakedCredentialFinding } from "./findings";

const execFileAsync = promisify(execFile);

const CLONE_TIMEOUT_MS = 60_000;
const SCAN_TIMEOUT_MS = 120_000;

interface GitleaksResult {
  RuleID: string;
  Description: string;
  File: string;
  StartLine: number;
  Commit: string;
}

/**
 * Self-host secrets strategy: bare-clone the repo and run the gitleaks binary
 * over the FULL commit history — the authoritative path.
 *
 * The auth token (private mode) is passed via git's env-based config so it
 * never appears in argv or error messages.
 */
export async function gitleaksSecrets(
  repo: RepoRef,
  ctx: ScanContext,
): Promise<Finding[]> {
  const repoName = `${repo.owner}/${repo.repo}`;
  const workDir = await mkdtemp(path.join(tmpdir(), "repo-roast-"));
  try {
    const cloneDir = path.join(workDir, "clone");
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
    if (ctx.token) {
      const basic = Buffer.from(`x-access-token:${ctx.token}`).toString(
        "base64",
      );
      env.GIT_CONFIG_COUNT = "1";
      env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
      env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basic}`;
    }
    await execFileAsync(
      "git",
      [
        "clone",
        "--bare",
        "--quiet",
        `https://github.com/${repoName}.git`,
        cloneDir,
      ],
      { env, timeout: CLONE_TIMEOUT_MS },
    );

    const reportPath = path.join(workDir, "report.json");
    try {
      await execFileAsync(
        "gitleaks",
        [
          "git",
          cloneDir,
          "--no-banner",
          "--exit-code",
          "1",
          "--report-format",
          "json",
          "--report-path",
          reportPath,
        ],
        { timeout: SCAN_TIMEOUT_MS },
      );
      return []; // exit 0 = no leaks
    } catch (err) {
      // exit code 1 = leaks found (expected); anything else is a real error
      if (!isExitCode(err, 1)) throw err;
    }

    const results = JSON.parse(
      await readFile(reportPath, "utf-8"),
    ) as GitleaksResult[];

    // Which leaked paths still exist at HEAD? Deleted files are the spicier find.
    const livePaths = new Set(
      (await ctx.github.getTree(repo).catch(() => ({ paths: [] as string[] })))
        .paths,
    );

    const seen = new Set<string>();
    const findings: Finding[] = [];
    for (const r of results) {
      const key = `${r.RuleID}:${r.File}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(
        leakedCredentialFinding(repo, {
          path: r.File,
          ref: r.Commit,
          line: r.StartLine,
          url: `https://github.com/${repoName}/commit/${r.Commit}`,
          detail: `gitleaks rule: ${r.RuleID}. Value redacted — check the commit.`,
          stillInTree: livePaths.has(r.File),
          description: r.Description,
        }),
      );
    }
    return findings;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function isExitCode(err: unknown, code: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}
