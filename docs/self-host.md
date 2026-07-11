# Deploy your own repo-roast

repo-roast is self-hostable at **zero cost**. This guide covers the two supported paths — Docker (full strength) and Vercel free tier — plus registering a GitHub OAuth App for **private mode**, and wiring an optional LLM.

Nothing here requires paid hosting, a paid API, or a custom domain.

## What you get where

| Capability                       | Docker self-host                                | Vercel free tier               |
| -------------------------------- | ----------------------------------------------- | ------------------------------ |
| Public roast (any username/repo) | ✅                                              | ✅                             |
| Secrets scan strategy            | **gitleaks over full history** (binary bundled) | API blob-walk (recent history) |
| Private mode (your own repos)    | ✅ with your OAuth App                          | ✅ with your OAuth App         |
| Comedy                           | template (default) / BYO LLM / local Ollama     | template / BYO LLM             |
| Cost                             | $0                                              | $0                             |

The Docker image bundles the `gitleaks` binary and `git`, so it runs the authoritative full-history secret scan. Vercel has no binary and an ephemeral filesystem, so it uses the bundled-rules API blob-walk — weaker, but the report says which strategy ran.

## 1. Docker (recommended)

```bash
git clone https://github.com/Lonkins/repo-roast.git
cd repo-roast
cp .env.example .env      # optional — public mode works with an empty file
docker compose up --build
# open http://localhost:3000
```

That's it. Everything in `.env` is optional; with none of it set you get the full public roast with the bundled template roaster.

### Docker without compose

```bash
docker build -t repo-roast .
docker run -p 3000:3000 --env-file .env repo-roast
```

## 2. Vercel free tier

1. Fork the repo.
2. Import it at [vercel.com/new](https://vercel.com/new) — Next.js is auto-detected (`vercel.json` pins the commands).
3. Add environment variables (all optional; see below) in the Vercel project settings.
4. Deploy.

Set `NEXT_PUBLIC_SITE_URL` to your deployment URL so OG/Twitter share cards resolve to absolute URLs.

## 3. Environment variables

All optional. Copy `.env.example` to `.env` (Docker) or set them in Vercel.

| Variable                                | Purpose                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`                          | Raises public-mode GitHub API limits (60→5000/h). A **fine-grained token with public-repo read only** — no scopes needed. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | Your GitHub OAuth App (private mode). See below.                                                                          |
| `AUTH_SECRET`                           | Session-cookie encryption key. Generate with `openssl rand -base64 32`.                                                   |
| `AUTH_URL`                              | Public origin of your instance, e.g. `https://roast.example.com`.                                                         |
| `ROAST_PROVIDER`                        | `template` (default) · `anthropic` · `openai` · `ollama`.                                                                 |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`  | BYO key for the LLM comedy layer.                                                                                         |
| `OLLAMA_URL` / `OLLAMA_MODEL`           | Point at a local Ollama for zero-cost freeform wit.                                                                       |
| `NEXT_PUBLIC_SITE_URL`                  | Absolute base for share-card image URLs.                                                                                  |

## 4. Private mode — register a GitHub OAuth App

Private mode lets a signed-in user scan **their own private repos**. It needs a GitHub OAuth App **you** register (free). This is the one manual credential step.

1. Go to [github.com/settings/applications/new](https://github.com/settings/applications/new).
2. **Application name:** anything (e.g. "my repo-roast").
3. **Homepage URL:** your instance origin, e.g. `http://localhost:3000`.
4. **Authorization callback URL:** `<origin>/api/auth/callback/github`
   — e.g. `http://localhost:3000/api/auth/callback/github`.
5. Register, then **Generate a new client secret**.
6. Set the env vars:

   ```bash
   AUTH_GITHUB_ID=<client id>
   AUTH_GITHUB_SECRET=<client secret>
   AUTH_SECRET=$(openssl rand -base64 32)
   AUTH_URL=http://localhost:3000
   ```

7. Restart. `/private` now offers "Sign in with GitHub".

### The token-never-leaves-your-instance guarantee

- The OAuth flow requests `read:user` + `repo` (read your private repos).
- The resulting access token is stored **only** in the encrypted JWT session cookie on your instance — there is no database.
- The token is passed **only** to the scan service, which forwards it **only** to `api.github.com`. It is never sent to any other host, never logged, and never returned to the browser beyond the httpOnly cookie the browser already holds.
- Because you run the instance, "the server" is your machine. Sign out to drop the token; revoke anytime from your [GitHub authorized apps](https://github.com/settings/applications).

If `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`/`AUTH_SECRET` are unset, `/private` shows a "not configured" notice and the public app is unaffected.

## 5. Optional: the LLM comedy layer

The default template roaster is deterministic, funny, and free. To get freeform LLM wit:

- **Local (zero cost):** run [Ollama](https://ollama.com), then set `ROAST_PROVIDER=ollama` and `OLLAMA_MODEL=llama3.2`.
- **BYO cloud key:** set `ROAST_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`, or `ROAST_PROVIDER=openai` + `OPENAI_API_KEY`.

The LLM only **phrases** the deterministic findings; it never invents a vulnerability, and the concrete fixes always come from the scanner, not the model. Any LLM error degrades gracefully to the template roaster.

## 6. Health check

```bash
curl "http://localhost:3000/api/roast?target=octocat/Spoon-Knife"
```

A JSON report with `burnScore`, `findings`, and `roast` means you're live.
