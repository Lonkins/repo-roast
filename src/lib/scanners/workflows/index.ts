import { parse } from "yaml";
import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";
import { analyzeWorkflow } from "./rules";

const WORKFLOW_DIR = ".github/workflows";
const WORKFLOW_RE = /\.ya?ml$/;

/**
 * GitHub Actions workflow scanner. Parses every workflow in
 * .github/workflows and applies the dangerous-pattern rule set.
 */
export const workflowsScanner: Scanner = {
  id: "workflows",
  async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
    const { paths } = await ctx.github.getTree(repo);
    const workflowPaths = paths.filter(
      (p) => p.startsWith(`${WORKFLOW_DIR}/`) && WORKFLOW_RE.test(p),
    );

    const findings: Finding[] = [];
    for (const path of workflowPaths) {
      const file = await ctx.github.getFile(repo, path);
      if (!file) continue;
      let doc: unknown;
      try {
        doc = parse(file.content);
      } catch {
        continue; // unparseable workflow — not our finding to make
      }
      findings.push(...analyzeWorkflow(repo, path, file.content, doc));
    }
    return findings;
  },
};
