import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";
import { analyzeAgentFile } from "./rules";

const MAX_FILES = 25;

/** Agent/MCP config files and the scripts that might launch an agent. */
const AGENT_FILE_RES: RegExp[] = [
  /(^|\/)\.?mcp\.json$/,
  /(^|\/)\.claude\/settings(\.local)?\.json$/,
  /(^|\/)\.cursor\/(mcp\.json|.*\.json)$/,
  /(^|\/)\.cursorrules$/,
  /(^|\/)\.windsurfrules$/,
  /(^|\/)\.continue\/config\.json$/,
  /(^|\/)\.aider\.conf\.(yml|yaml)$/,
  /(^|\/)\.vscode\/(settings|mcp)\.json$/,
  /(^|\/)(\.devcontainer\/)?devcontainer\.json$/,
];

/** Places a `--dangerously-skip-permissions`-style flag tends to hide. */
const FLAG_HOST_RES: RegExp[] = [
  /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/,
  /\.sh$/,
  /(^|\/)Makefile$/,
  /(^|\/)package\.json$/,
];

const IGNORE_RE = /(^|\/)(node_modules|dist|build|\.next|vendor)\//;

function selectFiles(paths: string[]): string[] {
  const matches = (p: string) =>
    AGENT_FILE_RES.some((re) => re.test(p)) ||
    FLAG_HOST_RES.some((re) => re.test(p));
  return paths
    .filter((p) => !IGNORE_RE.test(p) && matches(p))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_FILES);
}

/**
 * agents scanner — audits AI coding-agent and MCP configuration for the risks
 * that turn prompt injection into code execution: skipped approval gates,
 * unpinned or remote MCP servers, hardcoded secrets in agent config.
 */
export const agentsScanner: Scanner = {
  id: "agents",
  async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
    const { paths } = await ctx.github.getTree(repo);
    const targets = selectFiles(paths);
    const findings: Finding[] = [];
    for (const path of targets) {
      const file = await ctx.github.getFile(repo, path);
      if (!file) continue;
      findings.push(...analyzeAgentFile(repo, path, file.content));
    }
    return findings;
  },
};
