# ADR 0001: Core architecture

Date: 2026-07-11 · Status: accepted

## Context

repo-roast must produce deterministic security findings for a GitHub target, deliver them as comedy, run on the Vercel free tier AND self-hosted Docker, and cost zero to operate.

## Decisions

1. **Next.js App Router, single app.** UI + API routes in one deployable. No separate backend — nothing here needs one.
2. **Engine is a pure TypeScript library** (`src/lib/engine`, `src/lib/scanners`) with no Next.js imports, so it is unit-testable and could later ship as a CLI. Scanners implement one interface: `(target, ctx) => Finding[]`.
3. **Secrets scanning has two strategies.** Self-host (Docker image bundles the gitleaks binary): shallow-clone the repo and run `gitleaks git` over full history — the authoritative path. Serverless (Vercel has no gitleaks binary and an ephemeral FS): walk blobs/patches via the GitHub API and apply a bundled subset of gitleaks-format regex rules. Same `Finding` output either way; the report labels which strategy ran.
4. **Comedy is a provider interface.** `TemplateRoaster` (deterministic, bundled, default) | `LLMRoaster` (BYO Anthropic/OpenAI key via plain `fetch` — no SDK deps) | Ollama (local). Providers only _phrase_ findings; they never add or remove them.
5. **Auth.js (next-auth v5) with a GitHub OAuth App** for private mode. Token lives in the encrypted session cookie (JWT strategy) on the operator's instance; no database, and the token is only ever sent to api.github.com.
6. **Rate limiting is in-memory per-IP token bucket.** Good enough for a free-tier single region; no Redis dependency. Documented ceiling: multi-instance deployments share no state.
7. **OG images via `next/og`** (bundled `ImageResponse`) — zero extra deps.
8. **Docs are in-repo markdown under `/docs`.** No MkDocs build step to maintain; GitHub renders them fine.

## Consequences

- Vercel public mode cannot run the gitleaks binary; the API blob-walk is a documented, slightly weaker fallback (top gitleaks rules, recent history window) — self-host is the full-strength path, which conveniently matches the privacy story.
- No database anywhere: scans are computed on request and results are encoded in the shareable URL/params, which keeps both deploy targets free and stateless.
