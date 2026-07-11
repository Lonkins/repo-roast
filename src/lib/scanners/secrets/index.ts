import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";
import { blobWalkSecrets } from "./blobwalk";
import { gitleaksSecrets } from "./gitleaks";

/**
 * Secrets scanner. Strategy per ADR 0001:
 * - gitleaks binary over a full-history clone when available (self-host)
 * - GitHub API blob walk with bundled rules otherwise (serverless)
 * The committed-.env check runs in both paths (blobwalk includes it; the
 * gitleaks path adds it explicitly since gitleaks only flags value matches).
 */
export const secretsScanner: Scanner = {
  id: "secrets",
  async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.gitleaksAvailable) return blobWalkSecrets(repo, ctx);

    const [fromGitleaks, fromBlobwalk] = await Promise.all([
      gitleaksSecrets(repo, ctx),
      blobWalkSecrets(repo, ctx),
    ]);
    // gitleaks wins on value matches; blobwalk contributes the dotenv check
    // and anything gitleaks missed. Dedupe on id+path.
    const seen = new Set(fromGitleaks.map((f) => `${f.id}:${f.evidence.path}`));
    return [
      ...fromGitleaks,
      ...fromBlobwalk.filter((f) => !seen.has(`${f.id}:${f.evidence.path}`)),
    ];
  },
};
