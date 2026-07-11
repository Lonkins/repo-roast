import { NextResponse } from "next/server";
import { parseTarget } from "@/lib/target";
import { scanAndRoast } from "@/lib/scan-service";
import { clientIp, publicScanLimiter } from "@/lib/ratelimit";

/**
 * JSON scan API: GET /api/roast?target=<username|owner/repo>
 * Public data only; per-IP throttled. Powers programmatic use and tooling.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("target") ?? "";

  const parsed = parseTarget(target);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const limit = publicScanLimiter.check(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  const outcome = await scanAndRoast(parsed.target);
  if (!outcome.ok) {
    const status = outcome.error.kind === "not-found" ? 404 : 502;
    return NextResponse.json({ error: outcome.error.message }, { status });
  }

  return NextResponse.json({
    target: parsed.target,
    burnScore: outcome.report.burnScore,
    grade: outcome.report.grade,
    findings: outcome.report.findings,
    roast: outcome.roast,
    scannedAt: outcome.report.scannedAt,
  });
}
