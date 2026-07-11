import { signIn, signOut } from "@/auth";

/** Server-action sign-in — no client bundle, redirects back to /private. */
export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("github", { redirectTo: "/private" });
      }}
    >
      <button
        type="submit"
        className="rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-ember)] px-6 py-3 text-lg font-black text-[var(--color-stage)] shadow-[6px_6px_0_0_oklch(0%_0_0/0.55)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        Sign in with GitHub
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/private" });
      }}
    >
      <button
        type="submit"
        className="text-sm text-[var(--color-ink-dim)] underline underline-offset-2 hover:text-[var(--color-ink)]"
      >
        Sign out
      </button>
    </form>
  );
}
