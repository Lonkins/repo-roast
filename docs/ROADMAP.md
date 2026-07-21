# Roadmap — AI-authorship pre-ship auditor

Living plan for the autonomous build loop. Direction and rationale: [ADR 0002](adr/0002-ai-authorship-audit-pivot.md).
Each increment is a self-contained, tested step. Check items off as they land.

## Increment 1 — Moat scanners (AI-authorship failure modes)

- [x] **1a. `slopsquat`** — hallucinated / typosquat / newborn dependency
      scanner over real registry data (npm + PyPI). Findings:
      `nonexistent-dependency`, `typosquat-suspect`, `newborn-dependency`.
- [ ] **1b. `exposure`** — secrets-to-client + insecure scaffold defaults
      (`NEXT_PUBLIC_` secret leak, CORS `*`, unsafe CSP, RLS-off, debug routes).
- [ ] **1c. `agents`** — agent/MCP config attack surface (`.mcp.json`,
      `.cursor/`, `.claude/settings*.json`, auto-approve / skip-permissions).
- [ ] **1d. `claims`** — claims-vs-reality (README/badge vs actual scripts,
      workflows, config the code references).

## Increment 2 — Remediation-first output (the differentiator)

- [x] **2a.** Extend `Finding` with optional `why` + `agentPrompt`. (non-breaking)
- [x] **2b.** Populate `why`/`agentPrompt` on existing scanners (deps, workflows,
      hygiene). Remaining: `secrets` (two code paths — blobwalk + gitleaks).
- [x] **2c.** Render `why` + copy-paste `agentPrompt` in the result UI
      (`FindingCard` + `CopyButton`). JSON API already returns them (they live on
      `Finding`, which `/api/roast` serializes wholesale).

## Increment 3 — Local CLI + machine-readable output (pre-ship gate)

- [ ] **3a.** `bin` CLI: scan a local checkout offline; `--format pretty|json|sarif`.
- [ ] **3b.** SARIF renderer (map `Finding` → SARIF result: id→ruleId,
      severity→level, evidence→physicalLocation, fix→fix.description).
- [ ] **3c.** Exit codes + `--fail-on <severity>` for CI-optional use.

## Deferred (panel kill-list — do NOT build without a fresh decision)

Hosted GitHub App / PR-comment bot · org dashboards · accounts / score history ·
leaderboards · re-fighting Scorecard on supply-chain posture · general
code-quality metrics (complexity/coverage/style).

## Open questions for a future panel

- Branding: does "repo-roast" survive for the serious surface, or does the
  auditor get its own name with roast as a mode?
- After the moat + remediation loop ship: measure whether the "AI repos need
  auditing" thesis shows retention (repeat scans, fix-click-through) before
  investing in CLI/CI distribution.
