"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseTarget, targetToSlug } from "@/lib/target";

interface RoastFormProps {
  autoFocus?: boolean;
}

/** The input: a username or owner/repo, validated client-side before navigating. */
export function RoastForm({ autoFocus }: RoastFormProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseTarget(value);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/roast/${targetToSlug(parsed.target)}`);
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          placeholder="username or owner/repo"
          aria-label="GitHub username or owner/repo"
          aria-invalid={error ? true : undefined}
          className="flex-1 rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-stage-raised)] px-4 py-3 text-lg outline-none focus:border-[var(--color-ember)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-ember)] px-6 py-3 text-lg font-black text-[var(--color-stage)] shadow-[6px_6px_0_0_oklch(0%_0_0/0.55)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          {pending ? "Roasting…" : "Roast it 🔥"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm font-semibold text-[var(--color-ember-hot)]">
          {error}
        </p>
      )}
    </form>
  );
}
