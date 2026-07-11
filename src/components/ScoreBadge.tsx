interface ScoreBadgeProps {
  score: number;
  grade: string;
}

/** The burn score as a chunky dial. Higher = hotter = redder. */
export function ScoreBadge({ score, grade }: ScoreBadgeProps) {
  // hue sweeps green (clean) -> red (fire) as the score climbs
  const hue = Math.round(150 - (score / 100) * 150);
  const ring = `oklch(70% 0.2 ${hue})`;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="grid size-36 place-items-center rounded-full border-[3px] border-[var(--color-ink)]"
        style={{
          background: `conic-gradient(${ring} ${score}%, var(--color-stage-raised) ${score}%)`,
        }}
      >
        <div className="grid size-28 place-items-center rounded-full bg-[var(--color-stage)]">
          <span
            className="text-4xl font-black tabular-nums"
            style={{ color: ring }}
          >
            {score}
          </span>
        </div>
      </div>
      <span
        className="text-sm font-bold tracking-wide uppercase"
        style={{ color: ring }}
      >
        {grade}
      </span>
      <span className="text-xs text-[var(--color-ink-dim)]">
        burn score / 100
      </span>
    </div>
  );
}
