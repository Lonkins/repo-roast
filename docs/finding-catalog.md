# Finding catalog

Every finding repo-roast can raise, what it means, and the fix that ships with it. Findings are **deterministic** — produced by a scanner rule with evidence, never by the LLM. The comedy layer only phrases what's here.

Every finding also ships two things beyond the fix: a plain-language **why it bites** (the concrete failure it leads to) and an **`agentPrompt`** — a copy-paste instruction for your own AI coding agent (Cursor, Claude Code, Copilot) to apply the fix in your repo. Secret _values_ are never included in any field.

The four AI-authorship scanners — **slopsquat**, **exposure**, **agents**, **claims** — target the mistakes an AI-assisted build ships that a vulnerability database will never list. See [ADR 0002](adr/0002-ai-authorship-audit-pivot.md) for why those, and not a re-skin of an existing linter.

Severity feeds the **burn score** (critical 25 · high 15 · medium 8 · low 3 · info 1, capped at 100).

## Secrets (`secrets/*`)

| id                                  | severity | what it means                                                                                                                                                  | fix                                                                                                                                        |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `secrets/committed-dotenv`          | high     | A `.env` file is tracked in the repo (`.env.example`/`.sample`/`.template` are allowed). Env files usually hold credentials in plaintext.                      | Remove it, `.gitignore` it, commit a redacted `.example`, rotate every credential it held, and purge it from history with git-filter-repo. |
| `secrets/leaked-credential`         | critical | A credential-shaped, high-entropy value is present in a file still in the tree (AWS/GitHub/Stripe/OpenAI/Anthropic/Google/npm/Slack keys, private keys, JWTs). | Rotate the credential immediately, remove it from code, purge from history, force-push, invalidate old clones.                             |
| `secrets/leaked-credential-history` | critical | A secret was committed then deleted from the current tree — but it's still recoverable in git history. Deleting the file did not remove the secret.            | Same as above: rotate first (assume compromised), then purge from history — git remembers.                                                 |

