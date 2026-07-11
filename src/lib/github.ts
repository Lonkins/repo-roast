import { Octokit } from "@octokit/rest";
import type { GitHubClient, RepoRef } from "./engine/types";

/**
 * Octokit adapter implementing the engine's GitHubClient interface.
 * Token is optional (public mode); when present it is only ever sent to
 * api.github.com by Octokit — never logged or forwarded elsewhere.
 */
export function createGitHubClient(token?: string): GitHubClient {
  const octokit = new Octokit({ auth: token, userAgent: "repo-roast" });

  function toRepoRef(d: {
    owner: { login: string };
    name: string;
    default_branch: string;
    private: boolean;
    fork: boolean;
    language: string | null;
    pushed_at: string | null;
  }): RepoRef {
    return {
      owner: d.owner.login,
      repo: d.name,
      defaultBranch: d.default_branch,
      isPrivate: d.private,
      isFork: d.fork,
      language: d.language ?? undefined,
      pushedAt: d.pushed_at ?? undefined,
    };
  }

  return {
    async getRepo(owner, repo) {
      const { data } = await octokit.repos.get({ owner, repo });
      return toRepoRef(data);
    },

    async listProfileRepos(owner, limit) {
      const { data } = await octokit.repos.listForUser({
        username: owner,
        sort: "pushed",
        per_page: 30,
      });
      return data
        .filter((r) => !r.fork && !r.archived)
        .slice(0, limit)
        .map((r) =>
          toRepoRef({
            owner: r.owner,
            name: r.name,
            default_branch: r.default_branch ?? "main",
            private: r.private,
            fork: r.fork,
            language: (r.language as string | null) ?? null,
            pushed_at: r.pushed_at ?? null,
          }),
        );
    },

    async getFile(repo, path, ref) {
      try {
        const { data } = await octokit.repos.getContent({
          owner: repo.owner,
          repo: repo.repo,
          path,
          ref,
        });
        if (Array.isArray(data) || data.type !== "file" || !("content" in data))
          return null;
        return {
          content: Buffer.from(data.content, "base64").toString("utf-8"),
          sha: data.sha,
        };
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },

    async getTree(repo) {
      const { data } = await octokit.git.getTree({
        owner: repo.owner,
        repo: repo.repo,
        tree_sha: repo.defaultBranch,
        recursive: "true",
      });
      return {
        paths: data.tree
          .filter((t) => t.type === "blob" && t.path)
          .map((t) => t.path as string),
        truncated: data.truncated,
      };
    },

    async listCommits(repo, limit) {
      const { data } = await octokit.repos.listCommits({
        owner: repo.owner,
        repo: repo.repo,
        per_page: Math.min(limit, 100),
      });
      return data.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
      }));
    },

    async getCommitPatches(repo, sha) {
      const { data } = await octokit.repos.getCommit({
        owner: repo.owner,
        repo: repo.repo,
        ref: sha,
      });
      return (data.files ?? [])
        .filter((f) => f.patch)
        .map((f) => ({ path: f.filename, patch: f.patch as string }));
    },
  };
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: number }).status === 404
  );
}
