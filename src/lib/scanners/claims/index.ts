import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";
import { analyzeClaims, type PackageInfo } from "./rules";

const README_RE = /^readme(\.(md|markdown|rst|txt))?$/i;

function parsePackage(content: string): PackageInfo | null {
  try {
    const doc = JSON.parse(content) as { scripts?: Record<string, unknown> };
    const scripts: Record<string, string> = {};
    for (const [k, v] of Object.entries(doc.scripts ?? {})) {
      if (typeof v === "string") scripts[k] = v;
    }
    return { scripts };
  } catch {
    return null;
  }
}

/**
 * claims scanner — compares what the README advertises against what the repo
 * actually ships: documented scripts that don't exist, CI badges for missing
 * workflows, hardcoded status badges. The README is the only file it needs to
 * read beyond package.json and the tree.
 */
export const claimsScanner: Scanner = {
  id: "claims",
  async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
    const { paths } = await ctx.github.getTree(repo);
    const readmePath = paths.find((p) => README_RE.test(p));
    if (!readmePath) return []; // no README, no claims to check

    const readmeFile = await ctx.github.getFile(repo, readmePath);
    if (!readmeFile) return [];

    const pkgPath = paths.find((p) => p === "package.json");
    const pkgFile = pkgPath ? await ctx.github.getFile(repo, pkgPath) : null;
    const pkg = pkgFile ? parsePackage(pkgFile.content) : null;

    const workflowFiles = new Set(
      paths
        .filter((p) => p.startsWith(".github/workflows/"))
        .map((p) => p.slice(".github/workflows/".length)),
    );

    return analyzeClaims(repo, {
      readmePath,
      readme: readmeFile.content,
      pkg,
      workflowFiles,
    });
  },
};
