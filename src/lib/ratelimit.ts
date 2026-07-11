/**
 * In-memory per-key token bucket. Good enough for a single free-tier instance.
 * ponytail: single-process only — multi-instance deploys share no state; swap
 * for Redis/Upstash if you ever run more than one instance.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimiter {
  /** Consume one token; returns whether the request is allowed. */
  check(key: string, now?: number): { allowed: boolean; retryAfterSec: number };
}

export function createRateLimiter(
  capacity: number,
  refillPerMinute: number,
): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = refillPerMinute / 60_000;

  return {
    check(key, now = Date.now()) {
      const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
      const elapsed = now - bucket.updatedAt;
      const tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);

      if (tokens < 1) {
        buckets.set(key, { tokens, updatedAt: now });
        const retryAfterSec = Math.ceil((1 - tokens) / refillPerMs / 1000);
        return { allowed: false, retryAfterSec };
      }

      buckets.set(key, { tokens: tokens - 1, updatedAt: now });
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/** Public-mode limiter: 10 scans burst, refilling 5/min per IP. */
export const publicScanLimiter = createRateLimiter(10, 5);

/** Best-effort client IP from proxy headers, falling back to a shared bucket. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
