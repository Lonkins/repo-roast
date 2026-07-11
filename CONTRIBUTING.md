# Contributing to repo-roast

Thanks for wanting to make the roast hotter (and the fixes better).

## Ground rules

- **Punch up at the code, never down at the person.** Jokes target findings, not humans. PRs that add mean-spirited content will be closed.
- **Findings are deterministic.** New findings must come from a scanner rule with evidence and a concrete fix — never from an LLM. The comedy layer only phrases findings that already exist.
- **No secrets, ever.** Test fixtures use synthetic secrets only (gitleaks-detectable but revoked/fake). CI runs gitleaks on this repo; keep it green.

## Development

```bash
pnpm install
pre-commit install   # gitleaks + prettier + eslint + tsc on every commit
pnpm dev             # http://localhost:3000
```

## Workflow

1. Branch from `main` (`feat/...`, `fix/...`).
2. Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`...).
3. Add/update tests for anything behavioral. `pnpm test` and `pnpm lint` must pass.
4. Open a PR. CI (lint, type-check, tests, gitleaks, build) must be green before merge.

## Adding a scanner rule

Each rule produces a `Finding` with: stable `id`, `severity`, `title`, `evidence` (where), and `fix` (how to remedy). Add a fixture that triggers it and one that doesn't. Then add a template joke for it in the roaster — or let the fallback templates handle it.

## Reporting security issues in repo-roast itself

See [SECURITY.md](SECURITY.md). Do not open public issues for vulnerabilities.
