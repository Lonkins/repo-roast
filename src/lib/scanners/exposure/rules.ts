/**
 * Insecure-default detectors for AI-scaffolded apps — the mistakes a code
 * generator makes that no vulnerability DB will ever list: a server secret put
 * behind a client-exposed env prefix, an LLM SDK told to run in the browser,
 * `Access-Control-Allow-Origin: *`, an `unsafe-eval` CSP. All string/AST-shape
 * facts, deterministic, and value-redacted (a secret's *name* is evidence; its
 * value never is).
 */

import type { Finding, RepoRef } from "../../engine/types";

/** Env prefixes that a bundler ships to the browser — treat as public. */
const PUBLIC_PREFIXES = [
  "NEXT_PUBLIC_",
  "VITE_",
  "REACT_APP_",
  "EXPO_PUBLIC_",
  "NUXT_PUBLIC_",
  "GATSBY_",
  "PUBLIC_", // SvelteKit
];

/**
 * Substrings in a var *name* that mean "server-only secret". Deliberately
 * excludes ambiguous words (API_KEY, TOKEN, KEY) because plenty of genuinely
 * public values use them — Firebase apiKey, Stripe publishable keys, the
 * Supabase anon key. These words are not ambiguous.
 */
const SECRET_WORDS = [
  "SECRET",
  "SERVICE_ROLE",
  "SERVICE_KEY",
  "PRIVATE_KEY",
  "PRIVATE",
  "PASSWORD",
  "PASSWD",
  "CLIENT_SECRET",
];

const ENV_RE = /(^|\/)\.env(\.[A-Za-z0-9_-]+)?$/;
const EXAMPLE_ENV_RE = /\.(example|sample|template|dist|local\.example)$/;

export type FileKind = "env-committed" | "env-example" | "code";

export function fileKind(path: string): FileKind | null {
  if (ENV_RE.test(path)) {
    return EXAMPLE_ENV_RE.test(path) ? "env-example" : "env-committed";
  }
  return "code";
}

/** A client-prefixed var whose name unambiguously denotes a server secret. */
export function isSecretPublicVar(name: string): boolean {
  const prefix = PUBLIC_PREFIXES.find((p) => name.startsWith(p));
  if (!prefix) return false;
  const rest = name.slice(prefix.length);
  return SECRET_WORDS.some((w) => rest.includes(w));
}

function lineOf(content: string, needle: string): number | undefined {
  const idx = content.split("\n").findIndex((l) => l.includes(needle));
  return idx === -1 ? undefined : idx + 1;
}

function ghUrl(repo: RepoRef, path: string, line?: number): string {
  const base = `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.defaultBranch}/${path}`;
  return line ? `${base}#L${line}` : base;
}

/** Names referenced in code (process.env.X, import.meta.env.X) or env keys. */
function collectPublicSecretNames(content: string, kind: FileKind): string[] {
  const names = new Set<string>();
  if (kind === "code") {
    const re = /(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)/g;
    for (const m of content.matchAll(re)) {
      if (isSecretPublicVar(m[1]!)) names.add(m[1]!);
    }
  } else {
    for (const raw of content.split("\n")) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/.exec(raw);
      if (m && isSecretPublicVar(m[1]!)) names.add(m[1]!);
    }
  }
  return [...names];
}

function secretPublicFindings(
  repo: RepoRef,
  path: string,
  content: string,
  kind: FileKind,
): Finding[] {
  return collectPublicSecretNames(content, kind).map((name) => {
    const committed = kind === "env-committed";
    return {
      id: "exposure/secret-behind-public-prefix",
      scanner: "exposure",
      severity: committed ? "critical" : "high",
      title: `Server secret "${name}" is exposed to the browser by its public env prefix`,
      evidence: {
        repo: `${repo.owner}/${repo.repo}`,
        path,
        line: lineOf(content, name),
        url: ghUrl(repo, path, lineOf(content, name)),
        detail: committed
          ? `${name} is committed in ${path} and its prefix ships it into the client bundle — anyone can read it in DevTools.`
          : `${name}'s prefix ships it into the client bundle; whatever real value fills it in production is public.`,
      },
      fix: `Drop the public prefix: name it "${name.replace(/^[A-Z]+_PUBLIC_|^VITE_|^REACT_APP_|^EXPO_PUBLIC_|^NUXT_PUBLIC_|^GATSBY_|^PUBLIC_/, "")}" (server-only) and read it only in server code. If it was ever committed, rotate it now.`,
      why: `A "public"-prefixed env var is compiled into the JavaScript sent to every visitor. A service-role or secret key there isn't hidden — it's one DevTools tab away from full access to your backend.`,
      agentPrompt: `In ${path}, the env var "${name}" holds a server-only secret but uses a browser-exposed prefix, so it ships in the client bundle. Rename it without the public prefix, update every reference to read it only in server-side code (route handlers, server actions, API routes — never a client component), and note that the old value must be rotated because it was exposed. Do not print the value.`,
    };
  });
}

