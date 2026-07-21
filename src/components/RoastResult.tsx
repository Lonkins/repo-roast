import Link from "next/link";
import type { ScanReport } from "@/lib/engine/types";
import type { Roast } from "@/lib/roast";
import { ScoreBadge } from "./ScoreBadge";
import { FindingCard } from "./FindingCard";
import { ShareBar } from "./ShareBar";
import { BadgeSnippet } from "./BadgeSnippet";

interface RoastResultProps {
  report: ScanReport;
  roast: Roast;
  slug: string;
}

/**
 * The full roast card. Roast lines are index-aligned with report.findings
 * (the roaster preserves order), so we zip them to attach evidence.
 */
export function RoastResult({ report, roast, slug }: RoastResultProps) {
  const failed = report.repos.flatMap((r) => r.failedScanners);
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-sm font-bold tracking-widest text-[var(--color-ember)] uppercase">
            Roast of
          </p>
          <h1 className="text-3xl font-black break-all sm:text-4xl">{slug}</h1>
          <p className="mt-3 text-lg text-[var(--color-ink-dim)]">
            {roast.intro}
          </p>
        </div>
        <ScoreBadge score={report.burnScore} grade={report.grade} />
      </header>

      <ShareBar score={report.burnScore} grade={report.grade} />

      {roast.lines.length === 0 ? (
        <div className="rounded-lg border-[3px] border-[var(--color-mint)] bg-[var(--color-stage-raised)] p-8 text-center">
          <p className="text-2xl">🧼</p>
          <p className="mt-2 text-lg font-semibold">Nothing to roast.</p>
          <p className="mt-1 text-[var(--color-ink-dim)]">{roast.outro}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {roast.lines.map((line, i) => {
            const finding = report.findings[i];
            return (
              <FindingCard
                key={`${line.findingId}-${i}`}
                line={line}
                title={finding?.title ?? line.findingId}
                evidenceUrl={finding?.evidence.url}
                evidencePath={finding?.evidence.path}
                why={finding?.why}
                agentPrompt={finding?.agentPrompt}
              />
            );
          })}
        </div>
      )}

      <BadgeSnippet slug={slug} />

      <div className="flex flex-col items-center gap-2 rounded-lg border-[3px] border-[var(--color-ember)] bg-[var(--color-stage-raised)] p-5 text-center">
        <p className="text-lg font-black">Your repo&apos;s turn.</p>
        <p className="text-sm text-[var(--color-ink-dim)]">
          Every AI-built repo has a few of these. Find yours before someone else
          does.
        </p>
        <Link
          href="/"
          className="mt-1 rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-ember)] px-4 py-2 font-bold text-[var(--color-stage)] shadow-[4px_4px_0_0_oklch(0%_0_0/0.55)] transition-transform hover:-translate-y-0.5"
        >
          🔥 Roast another repo
        </Link>
      </div>

      <footer className="border-t-[3px] border-[var(--color-ink)]/20 pt-4 text-sm text-[var(--color-ink-dim)]">
        <p>{roast.outro}</p>
        <p className="mt-2 text-xs">
          {report.findings.length} finding
          {report.findings.length === 1 ? "" : "s"} · secrets via{" "}
          {report.secretsStrategy === "gitleaks"
            ? "gitleaks (full history)"
            : "API blob-walk (recent history)"}{" "}
          · roast by {roast.provider}
          {failed.length > 0 && (
            <> · {failed.length} scanner(s) errored, results are partial</>
          )}
        </p>
      </footer>
    </section>
  );
}
