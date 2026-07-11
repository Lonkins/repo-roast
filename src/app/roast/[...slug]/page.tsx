import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { parseTarget, targetToSlug } from "@/lib/target";
import { scanAndRoast } from "@/lib/scan-service";
import { clientIp, publicScanLimiter } from "@/lib/ratelimit";
import { RoastResult } from "@/components/RoastResult";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

function slugToInput(slug: string[]): string {
  return slug.map((s) => decodeURIComponent(s)).join("/");
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const input = slugToInput(slug);
  const title = `Roast of ${input} — repo-roast`;
  const description = `A deterministic security roast of ${input}: real findings, real fixes, comedic delivery.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/roast/${slug.join("/")}/opengraph-image`],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8">
        <Link
          href="/"
          className="text-sm font-bold text-[var(--color-ember)] hover:underline"
        >
          ← repo-roast
        </Link>
      </nav>
      {children}
    </main>
  );
}

function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border-[3px] border-[var(--color-ink)] bg-[var(--color-stage-raised)] p-8 text-center">
      <p className="text-3xl">🫤</p>
      <h1 className="mt-2 text-2xl font-black">{title}</h1>
      <p className="mt-2 text-[var(--color-ink-dim)]">{body}</p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-md border-[3px] border-[var(--color-ink)] bg-[var(--color-ember)] px-4 py-2 font-bold text-[var(--color-stage)]"
      >
        Try another
      </Link>
    </div>
  );
}

export default async function RoastPage({ params }: PageProps) {
  const { slug } = await params;
  const input = slugToInput(slug);

  const parsed = parseTarget(input);
  if (!parsed.ok) {
    return (
      <Shell>
        <ErrorState title="That doesn't look right" body={parsed.error} />
      </Shell>
    );
  }

  // Per-IP throttle before doing any GitHub work.
  const ip = clientIp(await headers());
  const limit = publicScanLimiter.check(ip);
  if (!limit.allowed) {
    return (
      <Shell>
        <ErrorState
          title="Easy, tiger"
          body={`You're roasting fast. Try again in about ${limit.retryAfterSec}s.`}
        />
      </Shell>
    );
  }

  const outcome = await scanAndRoast(parsed.target);
  if (!outcome.ok) {
    const titles: Record<string, string> = {
      "not-found": "Not found",
      "rate-limited": "GitHub is rate-limiting us",
      unknown: "That didn't work",
    };
    return (
      <Shell>
        <ErrorState
          title={titles[outcome.error.kind] ?? "That didn't work"}
          body={outcome.error.message}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <RoastResult
        report={outcome.report}
        roast={outcome.roast}
        slug={targetToSlug(parsed.target)}
      />
    </Shell>
  );
}
