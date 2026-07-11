"use client";

import { useEffect, useState } from "react";

interface BadgeSnippetProps {
  slug: string;
}

/** Copy-paste "Roast me" badge snippet for a README. Resolves the absolute
 * origin after mount so the snippet is copyable and correct on any host. */
export function BadgeSnippet({ slug }: BadgeSnippetProps) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const badgeUrl = `${origin}/api/badge/${slug}`;
  const roastUrl = `${origin}/roast/${slug}`;
  const markdown = `[![repo-roast burn score](${badgeUrl})](${roastUrl})`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <details className="rounded-lg border-2 border-[var(--color-ink)]/20 bg-[var(--color-stage-raised)]/50 p-4">
      <summary className="cursor-pointer text-sm font-bold text-[var(--color-ember)]">
        Add a “Roast me” badge to your README
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {origin && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={badgeUrl}
            alt="repo-roast burn score badge preview"
            height={20}
          />
        )}
        <pre className="overflow-x-auto rounded-md bg-[var(--color-stage)] p-3 text-xs">
          <code>{markdown}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="self-start rounded-md border-2 border-[var(--color-ink)] px-3 py-1.5 text-xs font-bold hover:border-[var(--color-ember)]"
        >
          {copied ? "✓ Copied" : "Copy markdown"}
        </button>
      </div>
    </details>
  );
}
