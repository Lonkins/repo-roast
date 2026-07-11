import type { Package } from "./parse";

export interface OsvVuln {
  id: string;
  summary?: string;
  aliases?: string[];
  /** derived worst CVSS-ish label if OSV provides severity */
  severity?: string;
}

export interface OsvResult {
  pkg: Package;
  vulns: OsvVuln[];
}

/** Port so the scanner can be unit-tested without hitting the network. */
export interface OsvClient {
  query(packages: Package[]): Promise<OsvResult[]>;
}

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const OSV_VULN_URL = "https://api.osv.dev/v1/vulns";
const BATCH_MAX = 100;

interface BatchResponseEntry {
  vulns?: { id: string; modified: string }[];
}

/**
 * Real OSV.dev client. querybatch tells us which packages are affected and the
 * vuln IDs; we hydrate a bounded number of those IDs for summaries. Free API.
 */
export function createOsvClient(fetchImpl: typeof fetch = fetch): OsvClient {
  async function hydrate(id: string): Promise<OsvVuln> {
    try {
      const res = await fetchImpl(`${OSV_VULN_URL}/${id}`);
      if (!res.ok) return { id };
      const data = (await res.json()) as {
        summary?: string;
        aliases?: string[];
        database_specific?: { severity?: string };
      };
      return {
        id,
        summary: data.summary,
        aliases: data.aliases,
        severity: data.database_specific?.severity,
      };
    } catch {
      return { id };
    }
  }

  return {
    async query(packages) {
      const results: OsvResult[] = [];
      for (let i = 0; i < packages.length; i += BATCH_MAX) {
        const chunk = packages.slice(i, i + BATCH_MAX);
        const body = {
          queries: chunk.map((p) => ({
            package: { name: p.name, ecosystem: p.ecosystem },
            version: p.version,
          })),
        };
        const res = await fetchImpl(OSV_BATCH_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { results?: BatchResponseEntry[] };
        const entries = data.results ?? [];
        for (let j = 0; j < chunk.length; j++) {
          const ids = (entries[j]?.vulns ?? []).map((v) => v.id);
          if (ids.length === 0) continue;
          const vulns = await Promise.all(ids.slice(0, 5).map(hydrate));
          results.push({ pkg: chunk[j]!, vulns });
        }
      }
      return results;
    },
  };
}
