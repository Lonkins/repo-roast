import { burnScore, grade, sortFindings } from "./score";
import type {
  RepoRef,
  RepoReport,
  Scanner,
  ScanContext,
  ScanReport,
  ScannerId,
  ScanTarget,
} from "./types";

/** Profile scans cover the most recently pushed public repos, capped. */
export const PROFILE_REPO_LIMIT = 6;

async function scanRepo(
  repo: RepoRef,
  scanners: Scanner[],
  ctx: ScanContext,
): Promise<RepoReport> {
  const failedScanners: ScannerId[] = [];
  const results = await Promise.all(
    scanners.map(async (scanner) => {
      try {
        return await scanner.scan(repo, ctx);
      } catch {
        // Partial results beat no results; the report says what failed.
        failedScanners.push(scanner.id);
        return [];
      }
    }),
  );
  return { repo, findings: results.flat(), failedScanners };
}

export async function runScan(
  target: ScanTarget,
  scanners: Scanner[],
  ctx: ScanContext,
): Promise<ScanReport> {
  const repos =
    target.kind === "repo"
      ? [await ctx.github.getRepo(target.owner, target.repo)]
      : await ctx.github.listProfileRepos(target.owner, PROFILE_REPO_LIMIT);

  const repoReports = await Promise.all(
    repos.map((repo) => scanRepo(repo, scanners, ctx)),
  );

  const findings = sortFindings(repoReports.flatMap((r) => r.findings));
  const score = burnScore(findings);

  return {
    target,
    repos: repoReports,
    findings,
    burnScore: score,
    grade: grade(score),
    scannedAt: ctx.now().toISOString(),
    secretsStrategy: ctx.gitleaksAvailable ? "gitleaks" : "api-blob-walk",
  };
}
