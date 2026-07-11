import Link from "next/link";
import { RoastForm } from "@/components/RoastForm";

const SAMPLES = ["torvalds", "octocat/Spoon-Knife", "gvanrossum"];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="rounded-full border-2 border-[var(--color-ember)] px-3 py-1 text-xs font-bold tracking-widest text-[var(--color-ember)] uppercase">
          Deterministic scan · comedic delivery
        </p>
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          repo-roast <span aria-hidden>🔥</span>
        </h1>
        <p className="max-w-xl text-lg text-[var(--color-ink-dim)]">
          We find the real security problems in a GitHub profile — secrets in
          history, cursed Actions workflows, vulnerable dependencies — and
          deliver them as a roast. Every burn comes with the fix.
        </p>
      </div>

      <RoastForm autoFocus />

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-[var(--color-ink-dim)]">
        <span>Try:</span>
        {SAMPLES.map((s) => (
          <Link
            key={s}
            href={`/roast/${s}`}
            className="rounded-md border-2 border-[var(--color-ink)]/40 px-2 py-1 font-mono hover:border-[var(--color-ember)] hover:text-[var(--color-ember)]"
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="max-w-xl rounded-lg border-2 border-[var(--color-ink)]/20 bg-[var(--color-stage-raised)]/50 p-4 text-sm text-[var(--color-ink-dim)]">
        <p className="font-bold text-[var(--color-mint)]">
          We roast the code, never the coder.
        </p>
        <p className="mt-1">
          Public mode uses only public data. Want to scan your <em>private</em>{" "}
          repos? Self-host it — your token never leaves your machine. See the{" "}
          <a
            href="https://github.com/Lonkins/repo-roast#readme"
            className="text-[var(--color-ember)] underline underline-offset-2"
          >
            README
          </a>
          .
        </p>
      </div>
    </main>
  );
}
