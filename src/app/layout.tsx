import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
