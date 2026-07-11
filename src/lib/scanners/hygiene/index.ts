import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";

/** Filenames that should essentially never be in a public repo. */
const SUSPICIOUS_FILES: { pattern: RegExp; label: string }[] = [
  { pattern: /(^|\/)id_rsa$/, label: "an SSH private key (id_rsa)" },
  { pattern: /(^|\/)id_dsa$/, label: "an SSH private key (id_dsa)" },
  { pattern: /(^|\/)\.npmrc$/, label: "an .npmrc (often holds an auth token)" },
  { pattern: /(^|\/)\.pypirc$/, label: "a .pypirc (PyPI upload credentials)" },
  { pattern: /(^|\/)credentials\.json$/, label: "a credentials.json" },
  { pattern: /(^|\/)service-account.*\.json$/, label: "a service-account key" },
  { pattern: /(^|\/)\.htpasswd$/, label: "an .htpasswd file" },
  {
    pattern: /\.(pem|pfx|p12|keystore|jks)$/,
    label: "a key/certificate store",
  },
  { pattern: /(^|\/)backup\.sql$/, label: "a database dump (backup.sql)" },
  { pattern: /\.sql\.gz$/, label: "a compressed database dump" },
  { pattern: /(^|\/)dump\.rdb$/, label: "a Redis dump (dump.rdb)" },
];

/** Committed build/dependency artifacts that bloat the repo. */
const ARTIFACT_DIRS = [
  "node_modules/",
  "vendor/bundle/",
  ".venv/",
  "dist/",
  "build/",
  "__pycache__/",
];

export const hygieneScanner: Scanner = {
  id: "hygiene",
  async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const repoName = `${repo.owner}/${repo.repo}`;
    const { paths } = await ctx.github.getTree(repo);
    const has = (p: string) =>
      paths.some((x) => x === p || x.toLowerCase() === p.toLowerCase());

    // Suspicious filenames.
    for (const { pattern, label } of SUSPICIOUS_FILES) {
      const match = paths.find((p) => pattern.test(p));
      if (!match) continue;
      findings.push({
        id: "hygiene/suspicious-file",
        scanner: "hygiene",
        severity: "high",
        title: `Repository contains ${label} (${match})`,
        evidence: {
          repo: repoName,
          path: match,
          url: `https://github.com/${repoName}/blob/${repo.defaultBranch}/${match}`,
          detail: "Files like this usually shouldn't be tracked at all.",
        },
        fix: `Remove ${match} from the repo, add its pattern to .gitignore, purge it from history with git-filter-repo, and rotate anything it may have exposed.`,
      });
    }

    // Committed artifacts.
    const artifact = ARTIFACT_DIRS.find((dir) =>
      paths.some((p) => p.startsWith(dir) || p.includes(`/${dir}`)),
    );
    if (artifact) {
      findings.push({
        id: "hygiene/committed-artifacts",
        scanner: "hygiene",
        severity: "low",
        title: `Build/dependency artifacts are committed (${artifact.replace(/\/$/, "")})`,
        evidence: {
          repo: repoName,
          path: artifact,
          detail: "Generated files bloat the repo and cause noisy diffs.",
        },
        fix: `Add ${artifact.replace(/\/$/, "")} to .gitignore and remove it with \`git rm -r --cached ${artifact.replace(/\/$/, "")}\`.`,
      });
    }

    // Missing SECURITY.md — informational nudge, not an alarm.
    if (!has("SECURITY.md") && !has(".github/SECURITY.md")) {
      findings.push({
        id: "hygiene/missing-security-md",
        scanner: "hygiene",
        severity: "info",
        title: "No SECURITY.md — nowhere to report a vulnerability",
        evidence: {
          repo: repoName,
          detail:
            "Without a disclosure policy, finders either open a public issue or give up.",
        },
        fix: "Add a SECURITY.md describing how to privately report vulnerabilities (a contact and expected response time). GitHub links it automatically.",
      });
    }

    // Public repo with no LICENSE — legal ambiguity.
    if (
      !repo.isPrivate &&
      !has("LICENSE") &&
      !has("LICENSE.md") &&
      !has("COPYING")
    ) {
      findings.push({
        id: "hygiene/missing-license",
        scanner: "hygiene",
        severity: "info",
        title:
          "Public repo with no LICENSE — nobody legally knows what they can do with it",
        evidence: {
          repo: repoName,
          detail: "No license means default copyright: all rights reserved.",
        },
        fix: "Add a LICENSE file. If you want people to use the code, pick one at choosealicense.com (MIT and Apache-2.0 are common defaults).",
      });
    }

    return findings;
  },
};
