# Finding catalog

Every finding repo-roast can raise, what it means, and the fix that ships with it. Findings are **deterministic** — produced by a scanner rule with evidence, never by the LLM. The comedy layer only phrases what's here.

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

## Repo hygiene (`hygiene/*`)

| id                            | severity | what it means                                                                                                                                                                                            | fix                                                                                               |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `hygiene/suspicious-file`     | high     | A tracked file that usually shouldn't be in a repo: `id_rsa`/`id_dsa`, `.pem`/`.pfx`/`.p12`/keystores, `credentials.json`, service-account keys, `.npmrc`/`.pypirc`, `backup.sql`/`*.sql.gz`/`dump.rdb`. | Remove it, `.gitignore` the pattern, purge from history, and rotate anything it may have exposed. |
| `hygiene/committed-artifacts` | low      | Generated build/dependency output is committed: `node_modules/`, `dist/`, `build/`, `.venv/`, `__pycache__/`. Bloats the repo and creates noisy diffs.                                                   | `.gitignore` it and `git rm -r --cached <dir>`.                                                   |
| `hygiene/missing-security-md` | info     | No `SECURITY.md` (or `.github/SECURITY.md`), so finders have no private way to report a vulnerability.                                                                                                   | Add a `SECURITY.md` with a contact and expected response time; GitHub links it automatically.     |
| `hygiene/missing-license`     | info     | A **public** repo with no `LICENSE`/`COPYING`. Default copyright is "all rights reserved" — nobody legally knows what they can do with it. (Skipped for private repos.)                                  | Add a `LICENSE` (see choosealicense.com).                                                         |

## A clean repo

If nothing above fires, the burn score is 0, the grade is "Suspiciously clean", and the roaster returns a **grudgingly complimentary** roast. repo-roast never invents a flaw for a laugh — see [ethics.md](ethics.md).
