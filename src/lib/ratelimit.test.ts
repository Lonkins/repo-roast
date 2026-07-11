import { describe, expect, test } from "vitest";
import { clientIp, createRateLimiter } from "./ratelimit";

describe("createRateLimiter", () => {
  test("allows up to capacity then blocks", () => {
    const rl = createRateLimiter(3, 60);
    const t = 1_000_000;
    expect(rl.check("a", t).allowed).toBe(true);
    expect(rl.check("a", t).allowed).toBe(true);
    expect(rl.check("a", t).allowed).toBe(true);
    expect(rl.check("a", t).allowed).toBe(false);
  });

  test("keys are independent", () => {
    const rl = createRateLimiter(1, 60);
    const t = 2_000_000;
    expect(rl.check("a", t).allowed).toBe(true);
    expect(rl.check("b", t).allowed).toBe(true);
  });

  test("refills over time", () => {
    const rl = createRateLimiter(1, 60); // 1 token/sec
    const t = 3_000_000;
    expect(rl.check("a", t).allowed).toBe(true);
    expect(rl.check("a", t).allowed).toBe(false);
    // 1.1s later a token is back
    expect(rl.check("a", t + 1100).allowed).toBe(true);
  });

  test("reports a retry-after when blocked", () => {
    const rl = createRateLimiter(1, 60);
    const t = 4_000_000;
    rl.check("a", t);
    const blocked = rl.check("a", t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("clientIp", () => {
  test("takes the first x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  test("falls back to x-real-ip then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
