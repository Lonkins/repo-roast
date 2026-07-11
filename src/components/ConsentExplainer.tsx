/** The consent/scope explainer shown before any OAuth. Plain, honest, no dark
 * patterns — the user should know exactly what they're granting and where the
 * token lives. */
export function ConsentExplainer() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border-[3px] border-[var(--color-ink)] bg-[var(--color-stage-raised)] p-6">
      <h2 className="text-xl font-black">
        Before you sign in — what this does
      </h2>
      <ul className="flex flex-col gap-3 text-sm text-[var(--color-ink-dim)]">
        <li className="flex gap-2">
          <span aria-hidden>🔑</span>
          <span>
            GitHub asks you to authorize the <code>repo</code> and{" "}
            <code>read:user</code> scopes. <code>repo</code> is what lets
            repo-roast read your <strong>private</strong> repositories so it can
            scan them. It is used only for reading.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🏠</span>
          <span>
            Your access token is stored in an{" "}
            <strong>encrypted session cookie</strong> on this instance — there
            is no database. In a self-hosted deployment the token{" "}
            <strong>never leaves your own machine</strong>: it is only ever sent
            to <code>api.github.com</code> to run the scan.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🧾</span>
          <span>
            Scanning is read-only. repo-roast never writes to your repos, never
            posts, and never stores your findings server-side.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🚪</span>
          <span>
            Sign out any time to drop the token, and revoke access from your{" "}
            <a
              href="https://github.com/settings/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-ember)] underline underline-offset-2"
            >
              GitHub authorized apps
            </a>{" "}
            page.
          </span>
        </li>
      </ul>
    </div>
  );
}
