import type { Severity } from "./engine/types";

interface SeverityStyle {
  label: string;
  /** CSS color token */
  color: string;
  emoji: string;
}

export const SEVERITY_STYLE: Record<Severity, SeverityStyle> = {
  critical: { label: "Critical", color: "var(--color-ember-hot)", emoji: "🔥" },
  high: { label: "High", color: "var(--color-ember)", emoji: "🌶️" },
  medium: { label: "Medium", color: "var(--color-warn)", emoji: "⚠️" },
  low: { label: "Low", color: "var(--color-ink-dim)", emoji: "🫧" },
  info: { label: "Info", color: "var(--color-mint)", emoji: "💡" },
};
