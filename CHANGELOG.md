# Changelog

All notable changes to repo-roast are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com); this project uses [Conventional Commits](https://www.conventionalcommits.org).

## [Unreleased] — AI-authorship audit pivot

Repositioned from a security-roast toy into a **pre-ship auditor for the AI-assisted era** — catching the mistakes AI-built repos ship that no vulnerability database lists, each with a copy-paste fix for the reader's own AI agent. Direction set by an advisory-panel process; see [ADR 0002](docs/adr/0002-ai-authorship-audit-pivot.md).

### Added

- **`slopsquat` scanner** — hallucinated, typosquatted, and newborn dependencies, resolved against live npm & PyPI registry data (existence, age, version count, edit-distance to popular names). Deterministic; a network failure yields no finding, only a definitive 404 counts.
- **`exposure` scanner** — insecure defaults a code generator ships: a server secret behind a `NEXT_PUBLIC_`/`VITE_` prefix, `dangerouslyAllowBrowser` LLM keys, wildcard CORS, `unsafe-eval` CSP. Value-redacted.
- **`agents` scanner** — the AI-agent/MCP attack surface: skipped approval gates (`--dangerously-skip-permissions`, `autoApprove`), unpinned or remote MCP servers, hardcoded MCP secrets.
- **`claims` scanner** — claims-vs-reality: a README documenting a script/badge the repo doesn't back up, a CI badge for a missing workflow, hardcoded status badges.
- **Remediation-first output** — every finding now also carries a plain-language **why it bites** and an **`agentPrompt`**: a copy-paste instruction for the reader's own AI coding agent to apply the fix. Rendered on each finding card (with a one-click Copy) and returned by the JSON API.

### Changed

- Repositioned the landing page, README, and finding catalog around the AI-authorship auditor and the remediation loop.
- Deduplicated the secrets scanner's finding construction into a shared builder shared by the gitleaks and blob-walk strategies.

## [1.0.0] — 2026-07-11

First public release. A complete, self-hostable security-roast product.

### Added

- **Deterministic security engine** — typed `Finding` model, severity-weighted burn score (0–100) with comedic grade bands, and an orchestrator that runs scanners in parallel and reports partial failures honestly.
- **Secrets scanner** — full-history gitleaks over a bare clone (self-host) or a GitHub API blob-walk with bundled rules (serverless); flags committed `.env`, live credentials, and secrets deleted-but-still-in-history.
- **GitHub Actions scanner** — `pull_request_target` untrusted checkout, `write-all` permissions, `${{ github.event.* }}` script injection, and unpinned third-party actions.
- **Dependency scanner** — OSV.dev advisories for npm, PyPI, and crates.io manifests/lockfiles.
- **Repo-hygiene scanner** — suspicious tracked files, committed build artifacts, missing `SECURITY.md`, unlicensed public repos.
- **Comedy layer** — bundled deterministic template roaster (default, zero spend) and an optional BYO-key LLM path (Anthropic / OpenAI / Ollama) that only phrases real findings; fixes are always deterministic.
- **Public roast mode** — landing + shareable results at `/roast/[...slug]`, a JSON API at `/api/roast`, per-IP rate limiting, and friendly GitHub error handling.
- **Private / self-host mode** — GitHub OAuth (Auth.js) to scan your own private repos, with a consent explainer and a token-never-leaves-the-instance guarantee.
- **Shareable output** — generated OG share card (`/api/og/...`) and a live "Roast me" burn-score badge (`/api/badge/...`) with a copy-paste README snippet.
- **Self-host packaging** — multi-stage Dockerfile bundling git + gitleaks, docker-compose, and Vercel free-tier config.
- **Docs** — finding catalog with fixes, ethics note, deploy-your-own guide, and ADRs.

### Ethics

repo-roast punches up at the code, never down at the person. Every finding ships a fix; a clean repo gets a complimentary roast, never invented flaws.
