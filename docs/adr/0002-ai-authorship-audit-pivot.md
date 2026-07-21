# ADR 0002: From security roast to an AI-authorship pre-ship auditor

Date: 2026-07-21 · Status: accepted · Supersedes scope framing in [0001](0001-architecture.md)

## Context

repo-roast began as a deterministic security scanner delivered as comedy. The
question on the table: grow it into a "sophisticated repo-quality audit tool"
for the wave of people building with AI assistants who don't know best
practices — without rebuilding a tool that already exists.

A seven-persona advisory panel (OSS maintainer, vibe coder, security engineer,
DevRel/educator, platform engineer, OpenSSF-orbit standards insider, product
skeptic) reviewed the direction. Strong convergence:

- **Do NOT broaden into general code quality** (complexity, coverage, style,
  duplication, docs-as-Sonar). That is the rebuild trap — you become a worse
  SonarQube/CodeClimate and bury the signal. Every incumbent already grades
  or gates for an audience that _already knows what "good" is_.
- **The genuine white space is AI-authorship failure modes** that predate the
  incumbents' design and that none of them hunt for — plus a **remediation
  output** the incumbents don't produce.
- **The roast stays as the top-of-funnel.** It is the only distribution asset
  that isn't already free and better elsewhere. The _fix_, not the laugh, is
  the retention (this answers the skeptic's "one-shot demo" risk).
- **The LLM stays out of detection, severity, and score.** Findings must be
  reproducible from a commit SHA. The model only phrases (unchanged from 0001).

## Decisions

1. **Reposition, don't fork.** Keep the single Next.js app and the pure-TS
   `Finding`/`Scanner` engine. The engine is the moat; the roast becomes one
   rendering of the findings. Branding ("repo-roast" vs a serious name) is an
   open question deferred to a later panel once the substance exists — it is
   a naming decision, not an architecture fork.

2. **New scanners target AI-authorship failure modes** no incumbent owns:
   - `slopsquat` — hallucinated / typosquatted / newborn dependencies,
     resolved against **real registry data** (existence, age, version count,
     edit-distance to popular names). OSV/Snyk only flag _known-vulnerable
     published_ packages; they are blind to a dep that resolves to a package
     registered days ago, or to a near-miss of a popular name. Highest
     novelty, highest severity (install-time RCE via slopsquatting).
   - `exposure` — secrets-to-client and insecure scaffold defaults:
     `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_` env holding secret-shaped values, CORS
     `*`, `unsafe-inline`/`unsafe-eval` CSP, Supabase RLS-off tells, debug
     endpoints. Tuned to specific AI-scaffold stacks; near-zero false positive.
   - `agents` — agent/MCP config attack surface: `.mcp.json`, `.cursor/`,
     `.claude/settings*.json`, auto-approve / `--dangerously-skip-permissions`
     / tool defs piping untrusted web content into a shell.
   - `claims` — claims-vs-reality: README/badge says `npm test` but there is
     no test script; a CI badge points at a workflow that doesn't exist;
     documented scripts/config the code never references. Fully deterministic.

3. **Remediation-first output is the differentiator.** Every `Finding` may
   carry `why` (one concrete failure story, plain language) and `agentPrompt`
   (a copy-paste prompt for the user's _own_ AI agent to apply the fix in their
   repo). Anti-rebuild litmus (adopted verbatim from the panel): _ship a
   feature only when its output is a plain-language explanation **plus** a
   paste-ready fix the user couldn't have written themselves — not just a
   score, badge, or pass/fail a CI could consume._

4. **Local CLI + machine-readable output** (`sarif`/`json`/`pretty`), scanning
   an offline checkout, is the pre-ship gate ("run it before you Deploy") and
   the CI-optional adoption path. The `Finding` model is already SARIF-shaped.

## Explicitly deferred (panel kill-list)

Hosted GitHub App with PR-comment bot · org dashboards · accounts / score
history · leaderboards ranking people · re-fighting OpenSSF Scorecard on
supply-chain posture (branch protection, signed releases, token scopes) ·
general code-quality metrics. Revisit only after the moat scanners + the
remediation loop have shipped and shown retention.

## Consequences

- The engine's `ScannerId` union grows per scanner; new scanners follow the
  established injectable-client factory pattern (see `deps`) so they stay
  unit-testable without network.
- Determinism is preserved: registry/DNS facts are real data, not model
  judgment. "Newborn" is measured against the injected `ctx.now()`.
