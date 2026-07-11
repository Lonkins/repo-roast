import type { Metadata } from "next";
import "./globals.css";

// Absolute base for OG/Twitter image URLs. Set NEXT_PUBLIC_SITE_URL in prod.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "repo-roast — your security posture, but funny",
  description:
    "Deterministic security scan of any GitHub profile or repo, delivered as a roast. Real findings, real fixes, zero mercy for committed .env files.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
