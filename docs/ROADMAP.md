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
