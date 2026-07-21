import type { Finding, RepoRef, ScanContext } from "../../engine/types";
import { matchSecrets } from "./rules";
import { committedDotenvFinding, leakedCredentialFinding } from "./findings";

/** Commits walked per repo — bounded to respect API rate limits. */
export const HISTORY_COMMIT_LIMIT = 30;

const DOTENV_RE = /(^|\/)\.env(\.[A-Za-z0-9._-]+)?$/;
const DOTENV_ALLOWED_RE = /\.(example|sample|template|dist)$/;

function isCommittedDotenv(path: string): boolean {
  return DOTENV_RE.test(path) && !DOTENV_ALLOWED_RE.test(path);
}

/**
 * Serverless secrets strategy: walk recent commit patches via the GitHub API
 * and apply the bundled rules to added lines. Weaker than gitleaks over a
 * full clone (bounded history window) but requires no binary and no disk.
 */
export async function blobWalkSecrets(
  repo: RepoRef,
  ctx: ScanContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const repoName = `${repo.owner}/${repo.repo}`;

  const { paths } = await ctx.github.getTree(repo);
  const livePaths = new Set(paths);

  // Committed .env in the current tree — the classic.
  for (const path of paths.filter(isCommittedDotenv)) {
    findings.push(committedDotenvFinding(repo, path));
  }

  // Walk recent history patches for secret-shaped additions.
  const commits = await ctx.github.listCommits(repo, HISTORY_COMMIT_LIMIT);
  const seen = new Set<string>(); // rule+path — dedupe across commits
  for (const commit of commits) {
    const patches = await ctx.github.getCommitPatches(repo, commit.sha);
    for (const { path, patch } of patches) {
      const added = patch
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .join("\n");
      for (const match of matchSecrets(added)) {
        const key = `${match.rule.id}:${path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push(
          leakedCredentialFinding(repo, {
            path,
            ref: commit.sha,
            url: `https://github.com/${repoName}/commit/${commit.sha}`,
            detail: `Rule: ${match.rule.id}. Value redacted — check the commit.`,
            stillInTree: livePaths.has(path),
            description: match.rule.description,
          }),
        );
      }
    }
  }

  return findings;
}
