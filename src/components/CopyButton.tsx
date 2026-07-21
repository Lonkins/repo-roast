"use client";

import { useState } from "react";

interface CopyButtonProps {
  /** text placed on the clipboard */
  text: string;
  /** accessible label; defaults to "Copy" */
  label?: string;
}

/**
 * Small clipboard button so a FindingCard can stay a Server Component while the
 * "paste this into your AI agent" prompt gets a one-click copy — the core
 * remediation mechanic (ADR 0002).
 */
export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context / permissions) — select-all is the
      // fallback; the prompt text is right there next to the button.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className="shrink-0 rounded-md border-2 border-[var(--color-mint)]/50 px-2.5 py-1 text-xs font-bold text-[var(--color-mint)] transition-colors hover:bg-[var(--color-mint)]/10"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
