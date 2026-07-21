# Roadmap — AI-authorship pre-ship auditor

Living plan for the autonomous build loop. Direction and rationale: [ADR 0002](adr/0002-ai-authorship-audit-pivot.md).
Each increment is a self-contained, tested step. Check items off as they land.

## Increment 1 — Moat scanners (AI-authorship failure modes)

- [x] **1a. `slopsquat`** — hallucinated / typosquat / newborn dependency
      scanner over real registry data (npm + PyPI). Findings:
      `nonexistent-dependency`, `typosquat-suspect`, `newborn-dependency`.
- [x] **1b. `exposure`** — insecure scaffold defaults: `secret-behind-public-prefix`
      (server secret behind `NEXT_PUBLIC_`/`VITE_`/… — name-based, low FP),
      `llm-key-in-browser` (`dangerouslyAllowBrowser: true`), `permissive-cors`
      (wildcard, escalated with credentials), `unsafe-eval-csp`.
- [x] **1c. `agents`** — agent/MCP config attack surface: `auto-approved-execution`
      (skip-permissions / bypass / autoApprove across configs, workflows, scripts),
      `unpinned-mcp-server`, `remote-mcp-server`, `hardcoded-mcp-secret`.
- [x] **1d. `claims`** — claims-vs-reality: `undefined-script` (README documents
      a script package.json doesn't define, or the `npm init` test placeholder),
      `broken-ci-badge` (badge → missing workflow), `decorative-status-badge`
      (hardcoded coverage/build/tests badge measuring nothing).

## Increment 2 — Remediation-first output (the differentiator)

- [x] **2a.** Extend `Finding` with optional `why` + `agentPrompt`. (non-breaking)
- [x] **2b.** Populate `why`/`agentPrompt` on all existing scanners. `secrets`
      done via a shared `secrets/findings.ts` builder (dedupes the fix text that
      was copy-pasted across the blobwalk + gitleaks strategies).
- [x] **2c.** Render `why` + copy-paste `agentPrompt` in the result UI
      (`FindingCard` + `CopyButton`). JSON API already returns them (they live on
      `Finding`, which `/api/roast` serializes wholesale).

## Definition of done — decided by the 2026-07-22 panel (5 seats)

The core auditor (Increments 1 + 2) is complete. A focused panel (platform eng,
product skeptic, target-user vibe coder, OSS adopter, QA/release critic) ruled
the **CI/SARIF CLI is NOT required for "built"** (4 of 5): the target user won't
touch SARIF/`--fail-on`, and the skeptic calls the CI direction a trap that
strangles the web share loop. Build it only on real inbound demand. The near-
unanimous signal was coherence + try-ability gaps. Ship criteria:

- [x] **D1. Landing page reposition** — `page.tsx` matches the pivot (was the
      QA critic's #1 blocker; the front door still sold the old product).
- [ ] **D2. Live end-to-end verification** — run the app, confirm a real scan
      renders `why` + the copy-paste agent prompt, Copy works, and the JSON API
      emits both fields. (Headline value, never exercised outside unit tests.)
- [ ] **D3. Share loop** — result page leads with score + scariest finding and a
      clear "scan yours next" CTA; landing has a working example to try instantly.
- [ ] **D4. Playwright smoke** — one E2E asserting the new fields render.
- [ ] **D5. CHANGELOG** — record the pivot.

## Deferred to a future decision (NOT blockers for "built")

- **CI/SARIF CLI** (`--format sarif`, `--fail-on`). If a CLI is built, the panel's
  target user wants a **zero-config `npx repo-roast .` on a local folder** before
  push — NOT the CI gate. Needs a filesystem `GitHubClient` adapter. Build on
  demand.
- **Score recalibration** for 8 scanners — the linear cap saturates at 100 after
  ~4 criticals and loses discrimination. A saturating curve (`100·(1−e^(−raw/K))`)
  would fix it; monotonic and correct today, so post-ship (ripples through
  score/badge/OG tests).
- Roast-tone toggle for serious findings · hosted GitHub App / PR bot · org
  dashboards · accounts / score history · leaderboards · re-fighting Scorecard ·
  general code-quality metrics.

## Open questions for a future panel

- Branding: does "repo-roast" survive for the serious surface, or does the
  auditor get its own name with roast as a mode?
- After the moat + remediation loop ship: measure whether the "AI repos need
  auditing" thesis shows retention (repeat scans, fix-click-through) before
  investing in CLI/CI distribution.
