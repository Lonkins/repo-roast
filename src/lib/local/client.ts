import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import type { GitHubClient, RepoRef } from "../engine/types";

const run = promisify(execFile);

/** Directories never worth scanning locally. */
const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "vendor",
  "coverage",
  ".venv",
  "__pycache__",
]);

/** owner/repo from a github remote URL (ssh or https), or null. */
function parseGitHubRemote(
  url: string,
): { owner: string; repo: string } | null {
  const m =
    /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url.trim()) ?? undefined;
  return m ? { owner: m[1]!, repo: m[2]! } : null;
}

/**
 * A GitHubClient backed by a local checkout — the adapter that lets the same
 * engine that scans a GitHub repo scan the working tree instead (for the CLI /
 * pre-commit hook). Reads files from disk; enumerates via `git ls-files` so
 * .gitignore is respected, falling back to a filesystem walk outside a repo.
 * History-based scanning is left to the gitleaks pre-commit hook, so
 * listCommits/getCommitPatches return nothing.
 */
export class LocalClient implements GitHubClient {
  constructor(private readonly root: string) {}

  private git(args: string[]): Promise<string> {
    return run("git", args, { cwd: this.root }).then((r) => r.stdout);
  }

  async getRepo(): Promise<RepoRef> {
    const remote = await this.git(["remote", "get-url", "origin"]).catch(
      () => null,
    );
    const parsed = remote ? parseGitHubRemote(remote) : null;
    const branch = (
      await this.git(["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "")
    ).trim();
    return {
      owner: parsed?.owner ?? "local",
      repo: parsed?.repo ?? (basename(this.root) || "repo"),
      defaultBranch: branch || "HEAD",
      // Treat a local scan as private: don't nag about public-repo-only checks
      // (e.g. a missing LICENSE) on code that hasn't been published yet.
      isPrivate: true,
      isFork: false,
    };
  }

  async listProfileRepos(): Promise<RepoRef[]> {
    return [await this.getRepo()];
  }

  async getFile(
    _repo: RepoRef,
    path: string,
  ): Promise<{ content: string; sha: string } | null> {
    try {
      return {
        content: await readFile(join(this.root, path), "utf8"),
        sha: "",
      };
    } catch {
      return null;
    }
  }

  async getTree(): Promise<{ paths: string[]; truncated: boolean }> {
    const tracked = await this.git(["ls-files"]).catch(() => null);
    const paths =
      tracked !== null
        ? tracked
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : await this.walk(this.root);
    const ignore = await this.loadIgnore();
    const keep = (p: string) =>
      !ignore.some((pre) => p === pre || p.startsWith(`${pre}/`));
    return { paths: paths.filter(keep), truncated: false };
  }

  /**
   * `.reporoastignore` — gitignore-lite: one path prefix per line, `#` comments.
   * A file is skipped if it equals a line or sits under it. Lets a repo exclude
   * vendored code, generated files, or intentional test data from the scan.
   */
  private async loadIgnore(): Promise<string[]> {
    const raw = await readFile(
      join(this.root, ".reporoastignore"),
      "utf8",
    ).catch(() => "");
    return raw
      .split("\n")
      .map((l) => l.trim().replace(/\/+$/, ""))
      .filter((l) => l && !l.startsWith("#"));
  }

  private async walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        out.push(...(await this.walk(join(dir, entry.name))));
      } else if (entry.isFile()) {
        // POSIX-style relative path, matching what git ls-files would return.
        out.push(
          relative(this.root, join(dir, entry.name)).split(sep).join("/"),
        );
      }
    }
    return out;
  }

  // History scanning is the gitleaks pre-commit hook's job locally.
  async listCommits(): Promise<{ sha: string; message: string }[]> {
    return [];
  }

  async getCommitPatches(): Promise<{ path: string; patch: string }[]> {
    return [];
  }
}
