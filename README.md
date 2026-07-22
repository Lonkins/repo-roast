<div align="center">

# repo-roast 🔥

**A pre-ship auditor for the AI-assisted era. Catch the mistakes AI-built repos actually ship — hallucinated dependencies, keys leaked to the browser, over-permissioned agent configs, docs that lie — each with a real fix _and_ a copy-paste prompt for your AI agent. Deterministic scan, delivered as a roast, self-hostable for private repos.**

[![CI](https://github.com/Lonkins/repo-roast/actions/workflows/ci.yml/badge.svg)](https://github.com/Lonkins/repo-roast/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Zero spend](https://img.shields.io/badge/cost-%240-brightgreen)](docs/self-host.md)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-orange)](CONTRIBUTING.md)

![repo-roast share card](docs/assets/share-card.png)

</div>

A huge wave of people now build software with AI assistants but don't yet know the best practices — and AI-generated repos ship a recognizable set of mistakes that no vulnerability database will ever list: a dependency the model **hallucinated** (a name an attacker can register with malware), a service key placed behind `NEXT_PUBLIC_` so it **ships to the browser**, an agent config with the approval gate switched off, a README that promises a `test` script that doesn't exist. repo-roast is built to catch exactly these, alongside the classics — committed secrets, dangerous GitHub Actions, vulnerable dependencies.

Findings are **deterministic** (gitleaks, OSV.dev, live npm/PyPI registry data, the GitHub API; no LLM required, reproducible from a commit SHA). Every finding ships three things: a concrete **fix**, a plain-language **why it bites**, and a copy-paste **prompt for your own AI agent** to apply the fix in your repo — because the audience that ships these mistakes fixes them by pasting. The comedy is a thin layer on top: a bundled template roaster is funny with **zero spend and zero network**, or bring your own LLM key for freeform wit.

It's a funny Trojan horse for a serious auditor — and it's self-hostable so you can point it at your **private** repos with your token never leaving your machine.

## Why it's not just another roast toy — or another linter

Most "roast my GitHub" tools are style jokes over an LLM with no substance. And the serious incumbents — OpenSSF Scorecard, SonarQube, Snyk — grade or gate for an audience that _already knows what good looks like_. repo-roast sits in the gap between them:

- **It targets AI-authorship failure modes** the incumbents were designed before and don't hunt for — hallucinated/typosquatted deps, secrets leaked to the client bundle, agent/MCP attack surface, docs that don't match the repo. (Deliberately **not** a general code-quality tool — that's Sonar's job; see [ADR 0002](docs/adr/0002-ai-authorship-audit-pivot.md).)
- **The findings are real and deterministic** — every burn is backed by a scanner rule, evidence, and a location. The LLM (optional) only _phrases_ findings that already exist; it can never invent one, change a severity, or move the score.
- **Every finding teaches and remediates**, not just grades — a fix, a why, and a paste-ready agent prompt. The joke is the sugar; the fix is the medicine.
- **It punches up at the code, never down at the person.** See [the ethics note](docs/ethics.md). A clean repo gets a grudgingly complimentary roast, not fabricated flaws.
- **Self-hostable for private repos**, token never leaving your instance — the niche nothing else occupies.

## What it checks

**The AI-authorship scanners** — what an AI-assisted build ships that no vuln DB lists:

| Scanner       | Finds                                                                                                                                                | Detection                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Slopsquat** | **hallucinated** dependencies (a name the model invented), typosquats of popular packages, and brand-new "landing pad" packages                      | live npm & PyPI registry data — existence, age, versions, edit-distance |
| **Exposure**  | server secrets behind a `NEXT_PUBLIC_`/`VITE_` prefix, `dangerouslyAllowBrowser` LLM keys, wildcard CORS, `unsafe-eval` CSP                          | bounded env/config/source inspection (value-redacted)                   |
| **Agents**    | agent/MCP config with the approval gate off (`--dangerously-skip-permissions`, `autoApprove`), unpinned or remote MCP servers, hardcoded MCP secrets | `.mcp.json` / `.claude` / `.cursor` config + workflow/script parsing    |
| **Claims**    | a README that documents a `test`/`build` script package.json lacks, a CI badge for a missing workflow, hardcoded "coverage 100%" badges              | README vs. package.json vs. the workflow tree                           |

**The classics** — the security posture, still deterministic:

| Scanner          | Finds                                                                                                                                              | Detection                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Secrets**      | committed `.env`, live keys/tokens, and secrets "deleted" but still in git history                                                                 | gitleaks over full history (self-host) or a GitHub API blob-walk (serverless) |
| **Actions**      | `pull_request_target` checking out untrusted code, `write-all` permissions, `${{ github.event.* }}` script injection, unpinned third-party actions | workflow YAML parsing                                                         |
| **Dependencies** | known-vulnerable packages (npm, PyPI, crates.io)                                                                                                   | [OSV.dev](https://osv.dev) advisory API (free)                                |
| **Hygiene**      | `id_rsa`/keystores/`credentials.json`/DB dumps, committed build artifacts, missing `SECURITY.md`, unlicensed public repos                          | repo tree inspection                                                          |

Full details and the fix for each in the **[finding catalog](docs/finding-catalog.md)**.

## Quickstart

```bash
git clone https://github.com/Lonkins/repo-roast.git
cd repo-roast
pnpm install
pnpm dev            # http://localhost:3000
```

Enter a username (`octocat`) or `owner/repo` (`octocat/Spoon-Knife`) and get a shareable roast. No API keys, no LLM, no spend required — the bundled template roaster handles the comedy.

Or hit the JSON API:

```bash
curl "http://localhost:3000/api/roast?target=octocat/Spoon-Knife"
```

## Deploy your own

Two zero-cost paths — Vercel free tier or self-hosted Docker (which bundles gitleaks for full-history secret scanning). Both, plus registering a GitHub OAuth App for private mode and wiring an optional LLM, are in the **[Deploy your own guide](docs/self-host.md)**.

```bash
cp .env.example .env       # optional — public mode works empty
docker compose up --build  # http://localhost:3000
```

## Scan before you push (local CLI + pre-commit)

Catch these in your own working tree — before anything reaches GitHub — with the local scanner. It runs the same engine against your checkout (no API, offline), skipping the two network scanners with `--no-network`:

```bash
pnpm scan --no-network --fail-on high    # exits non-zero if anything ≥ high
```

Wire it into [pre-commit](https://pre-commit.com) so a leaked-to-client key or an unpinned MCP server can't get committed — see the `repo-roast-audit` hook in [`.pre-commit-config.yaml`](.pre-commit-config.yaml). A `.reporoastignore` (gitignore-lite: one path prefix per line) excludes vendored code, generated files, or intentional test data.

## The comedy layer (optional, BYO)

The default **template roaster** is deterministic, funny, and free. For freeform wit, set `ROAST_PROVIDER`:

- `ollama` — local model, zero cost, nothing leaves your machine
- `claude-cli` — shell out to your already-authenticated `claude` CLI; reuses your existing Claude login (subscription _or_ key) and repo-roast never handles a token
- `anthropic` / `openai` — BYO key. For Anthropic you can set `ANTHROPIC_AUTH_TOKEN` (a short-lived OAuth bearer token, e.g. from `ant auth print-credentials --access-token`) instead of a pasted `ANTHROPIC_API_KEY`

The LLM only phrases the real findings; fixes always come from the scanner, and any LLM error degrades gracefully to the template roaster.

## Add a "Roast me" badge

Every result page has a copy-paste snippet. It renders a live burn-score badge:

```markdown
[![repo-roast burn score](https://your-instance/api/badge/OWNER/REPO)](https://your-instance/roast/OWNER/REPO)
```

## How it's built

TypeScript · Next.js 16 (App Router) · Tailwind v4 · a pure-TS engine (`src/lib/engine`, `src/lib/scanners`) with no framework imports · Octokit · Auth.js (private mode) · Vitest. Architecture decisions are recorded in [`docs/adr/`](docs/adr/). The engine is fully unit-tested and the app dog-foods gitleaks in its own CI — a scanner that roasts secret leaks had better be immaculate about its own.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The one hard rule: roast the code, never the coder.

## License

[Apache-2.0](LICENSE)
