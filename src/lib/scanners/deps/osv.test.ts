import { describe, expect, test, vi } from "vitest";
import { createOsvClient } from "./osv";
import type { Package } from "./parse";

const pkg: Package = {
  ecosystem: "npm",
  name: "lodash",
  version: "4.17.11",
  source: "package-lock.json",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("createOsvClient", () => {
  test("maps batch hits and hydrates vuln details", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/querybatch")) {
        return jsonResponse({
          results: [{ vulns: [{ id: "GHSA-1", modified: "" }] }],
        });
      }
      return jsonResponse({
        summary: "Prototype pollution",
        aliases: ["CVE-2019-10744"],
      });
    });

    const client = createOsvClient(fetchMock as unknown as typeof fetch);
    const results = await client.query([pkg]);

    expect(results).toHaveLength(1);
    expect(results[0]?.pkg.name).toBe("lodash");
    expect(results[0]?.vulns[0]?.aliases).toContain("CVE-2019-10744");
  });

  test("returns nothing when a package has no vulns", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [{}] }));
    const client = createOsvClient(fetchMock as unknown as typeof fetch);
    expect(await client.query([pkg])).toHaveLength(0);
  });

  test("survives a non-ok batch response", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    const client = createOsvClient(fetchMock as unknown as typeof fetch);
    expect(await client.query([pkg])).toHaveLength(0);
  });
});
