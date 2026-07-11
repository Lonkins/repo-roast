import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** GitHub OAuth access token — server-side use only (scan the user's repos). */
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}
