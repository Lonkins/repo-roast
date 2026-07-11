import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Auth.js (NextAuth v5) with a GitHub OAuth App for private mode.
 *
 * Scope `repo` grants read of the signed-in user's PRIVATE repositories so
 * they can scan their own. The access token is stored in the encrypted JWT
 * session cookie (no database) and is only ever forwarded to api.github.com by
 * the scan service — in self-host it never leaves the operator's instance.
 *
 * Reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET / AUTH_SECRET from env. When those
 * are absent the sign-in flow is simply unavailable (see isPrivateModeConfigured).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID ?? process.env.GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? process.env.GITHUB_SECRET,
      // read:user for identity, repo to read the user's own private repos
      authorization: { params: { scope: "read:user repo" } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      // Persist the GitHub access token into the encrypted JWT on first sign-in.
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    session({ session, token }) {
      // Surface the token to server code only. It is not sent to the client
      // beyond the httpOnly session cookie the browser already holds.
      session.accessToken =
        typeof token.accessToken === "string" ? token.accessToken : undefined;
      return session;
    },
  },
});
