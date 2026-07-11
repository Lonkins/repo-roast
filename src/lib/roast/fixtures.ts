import type { Finding, ScanReport } from "../engine/types";
import { burnScore, grade, sortFindings } from "../engine/score";

function finding(
  over: Partial<Finding> & Pick<Finding, "id" | "severity">,
): Finding {
  return {
    scanner: "hygiene",
    title: over.title ?? "A problem",
    evidence: over.evidence ?? { repo: "octo/app" },
    fix: over.fix ?? "Fix it.",
    ...over,
  };
}

/** Build a report from findings, computing score/grade like the orchestrator. */
export function reportFrom(findings: Finding[], owner = "octo"): ScanReport {
  const sorted = sortFindings(findings);
  const score = burnScore(sorted);
  return {
    target: { kind: "profile", owner },
    repos: [],
    findings: sorted,
    burnScore: score,
    grade: grade(score),
    scannedAt: "2026-07-11T00:00:00Z",
    secretsStrategy: "api-blob-walk",
  };
}

export const MESSY_REPORT = reportFrom([
  finding({
    id: "secrets/committed-dotenv",
    scanner: "secrets",
    severity: "high",
    title: ".env committed",
    evidence: { repo: "octo/app", path: ".env" },
    fix: "Remove and rotate.",
  }),
  finding({
    id: "workflows/pull-request-target-checkout",
    scanner: "workflows",
    severity: "critical",
    title: "pull_request_target checkout",
    evidence: { repo: "octo/app", path: ".github/workflows/ci.yml" },
    fix: "Split into two workflows.",
  }),
  finding({
    id: "deps/known-vulnerability",
    scanner: "deps",
    severity: "high",
    title: "vulnerable dep",
    evidence: { repo: "octo/app", path: "package-lock.json" },
    fix: "Upgrade the package.",
  }),
]);

export const CLEAN_REPORT = reportFrom([]);
