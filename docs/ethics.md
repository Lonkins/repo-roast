# The ethics of a roast

repo-roast is a comedy tool pointed at a serious thing. That only works if it stays on the right side of one line, and we treat that line as a hard requirement — not a nicety.

## The one rule

**Punch up at the code, never down at the person.**

- Every joke targets a **finding** — a file, a workflow, a dependency, a commit. Never the human who wrote it.
- People scan their own repos, or opt in. Public mode uses only public data; private mode scans **your own** repos with **your own** token.
- If a roast ever reads as mean rather than funny, that is a **bug**. [File it.](https://github.com/Lonkins/repo-roast/issues)

## Why the restraint is the point

Anyone can generate insults. That's not interesting, and it doesn't help. The reason a security roast is worth building is that the joke is a delivery mechanism for a fix — the sugar around the medicine. Take away the fix and you have meanness; take away the humor and you have another scanner nobody reads. The value is in holding both together, and that only holds if the target is always the code.

## The guarantees, in code

These aren't just aspirations — they're enforced:

1. **Findings are deterministic.** They come from scanner rules with evidence (gitleaks, OSV.dev, the GitHub API), never from an LLM. Comedy can't manufacture a vulnerability.
2. **Every finding ships a fix.** The fix is part of the finding, written by the scanner. Even when an LLM writes the joke, the fix text is always the deterministic one — the model never authors remediation.
3. **A clean repo gets a compliment.** No findings ⇒ no burns ⇒ a grudgingly nice roast. We never fabricate flaws to have something to say.
4. **No shaming individuals.** The system prompt for the LLM path hard-codes "punch up at the code, never down at the person." The template roaster's burns are all aimed at findings.
5. **Read-only, always.** repo-roast never writes to a repo, never posts, and never stores your findings server-side.

## Data & privacy

- **Public mode** processes only public GitHub data and holds no user secrets.
- **Private mode** (self-host) keeps the visitor's OAuth token in an encrypted session cookie on the operator's instance; it is only ever sent to `api.github.com`. See the [self-host guide](self-host.md#the-token-never-leaves-your-instance-guarantee).
- The optional LLM comedy layer is **BYO-key** or a local model. With no key, the bundled template roaster runs — zero data leaves the machine.

If you're using repo-roast in a way that makes the target a person rather than the code, you're using it wrong, and we'd rather you didn't.
