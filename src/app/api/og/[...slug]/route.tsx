import { ImageResponse } from "next/og";
import { parseTarget, targetToSlug } from "@/lib/target";
import { scanAndRoast } from "@/lib/scan-service";
import { SEVERITY_STYLE } from "@/lib/severity";

export const runtime = "nodejs";

const size = { width: 1200, height: 630 };

interface Props {
  params: Promise<{ slug: string[] }>;
}

/**
 * Generated share card: burn score + top burns. Rendered with next/og (no
 * deps). A route handler (not the opengraph-image file convention) because
 * the parent segment is a catch-all, which can't have child segments.
 */
export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params;
  const input = slug.map((s) => decodeURIComponent(s)).join("/");
  const parsed = parseTarget(input);

  const fallback = () =>
    new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#12121a",
          color: "#f5f2ea",
          fontSize: 64,
          fontWeight: 800,
        }}
      >
        repo-roast 🔥
      </div>,
      size,
    );

  if (!parsed.ok) return fallback();

  const outcome = await scanAndRoast(parsed.target);
  if (!outcome.ok) return fallback();

  const { report, roast } = outcome;
  const hue = Math.round(150 - (report.burnScore / 100) * 150);
  const scoreColor = `hsl(${hue}, 70%, 60%)`;
  const topBurns = roast.lines.slice(0, 3);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#12121a",
        color: "#f5f2ea",
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 28, color: "#e8865a", fontWeight: 700 }}>
            repo-roast 🔥
          </span>
          <span style={{ fontSize: 56, fontWeight: 800, marginTop: 8 }}>
            {targetToSlug(parsed.target)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            border: `8px solid ${scoreColor}`,
            borderRadius: 200,
            width: 200,
            height: 200,
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 88, fontWeight: 800, color: scoreColor }}>
            {report.burnScore}
          </span>
          <span style={{ fontSize: 22, color: "#b8b2a6" }}>/ 100</span>
        </div>
      </div>

      <span
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: scoreColor,
          marginTop: 8,
        }}
      >
        {report.grade}
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 28,
          gap: 14,
        }}
      >
        {topBurns.length === 0 ? (
          <span style={{ fontSize: 30, color: "#b8b2a6" }}>
            Suspiciously clean. Nothing to roast. 🧼
          </span>
        ) : (
          topBurns.map((line, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <span style={{ fontSize: 30 }}>
                {SEVERITY_STYLE[line.severity].emoji}
              </span>
              <span style={{ fontSize: 28, color: "#e6e1d6", lineHeight: 1.3 }}>
                {line.burn.length > 90
                  ? line.burn.slice(0, 88) + "…"
                  : line.burn}
              </span>
            </div>
          ))
        )}
      </div>

      <span style={{ marginTop: "auto", fontSize: 22, color: "#8f8a7e" }}>
        {report.findings.length} finding
        {report.findings.length === 1 ? "" : "s"} · every burn ships a fix
      </span>
    </div>,
    size,
  );
}
