import { describe, expect, test } from "vitest";
import { templateRoaster } from "./template-roaster";
import { CLEAN_REPORT, MESSY_REPORT } from "./fixtures";

describe("templateRoaster", () => {
  test("produces one line per finding, each carrying its real fix", async () => {
    const roast = await templateRoaster.roast(MESSY_REPORT);
    expect(roast.lines).toHaveLength(MESSY_REPORT.findings.length);
    for (const line of roast.lines) {
      expect(line.burn.length).toBeGreaterThan(0);
      expect(line.fix.length).toBeGreaterThan(0);
    }
  });

  test("is deterministic — same report yields the same roast", async () => {
    const a = await templateRoaster.roast(MESSY_REPORT);
    const b = await templateRoaster.roast(MESSY_REPORT);
    expect(a).toEqual(b);
  });

  test("burns map to the finding they roast", async () => {
    const roast = await templateRoaster.roast(MESSY_REPORT);
    const ids = roast.lines.map((l) => l.findingId);
    expect(ids).toEqual(MESSY_REPORT.findings.map((f) => f.id));
  });

  test("a clean report gets a complimentary roast, not invented flaws", async () => {
    const roast = await templateRoaster.roast(CLEAN_REPORT);
    expect(roast.lines).toHaveLength(0);
    expect(roast.intro.length).toBeGreaterThan(0);
    expect(roast.intro.toLowerCase()).toMatch(
      /clean|nothing|empty|spotless|awkward/,
    );
  });

  test("names the provider as template", async () => {
    const roast = await templateRoaster.roast(MESSY_REPORT);
    expect(roast.provider).toBe("template");
  });

  test("intro reflects a hot burn score", async () => {
    const roast = await templateRoaster.roast(MESSY_REPORT);
    expect(roast.intro.length).toBeGreaterThan(0);
  });
});
