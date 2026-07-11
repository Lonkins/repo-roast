import { describe, expect, test } from "vitest";
import { parseTarget, targetToSlug } from "./target";

describe("parseTarget", () => {
  test("parses a bare username as a profile target", () => {
    const r = parseTarget("octocat");
    expect(r.ok && r.target).toEqual({ kind: "profile", owner: "octocat" });
  });

  test("parses owner/repo as a repo target", () => {
    const r = parseTarget("octocat/hello-world");
    expect(r.ok && r.target).toEqual({
      kind: "repo",
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("parses a full github URL", () => {
    const r = parseTarget("https://github.com/octocat/Hello-World");
    expect(r.ok && r.target).toEqual({
      kind: "repo",
      owner: "octocat",
      repo: "Hello-World",
    });
  });

  test("strips .git and trailing paths", () => {
    const r = parseTarget("github.com/octocat/hello-world.git");
    expect(r.ok && r.target).toEqual({
      kind: "repo",
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("ignores a /tree/branch suffix", () => {
    const r = parseTarget("https://github.com/octocat/hello-world/tree/main");
    expect(r.ok && r.target).toEqual({
      kind: "repo",
      owner: "octocat",
      repo: "hello-world",
    });
  });

  test("rejects empty input", () => {
    expect(parseTarget("   ").ok).toBe(false);
  });

  test("rejects an invalid username", () => {
    expect(parseTarget("has spaces").ok).toBe(false);
    expect(parseTarget("bad!name").ok).toBe(false);
  });

  test("targetToSlug round-trips", () => {
    const r = parseTarget("octocat/hello-world");
    expect(r.ok && targetToSlug(r.target)).toBe("octocat/hello-world");
  });
});
