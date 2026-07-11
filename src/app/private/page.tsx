import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { isPrivateModeConfigured } from "@/lib/auth-config";
import { parseTarget, targetToSlug } from "@/lib/target";
import { scanAndRoast } from "@/lib/scan-service";
import { ConsentExplainer } from "@/components/ConsentExplainer";
import { SignInButton, SignOutButton } from "@/components/AuthButtons";
import { PrivateScanForm } from "@/components/PrivateScanForm";
import { RoastResult } from "@/components/RoastResult";

export const metadata: Metadata = {
  title: "Private mode — repo-roast",
  description:
    "Scan your own private GitHub repos. Self-hosted: your token never leaves your instance.",
};

interface PageProps {
  searchParams: Promise<{ target?: string }>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-bold text-[var(--color-ember)] hover:underline"
        >
          ← repo-roast
        </Link>
        <span className="rounded-full border-2 border-[var(--color-mint)] px-3 py-1 text-xs font-bold tracking-widest text-[var(--color-mint)] uppercase">
          Private mode
        </span>
      </nav>
      {children}
    </main>
  );
}

function NotConfigured() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border-[3px] border-[var(--color-ink)] bg-[var(--color-stage-raised)] p-6">
      <h1 className="text-2xl font-black">
        Private mode isn&apos;t configured
      </h1>
      <p className="text-[var(--color-ink-dim)]">
        Private mode scans your own private repos and requires a GitHub OAuth
        App that the operator registers. This instance doesn&apos;t have{" "}
        <code>AUTH_GITHUB_ID</code>, <code>AUTH_GITHUB_SECRET</code>, and{" "}
        <code>AUTH_SECRET</code> set.
      </p>
      <p className="text-[var(--color-ink-dim)]">
        Follow the{" "}
        <a
          href="https://github.com/Lonkins/repo-roast/blob/main/docs/self-host.md"
          className="text-[var(--color-ember)] underline underline-offset-2"
        >
          Deploy your own guide
        </a>{" "}
        to register an OAuth App and enable it. Your token will never leave your
        instance.
      </p>
    </div>
  );
}

export default async function PrivatePage({ searchParams }: PageProps) {
  if (!isPrivateModeConfigured()) {
    return (
      <Shell>
        <NotConfigured />
      </Shell>
    );
  }

  const session = await auth();

  if (!session?.user) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-8 text-center">
          <div>
            <h1 className="text-4xl font-black">Roast your private repos</h1>
            <p className="mt-3 text-lg text-[var(--color-ink-dim)]">
              Same deterministic scan, on the repos the public can&apos;t see.
              Self-hosted, your token stays with you.
            </p>
          </div>
          <ConsentExplainer />
          <SignInButton />
        </div>
      </Shell>
    );
  }

  const { target } = await searchParams;
  const login = session.user.name ?? session.user.email ?? "you";

  let result = null;
  let error: string | null = null;
  if (target) {
    const parsed = parseTarget(target);
    if (!parsed.ok) {
      error = parsed.error;
    } else {
      const outcome = await scanAndRoast(parsed.target, {
        token: session.accessToken,
      });
      if (outcome.ok) {
        result = {
          report: outcome.report,
          roast: outcome.roast,
          slug: targetToSlug(parsed.target),
        };
      } else {
        error = outcome.error.message;
      }
    }
  }

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-[var(--color-ink-dim)]">
          Signed in as{" "}
          <strong className="text-[var(--color-ink)]">{login}</strong>. Your
          token stays on this instance.
        </p>
        <SignOutButton />
      </div>

      <PrivateScanForm login={login} defaultValue={target} />

      {error && (
        <p className="mt-4 rounded-md border-2 border-[var(--color-ember-hot)] p-3 text-sm font-semibold text-[var(--color-ember-hot)]">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8">
          <RoastResult
            report={result.report}
            roast={result.roast}
            slug={result.slug}
          />
        </div>
      )}
    </Shell>
  );
}