Detection: on self-host, the **gitleaks binary over a full clone** (gitleaks' own ruleset). On serverless, a **GitHub API blob-walk** with a bundled subset of high-signal rules over recent history. The report states which ran.

## GitHub Actions workflows (`workflows/*`)

| id                                       | severity | what it means                                                                                                                                                               | fix                                                                                                                                                                                              |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workflows/pull-request-target-checkout` | critical | A workflow triggered by `pull_request_target` checks out the untrusted PR head. It runs with repo secrets and a write token against attacker-authored code — a classic RCE. | Use `pull_request`, or split into an untrusted build (`pull_request`, uploads an artifact) + a trusted `workflow_run` that consumes it. Never check out the PR head under `pull_request_target`. |
| `workflows/broad-permissions`            | high     | The workflow token grants `write-all` (or broad write across many scopes). A compromised step or dependency can push code, publish releases, or tamper with the repo.       | Set `permissions: {}` at the top; grant least privilege per job (e.g. `contents: read`), adding write only where needed.                                                                         |
| `workflows/script-injection`             | high     | Attacker-controlled `${{ github.event.* }}` text (PR/issue title, body, comment, branch name) is interpolated directly into a `run:` shell. A crafted title runs commands.  | Pass the value through an intermediate `env:` var and reference `"$VAR"` in the script, so the shell treats it as data.                                                                          |
| `workflows/unpinned-action`              | medium   | A third-party action is pinned to a floating tag (`@main`, `@v3`) instead of a full commit SHA. The maintainer (or someone who compromises them) can change what runs.      | Pin to a 40-char commit SHA (`uses: owner/action@<sha>  # v3`); let Dependabot bump it. First-party `actions/*` and `github/*` are exempt.                                                       |

## Dependencies (`deps/*`)

| id                         | severity | what it means                                                                                                                                                                                  | fix                                                                                                                              |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `deps/known-vulnerability` | high     | A resolved dependency matches a public advisory in OSV.dev. Ecosystems: npm (`package-lock.json`, exact-pinned `package.json`), PyPI (`requirements.txt` `==` pins), crates.io (`Cargo.lock`). | Upgrade to a patched version (check the advisory's fixed range), regenerate the lockfile, and automate with Dependabot/Renovate. |

## Hallucinated & typosquatted dependencies (`slopsquat/*`)

Where `deps` asks "is this package _known-vulnerable_", `slopsquat` asks "is this package _real_". It resolves every declared npm/PyPI dependency against the live registry — existence, age, version count, edit-distance to a famous name — and never guesses (a network failure yields no finding, only a definitive 404 counts).

| id                                 | severity | what it means                                                                                                                                                        | fix                                                                                                                         |
| ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `slopsquat/nonexistent-dependency` | critical | A declared dependency does not exist on its registry — an AI hallucinated the name. An attacker can register the empty name with malware (slopsquatting).            | Remove or correct it; if a popular name is one edit away, that's likely what was meant. Never install an unverifiable name. |
| `slopsquat/typosquat-suspect`      | high     | A dependency is one character from a popular package but is itself obscure and barely published — the classic typosquat shape.                                       | Confirm you meant the popular package; if the odd name was deliberate, verify its publisher.                                |
| `slopsquat/newborn-dependency`     | medium   | A dependency was first published within ~30 days and has very few versions — no track record, and a possible slopsquat landing pad. High if it runs install scripts. | Confirm the package and publisher are what you intended; pin an exact version and review the source.                        |

## Insecure defaults & client-side exposure (`exposure/*`)

The insecure defaults an AI code generator ships. Detected over a bounded set of env/config/source files; secret _values_ are redacted (a var's _name_ is evidence).

| id                                     | severity        | what it means                                                                                                                                                                                                               | fix                                                                                             |
| -------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `exposure/secret-behind-public-prefix` | critical / high | A server secret sits behind a browser-exposed env prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, …) — it ships in the client bundle. Name-based, so ambiguous words (API_KEY, TOKEN) are excluded to avoid false positives. | Drop the public prefix, read it only in server code, and rotate if it was ever committed.       |
| `exposure/llm-key-in-browser`          | critical        | An LLM SDK is initialized with `dangerouslyAllowBrowser: true`, baking the provider API key into the page.                                                                                                                  | Move LLM calls server-side; the client calls your endpoint. Remove the flag and rotate the key. |
| `exposure/permissive-cors`             | medium / high   | `Access-Control-Allow-Origin: *` (or `origin: "*"`/`true`). Escalated to high when combined with credentials — the one combination CORS forbids.                                                                            | Replace the wildcard with an explicit allowlist of trusted origins.                             |
| `exposure/unsafe-eval-csp`             | medium          | A Content-Security-Policy that includes `'unsafe-eval'`, re-enabling `eval()` and handing an injected script the tool it needs.                                                                                             | Remove `'unsafe-eval'`; replace or isolate any dependency that truly needs it.                  |

## AI agent & MCP configuration (`agents/*`)

The attack surface no other tool audits: the config that tells an AI coding agent what it may run and connect to. A bad default here turns ordinary prompt injection into code execution.

| id                               | severity | what it means                                                                                                                                                                           | fix                                                                                                   |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `agents/auto-approved-execution` | high     | An agent runs without a human approval gate: `--dangerously-skip-permissions`, `bypassPermissions`, `autoApprove`/`alwaysAllow`, `Bash(*)`. Any content it reads can then run commands. | Require confirmation for shell/file-write tools; scope automation to an explicit command allowlist.   |
| `agents/unpinned-mcp-server`     | medium   | An MCP server is launched via an unpinned package runner (`npx -y`, `uvx`, …) — it runs whatever the latest published version is, with your env and secrets.                            | Pin the server to an exact reviewed version; prefer trusted publishers.                               |
| `agents/remote-mcp-server`       | medium   | The MCP client trusts a non-local server. A remote server supplies the tool definitions your agent trusts and can poison them or exfiltrate context.                                    | Confirm you control/trust the host; prefer local servers for anything sensitive, and pin the version. |
| `agents/hardcoded-mcp-secret`    | high     | A literal credential is committed inside an MCP `env`/`headers` block, rather than an environment reference.                                                                            | Replace it with an env reference, move the real value to an untracked `.env`, and rotate it.          |

## Claims vs. reality (`claims/*`)

Does the repo do what the README says? Each check compares a claim in the docs against a fact in the repo.

| id                               | severity      | what it means                                                                                                                                                                                        | fix                                                                            |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `claims/undefined-script`        | high / medium | The README documents a command (`npm test`, `pnpm build`, …) that package.json defines no script for — or the `test` script is still the `npm init` "no test specified" placeholder. `test` is high. | Add the script, or fix the README so the docs and scripts agree.               |
| `claims/broken-ci-badge`         | medium        | A CI badge points at `.github/workflows/<file>` that doesn't exist — it renders broken or misleadingly green.                                                                                        | Add the workflow, repoint the badge at a real one, or remove it.               |
| `claims/decorative-status-badge` | low           | A hardcoded shields.io coverage/build/tests badge that measures nothing — it stays green regardless of reality.                                                                                      | Wire it to a real source (a workflow badge, or Codecov/Coveralls), or drop it. |

## Repo hygiene (`hygiene/*`)

| id                            | severity | what it means                                                                                                                                                                                            | fix                                                                                               |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `hygiene/suspicious-file`     | high     | A tracked file that usually shouldn't be in a repo: `id_rsa`/`id_dsa`, `.pem`/`.pfx`/`.p12`/keystores, `credentials.json`, service-account keys, `.npmrc`/`.pypirc`, `backup.sql`/`*.sql.gz`/`dump.rdb`. | Remove it, `.gitignore` the pattern, purge from history, and rotate anything it may have exposed. |
| `hygiene/committed-artifacts` | low      | Generated build/dependency output is committed: `node_modules/`, `dist/`, `build/`, `.venv/`, `__pycache__/`. Bloats the repo and creates noisy diffs.                                                   | `.gitignore` it and `git rm -r --cached <dir>`.                                                   |
| `hygiene/missing-security-md` | info     | No `SECURITY.md` (or `.github/SECURITY.md`), so finders have no private way to report a vulnerability.                                                                                                   | Add a `SECURITY.md` with a contact and expected response time; GitHub links it automatically.     |
| `hygiene/missing-license`     | info     | A **public** repo with no `LICENSE`/`COPYING`. Default copyright is "all rights reserved" — nobody legally knows what they can do with it. (Skipped for private repos.)                                  | Add a `LICENSE` (see choosealicense.com).                                                         |

## A clean repo

If nothing above fires, the burn score is 0, the grade is "Suspiciously clean", and the roaster returns a **grudgingly complimentary** roast. repo-roast never invents a flaw for a laugh — see [ethics.md](ethics.md).
