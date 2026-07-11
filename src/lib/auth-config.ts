/**
 * Private mode is optional: it needs a GitHub OAuth App the operator registers
 * themselves. When the env isn't configured, the UI shows a "not configured"
 * explainer instead of a broken sign-in — the public app still works.
 */
export function isPrivateModeConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    (env.AUTH_GITHUB_ID ?? env.GITHUB_ID) &&
    (env.AUTH_GITHUB_SECRET ?? env.GITHUB_SECRET) &&
    env.AUTH_SECRET,
  );
}
