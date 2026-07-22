/**
 * Registry probes: does this package name actually exist, how old is it, how
 * many versions has it shipped, does it run install scripts. All facts, from
 * npm/PyPI — never model judgment. A definitive 404 is the only signal we treat
 * as "does not exist"; any other failure leaves `exists` undefined so a flaky
 * network never manufactures a finding.
 */

import type { Ecosystem } from "./popular";

export interface DeclaredDep {
  ecosystem: Ecosystem;
  name: string;
  /** manifest the name was declared in, for evidence */
  source: string;
}

export interface RegistryProbe {
  ecosystem: Ecosystem;
  name: string;
  /** true = exists, false = registry returned 404, undefined = couldn't tell */
  exists?: boolean;
  /** ISO timestamp the package was first published, when known */
  createdAt?: string;
  /** number of published versions, when known */
  versionCount?: number;
  /** package runs preinstall/install/postinstall scripts (npm only) */
  hasInstallScripts?: boolean;
}

/** Port so the scanner is unit-testable without hitting a registry. */
export interface RegistryClient {
  probe(deps: DeclaredDep[]): Promise<RegistryProbe[]>;
}

/** PEP 503 name normalization for PyPI lookups. */
export function normalizePyPI(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

async function probeNpm(
  dep: DeclaredDep,
  fetchImpl: typeof fetch,
): Promise<RegistryProbe> {
  const base: RegistryProbe = { ecosystem: "npm", name: dep.name };
  try {
    // Encode scoped names: @scope/pkg -> @scope%2fpkg
    const encoded = dep.name.replace("/", "%2f");
    const res = await fetchImpl(`https://registry.npmjs.org/${encoded}`);
    if (res.status === 404) return { ...base, exists: false };
    if (!res.ok) return base;
    const doc = (await res.json()) as {
      time?: Record<string, string>;
      versions?: Record<string, { scripts?: Record<string, string> }>;
      "dist-tags"?: { latest?: string };
    };
    const versions = doc.versions ?? {};
    const latest = doc["dist-tags"]?.latest;
    const scripts = latest ? versions[latest]?.scripts : undefined;
    const hasInstallScripts = !!(
      scripts &&
      (scripts.preinstall || scripts.install || scripts.postinstall)
    );
    return {
      ...base,
      exists: true,
      createdAt: doc.time?.created,
      versionCount: Object.keys(versions).length,
      hasInstallScripts,
    };
  } catch {
    return base;
  }
}

async function probePyPI(
  dep: DeclaredDep,
  fetchImpl: typeof fetch,
): Promise<RegistryProbe> {
  const base: RegistryProbe = { ecosystem: "PyPI", name: dep.name };
  try {
    const res = await fetchImpl(
      `https://pypi.org/pypi/${normalizePyPI(dep.name)}/json`,
    );
    if (res.status === 404) return { ...base, exists: false };
    if (!res.ok) return base;
    const doc = (await res.json()) as {
      releases?: Record<string, { upload_time_iso_8601?: string }[]>;
    };
    const releases = doc.releases ?? {};
    let earliest: string | undefined;
    for (const files of Object.values(releases)) {
      for (const f of files) {
        const t = f.upload_time_iso_8601;
        if (t && (!earliest || t < earliest)) earliest = t;
      }
    }
    return {
      ...base,
      exists: true,
      createdAt: earliest,
      versionCount: Object.keys(releases).length,
    };
  } catch {
    return base;
  }
}

/** Real client. One request per unique name; the scanner caps the count. */
export function createRegistryClient(
  fetchImpl: typeof fetch = fetch,
): RegistryClient {
  return {
    async probe(deps) {
      return Promise.all(
        deps.map((d) =>
          d.ecosystem === "npm"
            ? probeNpm(d, fetchImpl)
            : probePyPI(d, fetchImpl),
        ),
      );
    },
  };
}
