# Security Policy

repo-roast roasts other repos' security posture, so its own had better be immaculate. If you find a vulnerability, we want to know — quietly, first.

## Reporting a vulnerability

- **Preferred:** open a private report via [GitHub Security Advisories](https://github.com/Lonkins/repo-roast/security/advisories/new).
- Or email **tomprice13@pm.me** with details and reproduction steps.
- Please do **not** open a public issue for security problems.

You can expect an acknowledgement within 7 days. We'll coordinate a fix and credit you in the advisory unless you prefer otherwise.

## Scope notes

- **Public mode** processes only public GitHub data and holds no user secrets.
- **Private / self-host mode:** the operator's OAuth App credentials and the visitor's OAuth token live only in the operator's instance (env vars / encrypted session cookie). If you find any path by which a token leaves the instance, that is a critical finding — report it.
- LLM keys (BYO-key comedy layer) are runtime-only env vars and must never appear in logs, errors, or responses.

## Supported versions

The latest release and `main` receive fixes.
