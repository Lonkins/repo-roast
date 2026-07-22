/**
 * Shared Finding builders for the secrets scanner, so the gitleaks and
 * blob-walk strategies produce identical output (same fix, why, and agent
 * prompt) instead of drifting apart. Secret VALUES are never included — only
 * the rule, path, and commit ref.
 */

import type { Finding, RepoRef } from "../../engine/types";

export function committedDotenvFinding(repo: RepoRef, path: string): Finding {
  const repoName = `${repo.owner}/${repo.repo}`;
  return {
    id: "secrets/committed-dotenv",
    scanner: "secrets",
    severity: "high",
    title: `.env file committed to the repository (${path})`,
    evidence: {
      repo: repoName,
      path,
      url: `https://github.com/${repoName}/blob/${repo.defaultBranch}/${path}`,
      detail: "Environment files typically hold credentials in plaintext.",
    },
    fix: `Remove ${path} from the repo, add it to .gitignore, commit a redacted ${path}.example instead, rotate every credential it contained, then purge it from history with git-filter-repo.`,
    why: "A committed .env usually holds live credentials in plaintext — readable by anyone with repo access, and preserved in git history even after you delete the file.",
    agentPrompt: `The file ${path} is a committed .env that likely contains credentials. Remove it from the repo, add it to .gitignore, and replace it with a redacted ${path}.example that documents the keys with placeholder values only. Give me the git-filter-repo (or BFG) commands to purge ${path} from all history, and remind me to rotate every credential it held. Do not print any values.`,
  };
}

export interface LeakedCredentialArgs {
  path: string;
  ref: string;
  url: string;
  line?: number;
  /** already-redacted detail string (rule id + "value redacted") */
  detail: string;
  /** the leaked value is still present at HEAD, vs. only in history */
  stillInTree: boolean;
  /** human description of the rule that matched */
  description: string;
}

export function leakedCredentialFinding(
  repo: RepoRef,
  args: LeakedCredentialArgs,
): Finding {
  const repoName = `${repo.owner}/${repo.repo}`;
  const { path, ref, url, line, detail, stillInTree, description } = args;
  const historyNote = stillInTree
    ? ""
    : " — deleting the file was not enough; git remembers";
  return {
    id: stillInTree
      ? "secrets/leaked-credential"
      : "secrets/leaked-credential-history",
    scanner: "secrets",
    severity: "critical",
    title: stillInTree
      ? `${description} committed in ${path}`
      : `${description} in commit history (${path} since deleted — the secret is still in history)`,
    evidence: { repo: repoName, path, ref, line, url, detail },
    fix: `Rotate this credential immediately (assume it is compromised), remove it from the code${historyNote} and purge it from history with git-filter-repo or BFG, then force-push and invalidate old clones.`,
    why: "A pushed credential is compromised the moment it lands — bots scrape public GitHub for exactly this within seconds. And it survives in git history for anyone who clones, so deleting the file later does not undo the exposure.",
    agentPrompt: `A secret (${description}) is present in ${path}${stillInTree ? "" : " and remains in git history after being deleted from the tree"}. Do not print the value. Help me: (1) rotate/revoke this credential now, treating it as compromised; (2) remove it from the code and load it from an untracked .env or a secret manager; (3) give me the exact git-filter-repo (or BFG) commands to purge it from all history for ${path}, then force-push. Note that collaborators must re-clone afterward.`,
  };
}
