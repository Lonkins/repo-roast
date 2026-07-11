import { parseTarget } from "@/lib/target";
import { scanAndRoast } from "@/lib/scan-service";
import { clientIp, publicScanLimiter } from "@/lib/ratelimit";
import { renderBadge, scoreColor } from "@/lib/badge";

interface Params {
  params: Promise<{ slug: string[] }>;
}

function svg(body: string, cacheSeconds: number): Response {
  return new Response(body, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // README badges are fetched often — cache hard to protect rate limits.
      "cache-control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
    },
  });
}

/**
 * Live "Roast me" badge: GET /api/badge/<owner>[/<repo>] → an SVG burn-score
 * badge. Cached aggressively so embedding it in a README doesn't hammer the
 * GitHub API.
 */
export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const input = slug.map((s) => decodeURIComponent(s)).join("/");
  const parsed = parseTarget(input);
  if (!parsed.ok) {
    return svg(
      renderBadge({ label: "repo-roast", message: "invalid", color: "#999" }),
      300,
    );
  }

  const limit = publicScanLimiter.check(clientIp(req.headers));
  if (!limit.allowed) {
    return svg(
      renderBadge({
        label: "repo-roast",
        message: "rate limited",
        color: "#999",
      }),
      60,
    );
  }

  const outcome = await scanAndRoast(parsed.target);
  if (!outcome.ok) {
    return svg(
      renderBadge({ label: "repo-roast", message: "n/a", color: "#999" }),
      300,
    );
  }

  const score = outcome.report.burnScore;
  return svg(
    renderBadge({
      label: "🔥 burn score",
      message: String(score),
      color: scoreColor(score),
    }),
    3600,
  );
}
