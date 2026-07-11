import type { Finding, Severity } from "./types";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 1,
};

/** 0 = immaculate, 100 = five-alarm fire. Monotonic in findings. */
export function burnScore(findings: Finding[]): number {
  const raw = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return Math.min(100, raw);
}

/** Grade bands double as the roast's opening temperature. */
const GRADES: [min: number, label: string][] = [
  [90, "Five-alarm fire"],
  [70, "Actively smoldering"],
  [45, "Smoke detected"],
  [20, "Singed around the edges"],
  [1, "Mild heat"],
  [0, "Suspiciously clean"],
];

export function grade(score: number): string {
  const band = GRADES.find(([min]) => score >= min);
  return band ? band[1] : "Suspiciously clean";
}

/** Sort order for display: hottest first, stable within severity. */
const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
