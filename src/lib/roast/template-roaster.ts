import type { ScanReport } from "../engine/types";
import type { Roast, RoastLine, RoastProvider } from "./types";
import { burnFor, cleanRoast, introFor, outroFor } from "./templates";

/** Cap roast lines so a catastrophically bad repo stays readable and shareable. */
const MAX_LINES = 12;

/**
 * The default, always-available roaster. Deterministic, zero spend, zero
 * network. Generates burns ONLY from findings that already exist.
 */
export const templateRoaster: RoastProvider = {
  name: "template",
  async roast(report: ScanReport): Promise<Roast> {
    const seed = `${report.target.owner}:${report.burnScore}`;

    if (report.findings.length === 0) {
      return {
        intro: cleanRoast(seed),
        lines: [],
        outro: "Nothing to fix. Enjoy it — this is rare.",
        provider: this.name,
      };
    }

    const lines: RoastLine[] = report.findings.slice(0, MAX_LINES).map((f) => ({
      findingId: f.id,
      burn: burnFor(f),
      fix: f.fix,
      severity: f.severity,
    }));

    return {
      intro: introFor(report.burnScore, seed),
      lines,
      outro: outroFor(seed),
      provider: this.name,
    };
  },
};
