import type { Finding, ScanReport } from "../engine/types";

export interface RoastLine {
  findingId: string;
  /** the joke — punches at the finding, never the person */
  burn: string;
  /** the finding's real fix, carried through so comedy never buries it */
  fix: string;
  severity: Finding["severity"];
}

export interface Roast {
  /** opening line, keyed off the burn score */
  intro: string;
  lines: RoastLine[];
  /** closing line */
  outro: string;
  /** which provider generated it — shown for honesty */
  provider: string;
}

export interface RoastProvider {
  name: string;
  /**
   * Turn a scan report into a roast. Providers may only PHRASE the findings
   * that already exist — never add, remove, or invent them.
   */
  roast(report: ScanReport): Promise<Roast>;
}