function dangerousBrowserFindings(
  repo: RepoRef,
  path: string,
  content: string,
): Finding[] {
  if (!/dangerouslyAllowBrowser\s*:\s*true/.test(content)) return [];
  const line = lineOf(content, "dangerouslyAllowBrowser");
  return [
    {
      id: "exposure/llm-key-in-browser",
      scanner: "exposure",
      severity: "critical",
      title: `An LLM SDK is configured to run in the browser in ${path}`,
      evidence: {
        repo: `${repo.owner}/${repo.repo}`,
        path,
        line,
        url: ghUrl(repo, path, line),
        detail:
          "`dangerouslyAllowBrowser: true` lets the OpenAI/Anthropic client initialize in the browser — the API key is bundled and sent to every visitor.",
      },
      fix: "Move all LLM calls to the server (a route handler / server action) and call them from the client over your own endpoint. Remove `dangerouslyAllowBrowser` and rotate the exposed key.",
      why: "The SDK guards this behind a flag literally named 'dangerous' because a browser-side client bakes your provider API key into the page. Anyone can lift it and run up your bill against your account.",
      agentPrompt: `In ${path}, an LLM SDK is created with \`dangerouslyAllowBrowser: true\`, which exposes the provider API key in the client bundle. Move the LLM call server-side: create a server route/action that holds the key in a server-only env var and calls the provider, and have the client fetch that route instead. Remove the \`dangerouslyAllowBrowser\` flag and remind me to rotate the leaked key.`,
    },
  ];
}

function corsFindings(repo: RepoRef, path: string, content: string): Finding[] {
  const wildcard =
    // header as object entry (:), assignment (=), or setHeader(name, value) (,)
    /["']?Access-Control-Allow-Origin["']?\s*[:=,]\s*[`"']\*/.test(content) ||
    /\borigin\s*:\s*["']\*["']/.test(content) ||
    /\borigin\s*:\s*true\b/.test(content);
  if (!wildcard) return [];
  const withCreds =
    /Access-Control-Allow-Credentials["']?\s*[:=]\s*[`"']?true/.test(content) ||
    /\bcredentials\s*:\s*true\b/.test(content);
  const needle = /Access-Control-Allow-Origin/.test(content)
    ? "Access-Control-Allow-Origin"
    : "origin";
  const line = lineOf(content, needle);
  return [
    {
      id: "exposure/permissive-cors",
      scanner: "exposure",
      severity: withCreds ? "high" : "medium",
      title: `CORS allows any origin${withCreds ? " with credentials" : ""} in ${path}`,
      evidence: {
        repo: `${repo.owner}/${repo.repo}`,
        path,
        line,
        url: ghUrl(repo, path, line),
        detail: withCreds
          ? "Allowing any origin together with credentials lets any website make authenticated requests as your logged-in users."
          : "A wildcard origin lets any website call this API from a victim's browser.",
      },
      fix: withCreds
        ? "Never combine `origin: *` with credentials. Set an explicit allowlist of trusted origins and echo only matching ones."
        : "Replace the wildcard with an explicit allowlist of the origins that actually need access.",
      why: withCreds
        ? "Wildcard origin plus credentials is the one combination the CORS spec tries to forbid: any malicious page a logged-in user visits can call your API as them and read the response."
        : "A wildcard origin means any site on the internet can invoke this endpoint from a visitor's browser — fine for truly public data, dangerous for anything else.",
      agentPrompt: `In ${path}, CORS is configured to allow any origin${withCreds ? " together with credentials, which is especially dangerous" : ""}. Replace the wildcard with an explicit allowlist of the specific trusted origins this API serves, read from configuration${withCreds ? ", and ensure credentials are only allowed for those exact origins" : ""}. Keep a wildcard only if the endpoint truly serves public, unauthenticated data.`,
    },
  ];
}

function cspFindings(repo: RepoRef, path: string, content: string): Finding[] {
  if (!content.includes("unsafe-eval")) return [];
  const line = lineOf(content, "unsafe-eval");
  return [
    {
      id: "exposure/unsafe-eval-csp",
      scanner: "exposure",
      severity: "medium",
      title: `Content-Security-Policy allows 'unsafe-eval' in ${path}`,
      evidence: {
        repo: `${repo.owner}/${repo.repo}`,
        path,
        line,
        url: ghUrl(repo, path, line),
        detail:
          "'unsafe-eval' re-enables eval()/new Function(), which is exactly what an injected script needs to turn a small XSS into full code execution.",
      },
      fix: "Remove 'unsafe-eval' from the CSP. If a dependency needs eval, replace or isolate it; 'unsafe-eval' is almost never actually required in production.",
      why: "A CSP is meant to blunt XSS. Leaving 'unsafe-eval' in hands the attacker back the sharpest tool — an injected string can be executed as code.",
      agentPrompt: `In ${path}, the Content-Security-Policy includes 'unsafe-eval', which defeats much of the CSP's XSS protection. Remove 'unsafe-eval' from the policy and check whether anything genuinely relies on eval()/new Function(); if so, identify the dependency and propose a replacement rather than keeping the directive.`,
    },
  ];
}

/** Run every applicable rule over one file's content. */
export function analyzeFile(
  repo: RepoRef,
  path: string,
  content: string,
): Finding[] {
  const kind = fileKind(path);
  if (kind === null) return [];
  const findings = secretPublicFindings(repo, path, content, kind);
  if (kind === "code") {
    findings.push(
      ...dangerousBrowserFindings(repo, path, content),
      ...corsFindings(repo, path, content),
      ...cspFindings(repo, path, content),
    );
  }
  return findings;
}
