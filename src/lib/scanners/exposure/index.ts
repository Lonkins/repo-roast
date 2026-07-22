import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";
import { analyzeFile } from "./rules";
import { isTestOrFixturePath } from "../ignore";

/** Bound the file reads so a huge repo stays within API limits. */
const MAX_FILES = 30;

const ENV_RE = /(^|\/)\.env(\.[A-Za-z0-9_-]+)?$/;
const CONFIG_RE =
  /(^|\/)((next|vite|nuxt|svelte|astro|remix)\.config\.(js|ts|mjs|cjs)|vercel\.json|netlify\.toml|middleware\.(js|ts))$/;
const SOURCE_RE = /\.(js|ts|jsx|tsx|mjs|cjs)$/;
const IGNORE_RE = /(^|\/)(node_modules|dist|build|\.next|vendor|coverage)\//;
/** Source paths most likely to hold CORS/CSP/SDK config, read first. */
const HOTSPOT_RE =
  /(middleware|cors|csp|header|server|route|config|app|main|index|api|client)/i;

/** Deterministic, bounded selection: env + config first, then likely source. */
function selectFiles(paths: string[]): string[] {
  const rank = (p: string): number => {
    if (ENV_RE.test(p)) return 0;
    if (CONFIG_RE.test(p)) return 1;
    if (SOURCE_RE.test(p)) return HOTSPOT_RE.test(p) ? 2 : 3;
    return 99;
  };
  return paths
    .filter(
      (p) => !IGNORE_RE.test(p) && !isTestOrFixturePath(p) && rank(p) < 99,
    )
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .slice(0, MAX_FILES);
}

/**
 * exposure scanner — insecure defaults an AI code generator ships: server
 * secrets behind a public env prefix, an LLM SDK running in the browser,
 * wildcard CORS, `unsafe-eval` CSP. Reads a bounded, prioritized set of config
 * and source files; every verdict is a deterministic string-shape fact.
 */
export const exposureScanner: Scanner = {
  id: "exposure",
  async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
    const { paths } = await ctx.github.getTree(repo);
    const targets = selectFiles(paths);
    const findings: Finding[] = [];
    for (const path of targets) {
      const file = await ctx.github.getFile(repo, path);
      if (!file) continue;
      findings.push(...analyzeFile(repo, path, file.content));
    }
    return findings;
  },
};
