import Link from "next/link";
import { RoastForm } from "@/components/RoastForm";

const SAMPLES = ["torvalds", "octocat/Spoon-Knife", "gvanrossum"];

/** The scanner surface, shown as a strip so the reposition is legible at a glance. */
const CHECKS = [
  "hallucinated deps",
  "keys leaked to the browser",
  "agent / MCP config",
  "docs that lie",
  "committed secrets",
  "cursed Actions",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="rounded-full border-2 border-[var(--color-ember)] px-3 py-1 text-xs font-bold tracking-widest text-[var(--color-ember)] uppercase">
          Pre-ship audit for the AI era · deterministic
        </p>
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          repo-roast <span aria-hidden>🔥</span>
        </h1>
        <p className="max-w-xl text-lg text-[var(--color-ink-dim)]">
          Building with AI is fast — and AI-built repos ship a whole class of
          mistakes no vuln scanner lists: a{" "}
          <strong>dependency the model invented</strong>, a service key placed
          behind <code>NEXT_PUBLIC_</code> so it{" "}
          <strong>ships to the browser</strong>, an agent config with the
          guardrails switched off, a README that promises a test that isn&apos;t
          there. We find them, roast them, and hand you a{" "}
          <strong>copy-paste fix for your own AI agent</strong>.
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {CHECKS.map((c) => (
            <li
              key={c}
              className="rounded-md border-2 border-[var(--color-ink)]/25 bg-[var(--color-stage-raised)]/60 px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-dim)]"
            >
              {c}
            </li>
          ))}
        </ul>
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
          repos?{" "}
          <Link
            href="/private"
            className="text-[var(--color-ember)] underline underline-offset-2"
          >
            Private mode
          </Link>{" "}
          (self-hosted) keeps your token on your own machine. See the{" "}
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
