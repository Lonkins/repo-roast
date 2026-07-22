import type { RoastProvider } from "./types";
import { templateRoaster } from "./template-roaster";
import {
  anthropicBackend,
  createLlmRoaster,
  ollamaBackend,
  openaiBackend,
} from "./llm-roaster";
import { claudeCliBackend } from "./claude-cli-roaster";

export type { Roast, RoastLine, RoastProvider } from "./types";
export { templateRoaster } from "./template-roaster";

/**
 * Select the roast provider from environment. Default and fallback is the
 * bundled template roaster — the app is always funny with zero spend. A
 * misconfigured LLM provider degrades to the template roaster rather than
 * failing the request.
 */
export function getRoaster(
  env: Record<string, string | undefined> = process.env,
): RoastProvider {
  const provider = (env.ROAST_PROVIDER ?? "template").toLowerCase();

  switch (provider) {
    case "anthropic": {
      const model = env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
      // Prefer a Claude OAuth bearer token (reuse an existing login) over a
      // pasted API key. Source it from the supported CLI, e.g.
      // `ant auth print-credentials --access-token`; it is short-lived.
      if (env.ANTHROPIC_AUTH_TOKEN) {
        return createLlmRoaster(
          anthropicBackend(env.ANTHROPIC_AUTH_TOKEN, model, true),
        );
      }
      if (env.ANTHROPIC_API_KEY) {
        return createLlmRoaster(anthropicBackend(env.ANTHROPIC_API_KEY, model));
      }
      return templateRoaster;
    }
    // Reuse the local `claude` CLI's own auth — no key or token in repo-roast.
    case "claude-cli":
      return createLlmRoaster(claudeCliBackend(env.CLAUDE_CLI_BIN));
    case "openai":
      if (env.OPENAI_API_KEY) {
        return createLlmRoaster(
          openaiBackend(env.OPENAI_API_KEY, env.OPENAI_MODEL ?? "gpt-4o-mini"),
        );
      }
      return templateRoaster;
    case "ollama":
      return createLlmRoaster(
        ollamaBackend(
          env.OLLAMA_URL ?? "http://localhost:11434",
          env.OLLAMA_MODEL ?? "llama3.2",
        ),
      );
    default:
      return templateRoaster;
  }
}
