/** Render a shields.io-style SVG badge with no dependencies. */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Approx text width (px) at 11px Verdana — good enough for badge sizing. */
function textWidth(s: string): number {
  return s.length * 6.5 + 10;
}

export interface BadgeOptions {
  label: string;
  message: string;
  /** hex or CSS color for the message half */
  color: string;
}

export function renderBadge({ label, message, color }: BadgeOptions): string {
  const lw = Math.ceil(textWidth(label));
  const mw = Math.ceil(textWidth(message));
  const w = lw + mw;
  const lx = (lw / 2) * 10;
  const mx = (lw + mw / 2) * 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(message)}">
  <title>${esc(label)}: ${esc(message)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${mw}" height="20" fill="${esc(color)}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="110" text-rendering="geometricPrecision">
    <text x="${lx}" y="150" transform="scale(.1)" fill="#000" fill-opacity=".3">${esc(label)}</text>
    <text x="${lx}" y="140" transform="scale(.1)">${esc(label)}</text>
    <text x="${mx}" y="150" transform="scale(.1)" fill="#000" fill-opacity=".3">${esc(message)}</text>
    <text x="${mx}" y="140" transform="scale(.1)">${esc(message)}</text>
  </g>
</svg>`;
}

/** Burn-score color: green (clean) → amber → red (fire). */
export function scoreColor(score: number): string {
  if (score >= 70) return "#e5484d";
  if (score >= 45) return "#e2a336";
  if (score >= 20) return "#d4c04a";
  if (score >= 1) return "#8fbf6f";
  return "#3fb950";
}
