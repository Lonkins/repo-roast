import { describe, expect, test } from "vitest";
import { isPrivateModeConfigured } from "./auth-config";

describe("isPrivateModeConfigured", () => {
  test("false with no env", () => {
    expect(isPrivateModeConfigured({})).toBe(false);
  });

  test("false when only some vars are set", () => {
    expect(isPrivateModeConfigured({ AUTH_GITHUB_ID: "x" })).toBe(false);
    expect(
      isPrivateModeConfigured({ AUTH_GITHUB_ID: "x", AUTH_GITHUB_SECRET: "y" }),
    ).toBe(false);
  });

  test("true when id, secret and AUTH_SECRET are all present", () => {
    expect(
      isPrivateModeConfigured({
        AUTH_GITHUB_ID: "x",
        AUTH_GITHUB_SECRET: "y",
        AUTH_SECRET: "z",
      }),
    ).toBe(true);
  });

  test("accepts the GITHUB_ID/GITHUB_SECRET aliases", () => {
    expect(
      isPrivateModeConfigured({
        GITHUB_ID: "x",
        GITHUB_SECRET: "y",
        AUTH_SECRET: "z",
      }),
    ).toBe(true);
  });
});
