"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ShareBarProps {
  score: number;
  grade: string;
}

/** Copy-link + share-to-X for the roast. Client-only (clipboard, window). */
export function ShareBar({ score, grade }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  // Resolved after mount so SSR and first client render match (no hydration mismatch).
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    // Mount-time read of a browser-only value; intentionally sets state after
    // hydration so SSR and first client render agree on the href.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageUrl(window.location.href);
  }, []);

  const shareText = `My GitHub security posture scored ${score}/100 (${grade}) on repo-roast 🔥`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}${pageUrl ? `&url=${encodeURIComponent(pageUrl)}` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copyLink}
        className="rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-stage-raised)] px-4 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        {copied ? "✓ Copied" : "Copy link"}
      </button>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border-[3px] border-[var(--color-ember)] bg-[var(--color-ember)]/10 px-4 py-2 text-sm font-bold text-[var(--color-ember)] transition-transform hover:-translate-y-0.5"
      >
        Share the burn
      </a>
      <Link
        href="/"
        className="ml-auto text-sm text-[var(--color-ink-dim)] underline underline-offset-2 hover:text-[var(--color-ink)]"
      >
        Roast another →
      </Link>
    </div>
  );
}
