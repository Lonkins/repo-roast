# Changelog

All notable changes to repo-roast are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com); this project uses [Conventional Commits](https://www.conventionalcommits.org).

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
