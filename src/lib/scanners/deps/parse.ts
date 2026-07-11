/**
 * Manifest/lockfile parsers producing (ecosystem, name, version) tuples for
 * OSV.dev. We deliberately parse a small, high-value set precisely rather than
 * everything loosely.
 */

export interface Package {
  ecosystem: "npm" | "PyPI" | "crates.io" | "Go" | "RubyGems";
  name: string;
  version: string;
  /** manifest the package was resolved from, for evidence */
  source: string;
}

/** package-lock.json v2/v3 (has "packages"), v1 ("dependencies"). */
export function parsePackageLock(json: string, source: string): Package[] {
  const out: Package[] = [];
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return out;
  }
  if (typeof doc !== "object" || doc === null) return out;
  const d = doc as Record<string, unknown>;

  const packages = d.packages;
  if (packages && typeof packages === "object") {
    for (const [path, meta] of Object.entries(packages)) {
      if (!path.startsWith("node_modules/")) continue; // skip root ""
      if (!meta || typeof meta !== "object") continue;
      const version = (meta as Record<string, unknown>).version;
      if (typeof version !== "string") continue;
      const name = path.slice(path.lastIndexOf("node_modules/") + 13);
      out.push({ ecosystem: "npm", name, version, source });
    }
    return out;
  }

  const deps = d.dependencies;
  if (deps && typeof deps === "object") {
    for (const [name, meta] of Object.entries(deps)) {
      if (!meta || typeof meta !== "object") continue;
      const version = (meta as Record<string, unknown>).version;
      if (typeof version === "string")
        out.push({ ecosystem: "npm", name, version, source });
    }
  }
  return out;
}

/** package.json — resolves only exact-pinned versions (ranges can't be queried). */
export function parsePackageJson(json: string, source: string): Package[] {
  const out: Package[] = [];
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return out;
  }
  if (typeof doc !== "object" || doc === null) return out;
  const d = doc as Record<string, unknown>;
  for (const field of ["dependencies", "devDependencies"]) {
    const deps = d[field];
    if (!deps || typeof deps !== "object") continue;
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range !== "string") continue;
      // Only truly-exact pins are queryable; a range (^, ~, >=, *, x) needs a
      // lockfile to resolve to an installed version.
      const exact = /^\d+\.\d+\.\d+(?:[.+-][A-Za-z0-9.+-]*)?$/.exec(
        range.trim(),
      );
      if (exact)
        out.push({ ecosystem: "npm", name, version: exact[0], source });
    }
  }
  return out;
}

/** requirements.txt — `pkg==1.2.3` pinned lines only. */
export function parseRequirementsTxt(text: string, source: string): Package[] {
  const out: Package[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.split("#")[0]?.trim() ?? "";
    const m = /^([A-Za-z0-9._-]+)\s*==\s*([0-9][A-Za-z0-9.+!-]*)/.exec(line);
    if (m) out.push({ ecosystem: "PyPI", name: m[1]!, version: m[2]!, source });
  }
  return out;
}

/** Cargo.lock — TOML [[package]] blocks. Minimal parse, no toml dep. */
export function parseCargoLock(text: string, source: string): Package[] {
  const out: Package[] = [];
  const blocks = text.split(/\[\[package\]\]/).slice(1);
  for (const block of blocks) {
    const name = /name\s*=\s*"([^"]+)"/.exec(block)?.[1];
    const version = /version\s*=\s*"([^"]+)"/.exec(block)?.[1];
    if (name && version)
      out.push({ ecosystem: "crates.io", name, version, source });
  }
  return out;
}

interface ParserEntry {
  match: (path: string) => boolean;
  parse: (content: string, source: string) => Package[];
}

/** Ordered so lockfiles win over manifests for the same ecosystem. */
export const PARSERS: ParserEntry[] = [
  { match: (p) => p.endsWith("package-lock.json"), parse: parsePackageLock },
  { match: (p) => p.endsWith("requirements.txt"), parse: parseRequirementsTxt },
  { match: (p) => p.endsWith("Cargo.lock"), parse: parseCargoLock },
  { match: (p) => p.endsWith("package.json"), parse: parsePackageJson },
];

/** Dedupe on ecosystem+name+version. */
export function dedupePackages(packages: Package[]): Package[] {
  const seen = new Map<string, Package>();
  for (const p of packages) {
    const key = `${p.ecosystem}:${p.name}:${p.version}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}
