# repo-roast 🔥

**Roast the security posture of any GitHub profile or repo — deterministic scan, comedic delivery, self-hostable for private repos.**

repo-roast finds real security problems — secrets in commit history, dangerous GitHub Actions workflows, vulnerable dependencies, repo-hygiene tells — and delivers them as a roast. The findings are deterministic (gitleaks, OSV.dev, GitHub API; no LLM required). The comedy is a layer on top: a bundled template roaster works with zero spend and zero network, or bring your own LLM key for freeform wit.

> Status: under construction. Watch this space.

## The ethics note (read this first)

**repo-roast punches up at the code, never down at the person.**

- Every joke targets a *finding* — a file, a workflow, a dependency — never the human who wrote it.
- Every finding ships with a real, actionable fix. The roast is the sugar; the fix is the medicine.
- Public mode uses only public data. Private mode scans **your own** repos, with your own token, on your own instance.
- A clean repo gets a (grudgingly) complimentary roast. We never invent flaws for laughs.

If a roast ever reads as mean rather than funny, that is a bug — please file it.

## License

[Apache-2.0](LICENSE)
