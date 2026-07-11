/**
 * Synthetic secrets for scanner tests. Every value here is FABRICATED to match
 * a detector pattern — none is a real credential. Assembled at runtime from
 * parts so the literal token never sits in source (belt-and-suspenders with
 * the .gitleaks.toml allowlist).
 */

// Fake AWS access key id (AKIA + 16 uppercase alnum, all fabricated).
export const FAKE_AWS_KEY = "AKIA" + "IOSFODNN7EXAMPLE";

// Fake GitHub PAT shape (ghp_ + 36 chars).
export const FAKE_GH_TOKEN = "ghp_" + "0123456789abcdefghijklmnopqrstuvwxyz";

// Fake Stripe live secret key shape.
export const FAKE_STRIPE_KEY = "sk_live_" + "0123456789abcdefABCDEF1234";

// Fake private key header (enough to trigger the header rule).
export const FAKE_PRIVATE_KEY =
  "-----BEGIN RSA PRIVATE KEY-----\n" +
  "MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Q\n" +
  "-----END RSA PRIVATE KEY-----";

// High-entropy value assigned to a credential-named variable.
export const FAKE_CREDENTIAL_ASSIGNMENT =
  'password = "' + "Xq7Rt9Zp2Lk4Wm8Vn3Bc6Df1Gh5Js0" + '"';

// A clearly-not-a-secret line, to prove we don't false-positive.
export const CLEAN_LINE = 'const greeting = "hello world";';

/** A committed .env body (the values inside also happen to be fake). */
export const FAKE_DOTENV = [
  "DATABASE_URL=postgres://user:hunter2@localhost:5432/app",
  "API_TOKEN=" + FAKE_GH_TOKEN,
].join("\n");
