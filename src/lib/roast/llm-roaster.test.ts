import { describe, expect, test, vi } from "vitest";
import {
  anthropicBackend,
  createLlmRoaster,
  type LlmBackend,
} from "./llm-roaster";
import { getRoaster } from "./index";
import { CLEAN_REPORT, MESSY_REPORT } from "./fixtures";

function backend(reply: string | (() => Promise<string>)): LlmBackend {
  return {
    name: "test-llm",
    complete: async () => (typeof reply === "string" ? reply : reply()),
  };
}

describe("createLlmRoaster", () => {
  test("uses model burns when returned, keyed by finding id", async () => {
    const ids = MESSY_REPORT.findings.map((f) => f.id);
    const reply = JSON.stringify(
      ids.map((id) => ({ id, burn: `burn for ${id}` })),
    );
    const roaster = createLlmRoaster(backend(reply));
    const roast = await roaster.roast(MESSY_REPORT);
    expect(roast.lines.map((l) => l.burn)).toEqual(
      ids.map((id) => `burn for ${id}`),
    );
  });

  test("always uses the deterministic fix, never model output", async () => {
    const reply = JSON.stringify([
      { id: MESSY_REPORT.findings[0]!.id, burn: "haha", fix: "MODEL FIX" },
    ]);
    const roaster = createLlmRoaster(backend(reply));
    const roast = await roaster.roast(MESSY_REPORT);
    expect(roast.lines[0]?.fix).toBe(MESSY_REPORT.findings[0]?.fix);
  });

  test("falls back to a template burn for findings the model skipped", async () => {
    const only = MESSY_REPORT.findings[0]!;
    const reply = JSON.stringify([{ id: only.id, burn: "covered" }]);
    const roaster = createLlmRoaster(backend(reply));
    const roast = await roaster.roast(MESSY_REPORT);
    expect(roast.lines).toHaveLength(MESSY_REPORT.findings.length);
    expect(roast.lines[0]?.burn).toBe("covered");
    // uncovered findings still get a non-empty burn
    expect(roast.lines[1]?.burn.length).toBeGreaterThan(0);
  });

  test("degrades to templates on a backend error", async () => {
    const roaster = createLlmRoaster(
      backend(() => Promise.reject(new Error("boom"))),
    );
    const roast = await roaster.roast(MESSY_REPORT);
    expect(roast.lines).toHaveLength(MESSY_REPORT.findings.length);
  });

  test("degrades to templates on unparseable output", async () => {
    const roaster = createLlmRoaster(backend("not json at all"));
    const roast = await roaster.roast(MESSY_REPORT);
    // every line still present with a fallback burn
    expect(roast.lines.every((l) => l.burn.length > 0)).toBe(true);
  });

  test("never invents lines for a clean report", async () => {
    const roaster = createLlmRoaster(backend("[]"));
    const roast = await roaster.roast(CLEAN_REPORT);
    expect(roast.lines).toHaveLength(0);
  });
});

describe("getRoaster", () => {
  test("defaults to the template roaster with no env", () => {
    expect(getRoaster({}).name).toBe("template");
  });

  test("falls back to template when anthropic is selected without a key", () => {
    expect(getRoaster({ ROAST_PROVIDER: "anthropic" }).name).toBe("template");
  });

  test("selects anthropic when a key is present", () => {
    expect(
      getRoaster({ ROAST_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "x" }).name,
    ).toBe("anthropic");
  });

  test("selects ollama without needing a key", () => {
    expect(getRoaster({ ROAST_PROVIDER: "ollama" }).name).toBe("ollama");
  });

  test("selects anthropic with only an OAuth token (no api key)", () => {
    expect(
      getRoaster({ ROAST_PROVIDER: "anthropic", ANTHROPIC_AUTH_TOKEN: "t" })
        .name,
    ).toBe("anthropic");
  });

  test("selects the claude-cli provider without a key", () => {
    expect(getRoaster({ ROAST_PROVIDER: "claude-cli" }).name).toBe(
      "claude-cli",
    );
  });
});

describe("anthropicBackend auth", () => {
  function captureFetch(): { headers: () => Record<string, string> } {
    let seen: Record<string, string> = {};
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      seen = init.headers as Record<string, string>;
      return {
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "[]" }] }),
      } as Response;
    });
    return { headers: () => seen };
  }

  test("uses x-api-key by default", async () => {
    const cap = captureFetch();
    await anthropicBackend("KEY", "m").complete("s", "u");
    vi.unstubAllGlobals();
    expect(cap.headers()["x-api-key"]).toBe("KEY");
    expect(cap.headers().authorization).toBeUndefined();
  });

  test("uses a Bearer token + oauth beta header when useOAuth is set", async () => {
    const cap = captureFetch();
    await anthropicBackend("TOK", "m", true).complete("s", "u");
    vi.unstubAllGlobals();
    expect(cap.headers().authorization).toBe("Bearer TOK");
    expect(cap.headers()["anthropic-beta"]).toBe("oauth-2025-04-20");
    expect(cap.headers()["x-api-key"]).toBeUndefined();
  });
});
