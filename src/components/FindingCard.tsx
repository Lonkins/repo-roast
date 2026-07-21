import type { RoastLine } from "@/lib/roast";
import { SEVERITY_STYLE } from "@/lib/severity";
import { CopyButton } from "./CopyButton";

interface FindingCardProps {
  line: RoastLine;
  /** the source finding, for evidence link + title */
  title: string;
  evidenceUrl?: string;
  evidencePath?: string;
  /** plain-language "why this bites you" (the teaching half) */
  why?: string;
  /** copy-paste prompt for the reader's own AI agent (the remediation half) */
  agentPrompt?: string;
}

/** A single roast line: the burn up top, the real fix below. Punch up, then help. */
export function FindingCard({
  line,
  title,
  evidenceUrl,
  evidencePath,
  why,
  agentPrompt,
}: FindingCardProps) {
  const style = SEVERITY_STYLE[line.severity];
  return (
    <article
      className="rounded-lg border-[3px] border-[var(--color-ink)] bg-[var(--color-stage-raised)] p-5 shadow-[6px_6px_0_0_oklch(0%_0_0/0.55)] transition-transform duration-150 hover:-translate-y-0.5"
      style={{ borderLeft: `8px solid ${style.color}` }}
    >
      <header className="mb-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold uppercase"
          style={{ color: style.color, border: `2px solid ${style.color}` }}
        >
          {style.emoji} {style.label}
        </span>
        {evidencePath && (
          <code className="truncate text-xs text-[var(--color-ink-dim)]">
            {evidencePath}
          </code>
        )}
      </header>

      <p className="text-lg leading-snug font-semibold">{line.burn}</p>

      {why && (
        <p className="mt-3 text-sm text-[var(--color-ink-dim)]">
          <span className="font-bold text-[var(--color-ember)]">
            Why it bites:{" "}
          </span>
          {why}
        </p>
      )}

      <div className="mt-3 rounded-md border-2 border-[var(--color-mint)]/40 bg-[var(--color-stage)] p-3">
        <p className="text-xs font-bold tracking-wide text-[var(--color-mint)] uppercase">
          The fix
        </p>
        <p className="mt-1 text-sm text-[var(--color-ink-dim)]">{line.fix}</p>
      </div>

      {agentPrompt && (
        <div className="mt-3 rounded-md border-2 border-dashed border-[var(--color-mint)]/40 bg-[var(--color-stage)] p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-wide text-[var(--color-mint)] uppercase">
              Fix it with your AI agent
            </p>
            <CopyButton text={agentPrompt} label="Copy prompt" />
          </div>
          <p className="font-mono text-xs leading-relaxed text-[var(--color-ink-dim)] select-all">
            {agentPrompt}
          </p>
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between text-xs text-[var(--color-ink-dim)]">
        <span title={title}>{title}</span>
        {evidenceUrl && (
          <a
            href={evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--color-ember)] underline underline-offset-2 hover:text-[var(--color-ember-hot)]"
          >
            evidence →
          </a>
        )}
      </footer>
    </article>
  );
}
