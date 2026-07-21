import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";
import { dedupePackages, PARSERS, type Package } from "./parse";
import { createOsvClient, type OsvClient, type OsvResult } from "./osv";

/** Cap packages queried per repo to stay well within free rate limits. */
const MAX_PACKAGES = 300;

async function collectPackages(
  repo: RepoRef,
  ctx: ScanContext,
): Promise<Package[]> {
  const { paths } = await ctx.github.getTree(repo);
  const manifests = paths.filter((p) =>
    PARSERS.some((parser) => parser.match(p)),
  );

  const packages: Package[] = [];
  for (const path of manifests) {
    const parser = PARSERS.find((p) => p.match(path));
    if (!parser) continue;
    const file = await ctx.github.getFile(repo, path);
    if (!file) continue;
    packages.push(...parser.parse(file.content, path));
  }
  return dedupePackages(packages).slice(0, MAX_PACKAGES);
}

function toFinding(repo: RepoRef, result: OsvResult): Finding {
  const repoName = `${repo.owner}/${repo.repo}`;
  const { pkg, vulns } = result;
  const primary = vulns[0];
  const alias = primary?.aliases?.find((a) => a.startsWith("CVE-"));
  const idLabel = alias ?? primary?.id ?? "an advisory";
  const extra = vulns.length > 1 ? ` (+${vulns.length - 1} more)` : "";
  return {
    id: "deps/known-vulnerability",
    scanner: "deps",
    severity: "high",
    title: `${pkg.name}@${pkg.version} has a known vulnerability: ${idLabel}${extra}`,
    evidence: {
      repo: repoName,
      path: pkg.source,
      url: primary ? `https://osv.dev/vulnerability/${primary.id}` : undefined,
      detail:
        primary?.summary ??
        `${pkg.ecosystem} package ${pkg.name}@${pkg.version} is affected by ${idLabel}.`,
    },
    fix: `Upgrade ${pkg.name} to a patched version (check the advisory for the fixed range), then regenerate the lockfile. Automate this with Dependabot or Renovate so it doesn't rot again.`,
    why: `A published advisory means the exact flaw and often a working exploit are public. Anyone can look up ${idLabel}, see you ship the vulnerable version, and use it against your app.`,
    agentPrompt: `The dependency ${pkg.name}@${pkg.version} (in ${pkg.source}) is affected by ${idLabel}. Upgrade it to the nearest version that patches the advisory, update the lockfile, and run the tests to confirm nothing broke. Then add Dependabot or Renovate config so this doesn't rot again.`,
  };
}

/** Factory so tests can inject a fake OSV client. */
export function createDepsScanner(osv: OsvClient): Scanner {
  return {
    id: "deps",
    async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
      const packages = await collectPackages(repo, ctx);
      if (packages.length === 0) return [];
      const results = await osv.query(packages);
      return results
        .filter((r) => r.vulns.length > 0)
        .map((r) => toFinding(repo, r));
    },
  };
}

export const depsScanner: Scanner = createDepsScanner(createOsvClient());
