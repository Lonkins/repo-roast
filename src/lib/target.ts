import type { ScanTarget } from "./engine/types";

/** GitHub owner/repo name character rules (conservative superset). */
const NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;

export type ParseResult =
  { ok: true; target: ScanTarget } | { ok: false; error: string };

/**
 * Parse user input into a scan target. Accepts:
 *   octocat
 *   octocat/hello-world
 *   https://github.com/octocat
 *   https://github.com/octocat/hello-world(.git|/tree/...)
 * Validated at this trust boundary — never trust the raw string downstream.
 */
export function parseTarget(raw: string): ParseResult {
  let input = raw.trim();
  if (!input)
    return { ok: false, error: "Enter a GitHub username or owner/repo." };

  // Strip a github URL down to its path.
  const urlMatch = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i.exec(input);
  if (urlMatch) input = urlMatch[1]!;

  // Drop trailing .git, query/hash, and any path beyond owner/repo.
  input = input.replace(/\.git$/i, "").replace(/[?#].*$/, "");
  const segments = input.split("/").filter(Boolean);

  if (segments.length === 1) {
    const owner = segments[0]!;
    if (!NAME_RE.test(owner))
      return { ok: false, error: `"${owner}" is not a valid GitHub username.` };
    return { ok: true, target: { kind: "profile", owner } };
  }

  if (segments.length >= 2) {
    const [owner, repo] = segments;
    if (!NAME_RE.test(owner!) || !NAME_RE.test(repo!))
      return {
        ok: false,
        error: `"${owner}/${repo}" is not a valid owner/repo.`,
      };
    return { ok: true, target: { kind: "repo", owner: owner!, repo: repo! } };
  }

  return { ok: false, error: "Enter a GitHub username or owner/repo." };
}

/** Canonical URL slug for a target, used for shareable result links. */
export function targetToSlug(target: ScanTarget): string {
  return target.kind === "repo"
    ? `${target.owner}/${target.repo}`
    : target.owner;
}

/** Human label for a target. */
export function targetLabel(target: ScanTarget): string {
  return targetToSlug(target);
}
