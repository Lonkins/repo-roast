import type { LlmBackend } from "./llm-roaster";

/** Give the CLI time to answer, but don't hang a scan on it. */
const CLI_TIMEOUT_MS = 60_000;
/** The CLI reply is tiny (a JSON array of burns); cap the buffer generously. */
const MAX_BUFFER = 1024 * 1024;

/**
 * Roast via the locally-installed, already-authenticated `claude` CLI. This
 * reuses whatever auth the operator's Claude Code has (a subscription login or
 * a key) — repo-roast never sees or stores a token. Self-host only, like the
 * gitleaks and Ollama paths. `node:child_process` is imported lazily so this
 * module never pulls Node built-ins into the client bundle.
 */
export function claudeCliBackend(binary = "claude"): LlmBackend {
  return {
    name: "claude-cli",
    async complete(system, user) {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile);
      // execFile (no shell) passes the prompt as a single argv — no injection.
      const prompt = `${system}\n\n${user}`;
      const { stdout } = await run(binary, ["-p", prompt], {
        timeout: CLI_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
      });
      return stdout;
    },
  };
}
