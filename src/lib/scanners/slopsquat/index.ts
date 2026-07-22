/**
 * slopsquat — the scanner OSV/Snyk can't be: it flags dependencies that are
 * hallucinated (an AI invented a name that doesn't exist, a slot an attacker
 * can register), typosquats of a famous package, or brand-new landing pads.
 * All verdicts come from real registry facts, never from a model.
 */

import type {
  Finding,
  RepoRef,
  ScanContext,
  Scanner,
} from "../../engine/types";
import { dedupeDeps, matchesManifest, parseManifest } from "./collect";
import { nearestPopular, type Ecosystem } from "./popular";
import {
  createRegistryClient,
  type DeclaredDep,
  type RegistryClient,
  type RegistryProbe,
} from "./registry";

/** Cap names probed per repo — one registry request each. */
const MAX_DEPS = 200;
/** A dependency first published within this window is "newborn". */
const NEWBORN_DAYS = 30;
/** Newborn AND at most this many versions = a barely-there package. */
const LOW_VERSION_COUNT = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

function registryUrl(ecosystem: Ecosystem, name: string): string {
  return ecosystem === "npm"
    ? `https://www.npmjs.com/package/${name}`
    : `https://pypi.org/project/${name}/`;
}

function installCmd(ecosystem: Ecosystem, name: string): string {
  return ecosystem === "npm" ? `npm i ${name}` : `pip install ${name}`;
}

async function collect(
  repo: RepoRef,
  ctx: ScanContext,
): Promise<DeclaredDep[]> {
  const { paths } = await ctx.github.getTree(repo);
  const manifests = paths.filter(matchesManifest);
  const deps: DeclaredDep[] = [];
  for (const path of manifests) {
    const file = await ctx.github.getFile(repo, path);
    if (!file) continue;
    deps.push(...parseManifest(path, file.content));
  }
  return dedupeDeps(deps).slice(0, MAX_DEPS);
}

function nonexistentFinding(
  repoName: string,
  probe: RegistryProbe,
  source: string,
): Finding {
  const { ecosystem, name } = probe;
  const near = nearestPopular(ecosystem, name);
  const didYouMean = near
    ? ` It's one character off "${near}" — likely a typo the assistant made.`
    : "";
  return {
    id: "slopsquat/nonexistent-dependency",
    scanner: "slopsquat",
    severity: "critical",
    title: `Dependency "${name}" does not exist on ${ecosystem}`,
    evidence: {
      repo: repoName,
      path: source,
      detail: `${ecosystem} returned 404 for ${name}.${didYouMean}`,
    },
    fix: near
      ? `Replace "${name}" with "${near}" (the real package) in ${source}, or remove it if unused.`
      : `Remove "${name}" from ${source}, or replace it with the real package you meant. Do not \`${installCmd(ecosystem, name)}\` a name you can't verify.`,
    why: `AI assistants invent package names that sound right but were never published. Attackers watch for these and register the empty name with malware — so the next \`install\` pulls a supply-chain payload that runs on your machine (this is "slopsquatting").`,
    agentPrompt: `In ${source}, the dependency "${name}" does not exist on the ${ecosystem} registry (a hallucinated package). ${near ? `Replace it with the real package "${near}" if that was the intent` : `Find the real package that was intended and replace it, or remove the dependency if it is unused`}. Then update the lockfile. Do not add any package whose name you cannot verify exists on ${ecosystem}.`,
  };
}

