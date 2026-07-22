import { pathToFileURL } from "node:url";
import { runScan } from "../lib/engine/orchestrator";
import type {
  Finding,
  ScanContext,
  ScanReport,
  Scanner,
  Severity,
} from "../lib/engine/types";
import { allScanners } from "../lib/scanners";
import { LocalClient } from "../lib/local/client";

/** Most to least severe; lower index = more severe. */
const SEVERITY_RANK: Severity[] = ["critical", "high", "medium", "low", "info"];

/** Scanners that reach the network (registries / OSV) — skipped with --no-network. */
const NETWORK_SCANNERS = new Set(["slopsquat", "deps"]);

export interface CliOptions {
  cwd: string;
  failOn: Severity;
  noNetwork: boolean;
  format: "pretty" | "json";
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    cwd: process.cwd(),
    failOn: "high",
    noNetwork: false,
    format: "pretty",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--no-network") opts.noNetwork = true;
    else if (arg === "--fail-on") opts.failOn = argv[++i] as Severity;
    else if (arg === "--format")
      opts.format = argv[++i] as CliOptions["format"];
    else if (!arg.startsWith("-")) opts.cwd = arg;
  }
  // Reject a bad/missing --fail-on rather than gate on an unknown threshold —
  // a security gate must fail closed, not silently pass everything.
  if (!SEVERITY_RANK.includes(opts.failOn)) {
    throw new Error(
      `invalid --fail-on "${opts.failOn}" (expected one of: ${SEVERITY_RANK.join(", ")})`,
    );
  }
  if (opts.format !== "pretty" && opts.format !== "json") {
    throw new Error(
      `invalid --format "${opts.format}" (expected: pretty, json)`,
    );
  }
  return opts;
}

/** Exit 1 if any finding is at least as severe as the threshold, else 0. */
export function exitCodeFor(findings: Finding[], failOn: Severity): number {
  const threshold = SEVERITY_RANK.indexOf(failOn);
  // Defense in depth: an unrecognized threshold fails closed (any finding trips)
  // rather than fails open (index -1 would make `<= -1` never true).
  if (threshold === -1) return findings.length > 0 ? 1 : 0;
  const tripped = findings.some(
    (f) => SEVERITY_RANK.indexOf(f.severity) <= threshold,
  );
  return tripped ? 1 : 0;
}

export function renderPretty(report: ScanReport): string {
  const lines: string[] = [];
  const target = report.repos[0]?.repo;
  const name = target ? `${target.owner}/${target.repo}` : "this repo";
  lines.push(
    `repo-roast · ${name} · score ${report.burnScore} (${report.grade})`,
  );
  if (report.findings.length === 0) {
    lines.push("No findings. Suspiciously clean. ✨");
    return lines.join("\n");
  }
  lines.push(`${report.findings.length} finding(s):\n`);
  for (const f of report.findings) {
    const loc = f.evidence.path ? ` · ${f.evidence.path}` : "";
    lines.push(`[${f.severity.toUpperCase()}] ${f.id}${loc}`);
    lines.push(`  ${f.title}`);
    if (f.why) lines.push(`  why: ${f.why}`);
    lines.push(`  fix: ${f.fix}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function runLocalScan(
  opts: CliOptions,
  out: (s: string) => void,
): Promise<number> {
  const client = new LocalClient(opts.cwd);
  const repo = await client.getRepo();
  const ctx: ScanContext = {
    github: client,
    gitleaksAvailable: false,
    now: () => new Date(),
  };
  const scanners: Scanner[] = opts.noNetwork
    ? allScanners.filter((s) => !NETWORK_SCANNERS.has(s.id))
    : allScanners;

  const report = await runScan(
    { kind: "repo", owner: repo.owner, repo: repo.repo },
    scanners,
    ctx,
  );

  out(
    opts.format === "json"
      ? JSON.stringify(report, null, 2)
      : renderPretty(report),
  );
  return exitCodeFor(report.findings, opts.failOn);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const code = await runLocalScan(opts, (s) => process.stdout.write(`${s}\n`));
  process.exit(code);
}

// Run only when invoked directly (not when imported by tests).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    process.stderr.write(`repo-roast: ${String(err)}\n`);
    process.exit(2);
  });
}
