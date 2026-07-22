/**
 * Extract *declared dependency names* from manifests — every declared dep, not
 * just exact-pinned ones (the deps scanner drops ranges because OSV needs a
 * version; here we only need the name to ask "does it exist"). Local, VCS, and
 * URL specs are skipped: they don't resolve to a registry name.
 */

import type { DeclaredDep } from "./registry";

const NON_REGISTRY_NPM = /^(file:|link:|workspace:|git\+|git:|https?:|github:)/;

/** package.json dependency-map keys across all dependency fields. */
export function parsePackageJsonNames(
  json: string,
  source: string,
): DeclaredDep[] {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof doc !== "object" || doc === null) return [];
  const d = doc as Record<string, unknown>;
  const out: DeclaredDep[] = [];
  const fields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ];
  for (const field of fields) {
    const deps = d[field];
    if (!deps || typeof deps !== "object") continue;
    for (const [name, spec] of Object.entries(
      deps as Record<string, unknown>,
    )) {
      if (typeof spec === "string" && NON_REGISTRY_NPM.test(spec.trim()))
        continue;
      out.push({ ecosystem: "npm", name, source });
    }
  }
  return out;
}

/** requirements.txt package names (before any version/extras/marker). */
export function parseRequirementsNames(
  text: string,
  source: string,
): DeclaredDep[] {
  const out: DeclaredDep[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.split("#")[0]?.trim() ?? "";
    if (!line || line.startsWith("-")) continue; // options: -r, -e, --hash, ...
    if (/^[a-z]+\+|:\/\//i.test(line)) continue; // vcs/url installs
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line);
    if (m) out.push({ ecosystem: "PyPI", name: m[1]!, source });
  }
  return out;
}

interface NameParser {
  match: (path: string) => boolean;
  parse: (content: string, source: string) => DeclaredDep[];
}

const PARSERS: NameParser[] = [
  { match: (p) => p.endsWith("package.json"), parse: parsePackageJsonNames },
  {
    match: (p) => p.endsWith("requirements.txt"),
    parse: parseRequirementsNames,
  },
];

export function matchesManifest(path: string): boolean {
  // package-lock etc. are noise here — declared intent lives in the manifests.
  if (path.includes("node_modules/")) return false;
  return PARSERS.some((p) => p.match(path));
}

export function parseManifest(path: string, content: string): DeclaredDep[] {
  const parser = PARSERS.find((p) => p.match(path));
  return parser ? parser.parse(content, path) : [];
}

/** Dedupe on ecosystem+name (case-insensitive), keeping first-seen source. */
export function dedupeDeps(deps: DeclaredDep[]): DeclaredDep[] {
  const seen = new Map<string, DeclaredDep>();
  for (const d of deps) {
    const key = `${d.ecosystem}:${d.name.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, d);
  }
  return [...seen.values()];
}