function typosquatFinding(
  repoName: string,
  probe: RegistryProbe,
  source: string,
  near: string,
): Finding {
  const { ecosystem, name } = probe;
  return {
    id: "slopsquat/typosquat-suspect",
    scanner: "slopsquat",
    severity: "high",
    title: `Dependency "${name}" looks like a typosquat of "${near}"`,
    evidence: {
      repo: repoName,
      path: source,
      url: registryUrl(ecosystem, name),
      detail: `"${name}" is one character from the popular package "${near}" but is itself obscure and newly/barely published — the classic typosquat shape.`,
    },
    fix: `Confirm you meant "${near}". If so, fix the name in ${source}; if "${name}" was deliberate, verify its publisher before trusting it.`,
    why: `Typosquatted packages sit one keystroke away from a package you trust and ship malware in an install script. A single wrong character in a dependency name can hand an attacker code execution in your app and CI.`,
    agentPrompt: `In ${source}, the dependency "${name}" is one character away from the well-known package "${near}" and is itself obscure and barely published — a likely typosquat. Verify which was intended. If "${near}" was meant, replace "${name}" with "${near}" and update the lockfile. If "${name}" is genuinely intended, leave a comment noting it was verified.`,
  };
}

function newbornFinding(
  repoName: string,
  probe: RegistryProbe,
  source: string,
  ageDays: number,
): Finding {
  const { ecosystem, name, hasInstallScripts } = probe;
  const severity = hasInstallScripts ? "high" : "medium";
  const scriptsNote = hasInstallScripts
    ? " and it runs code on install (pre/post-install scripts)"
    : "";
  return {
    id: "slopsquat/newborn-dependency",
    scanner: "slopsquat",
    severity,
    title: `Dependency "${name}" is brand-new and barely published`,
    evidence: {
      repo: repoName,
      path: source,
      url: registryUrl(ecosystem, name),
      detail: `"${name}" was first published ~${ageDays} day(s) ago with very few versions${scriptsNote}.`,
    },
    fix: `Confirm "${name}" is the package you intended and that its publisher is trustworthy before depending on it. Pin an exact version in ${source} and review the source.`,
    why: `A dependency published days ago has no track record and could be a slopsquat landing pad an attacker set up to catch AI-suggested names.${hasInstallScripts ? " Install scripts mean it runs arbitrary code the moment you install it — no import required." : ""}`,
    agentPrompt: `In ${source}, the dependency "${name}" was first published only ~${ageDays} days ago and has very few versions${hasInstallScripts ? ", and it runs install scripts" : ""}. Check whether this is the package that was actually intended and whether its publisher is reputable. If it's wrong or unnecessary, replace or remove it. If it's correct, pin it to an exact version.`,
  };
}

function classify(
  repoName: string,
  probe: RegistryProbe,
  source: string,
  now: Date,
): Finding | null {
  if (probe.exists === false)
    return nonexistentFinding(repoName, probe, source);
  if (probe.exists !== true) return null; // couldn't tell — never guess

  const near = nearestPopular(probe.ecosystem, probe.name);
  const ageDays = probe.createdAt
    ? Math.floor((now.getTime() - new Date(probe.createdAt).getTime()) / DAY_MS)
    : Infinity;
  const newborn = ageDays <= NEWBORN_DAYS;
  const fewVersions = (probe.versionCount ?? Infinity) <= LOW_VERSION_COUNT;

  if (near && (newborn || fewVersions))
    return typosquatFinding(repoName, probe, source, near);
  if (newborn && fewVersions)
    return newbornFinding(repoName, probe, source, ageDays);
  return null;
}

/** Factory so tests can inject a fake registry client. */
export function createSlopsquatScanner(registry: RegistryClient): Scanner {
  return {
    id: "slopsquat",
    async scan(repo: RepoRef, ctx: ScanContext): Promise<Finding[]> {
      const deps = await collect(repo, ctx);
      if (deps.length === 0) return [];
      const probes = await registry.probe(deps);
      const bySource = new Map(
        deps.map((d) => [`${d.ecosystem}:${d.name}`, d.source]),
      );
      const repoName = `${repo.owner}/${repo.repo}`;
      const now = ctx.now();
      const findings: Finding[] = [];
      for (const probe of probes) {
        const source = bySource.get(`${probe.ecosystem}:${probe.name}`) ?? "";
        const f = classify(repoName, probe, source, now);
        if (f) findings.push(f);
      }
      return findings;
    },
  };
}

export const slopsquatScanner: Scanner = createSlopsquatScanner(
  createRegistryClient(),
);
