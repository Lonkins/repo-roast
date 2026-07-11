import type { RoastProvider } from "./types";
import { templateRoaster } from "./template-roaster";
import {
  anthropicBackend,
  createLlmRoaster,
  ollamaBackend,
  openaiBackend,
} from "./llm-roaster";

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
    case "anthropic":
      if (env.ANTHROPIC_API_KEY) {
        return createLlmRoaster(
          anthropicBackend(
            env.ANTHROPIC_API_KEY,
            env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
          ),
        );
      }
      return templateRoaster;
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
