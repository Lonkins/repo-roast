"use client";

import { useState } from "react";

interface PrivateScanFormProps {
  /** the signed-in user's login, prefilled to nudge scanning their own repos */
  login: string;
  defaultValue?: string;
}

/** Submits via GET to /private?target= so the scan runs server-side with the
 * session token (the token never reaches the client). */
export function PrivateScanForm({ login, defaultValue }: PrivateScanFormProps) {
  const [value, setValue] = useState(defaultValue ?? `${login}/`);

  return (
    <form method="GET" action="/private" className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          name="target"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`${login}/your-private-repo`}
          aria-label="Your repo to scan (owner/repo)"
          className="flex-1 rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-stage-raised)] px-4 py-3 text-lg outline-none focus:border-[var(--color-ember)]"
        />
        <button
          type="submit"
          className="rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-ember)] px-6 py-3 text-lg font-black text-[var(--color-stage)] transition-transform hover:-translate-y-0.5"
        >
          Roast it 🔥
        </button>
      </div>
    </form>
  );
}
