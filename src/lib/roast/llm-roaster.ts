import type { ScanReport } from "../engine/types";
import type { Roast, RoastLine, RoastProvider } from "./types";
import { templateRoaster } from "./template-roaster";
import { burnFor, introFor, outroFor } from "./templates";

/** Pluggable text-completion backend — one plain fetch per provider, no SDKs. */
export interface LlmBackend {
  name: string;
  complete(system: string, user: string): Promise<string>;
}

const MAX_LINES = 12;

const SYSTEM = `You are a comedy writer roasting the SECURITY POSTURE of a GitHub repository.
Hard rules:
- Punch UP at the code and the findings, NEVER down at the person. No insults about the developer.
- Only joke about the findings provided. Never invent a vulnerability.
- One short, punchy burn per finding (max ~30 words). Be funny, not mean.
Return ONLY a JSON array like [{"id":"<finding id>","burn":"<one joke>"}]. No prose, no code fences.`;

interface LlmBurn {
  id: string;
  burn: string;
}

function parseBurns(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return map;
  try {
    const arr = JSON.parse(raw.slice(start, end + 1)) as LlmBurn[];
    for (const item of arr) {
      if (
        item &&
        typeof item.id === "string" &&
        typeof item.burn === "string"
      ) {
        map.set(item.id, item.burn.trim());
      }
    }
  } catch {
    // fall through — caller uses template fallback per line
  }
  return map;
}

/**
 * LLM roaster. Sends ONLY the structured findings and asks for one burn each;
 * fixes are always the deterministic finding fixes (never model output). Any
 * finding the model doesn't cover falls back to a template burn, so the result
 * is always complete and always grounded in real findings.
 */
export function createLlmRoaster(backend: LlmBackend): RoastProvider {
  return {
    name: backend.name,
    async roast(report: ScanReport): Promise<Roast> {
      if (report.findings.length === 0) return templateRoaster.roast(report);

      const findings = report.findings.slice(0, MAX_LINES);
      const seed = `${report.target.owner}:${report.burnScore}`;
      const userPrompt = JSON.stringify({
        burnScore: report.burnScore,
        grade: report.grade,
        findings: findings.map((f) => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
        })),
      });

      let burns = new Map<string, string>();
      try {
        burns = parseBurns(await backend.complete(SYSTEM, userPrompt));
      } catch {
        // network/model failure — degrade to templates, still funny
        return templateRoaster.roast(report);
      }

      const lines: RoastLine[] = findings.map((f) => ({
        findingId: f.id,
        // Prefer the model's line; fall back to the deterministic template.
        burn: burns.get(f.id) ?? burnFor(f),
        fix: f.fix, // always the real fix, never model-generated
        severity: f.severity,
      }));

      return {
        intro: introFor(report.burnScore, seed),
        lines,
        outro: outroFor(seed),
        provider: backend.name,
      };
    },
  };
}

/** Anthropic Messages API backend (BYO key). */
export function anthropicBackend(apiKey: string, model: string): LlmBackend {
  return {
    name: "anthropic",
    async complete(system, user) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      return data.content?.map((c) => c.text ?? "").join("") ?? "";
    },
  };
}

/** OpenAI Chat Completions backend (BYO key). */
export function openaiBackend(apiKey: string, model: string): LlmBackend {
  return {
    name: "openai",
    async complete(system, user) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

/** Ollama local backend — no key, no cost, no data leaving the machine. */
export function ollamaBackend(url: string, model: string): LlmBackend {
  return {
    name: "ollama",
    async complete(system, user) {
      const res = await fetch(`${url.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`ollama ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content ?? "";
    },
  };
}
