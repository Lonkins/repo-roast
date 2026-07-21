import { describe, expect, test } from "vitest";
import { createRegistryClient, normalizePyPI } from "./registry";
import type { DeclaredDep } from "./registry";

function fakeResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function fetchFrom(routes: Record<string, Response>): typeof fetch {
  return (async (url: string) => {
    const res = routes[url];
    if (!res) throw new Error(`unexpected fetch: ${url}`);
    return res;
  }) as unknown as typeof fetch;
}

const npm = (name: string): DeclaredDep => ({
  ecosystem: "npm",
  name,
  source: "package.json",
});
const pypi = (name: string): DeclaredDep => ({
  ecosystem: "PyPI",
  name,
  source: "requirements.txt",
});

describe("registry client — npm", () => {
  test("maps a 404 to exists:false", async () => {
    const client = createRegistryClient(
      fetchFrom({
        "https://registry.npmjs.org/ghost-pkg": fakeResponse(404, {}),
      }),
    );
    const [probe] = await client.probe([npm("ghost-pkg")]);
    expect(probe!.exists).toBe(false);
  });

  test("parses age, version count, and install scripts from a 200", async () => {
    const client = createRegistryClient(
      fetchFrom({
        "https://registry.npmjs.org/real-pkg": fakeResponse(200, {
          time: { created: "2020-01-01T00:00:00Z" },
          "dist-tags": { latest: "2.0.0" },
          versions: {
            "1.0.0": {},
            "2.0.0": { scripts: { postinstall: "node build.js" } },
          },
        }),
      }),
    );
    const [probe] = await client.probe([npm("real-pkg")]);
    expect(probe!.exists).toBe(true);
    expect(probe!.createdAt).toBe("2020-01-01T00:00:00Z");
    expect(probe!.versionCount).toBe(2);
    expect(probe!.hasInstallScripts).toBe(true);
  });

  test("encodes scoped names", async () => {
    const client = createRegistryClient(
      fetchFrom({
        "https://registry.npmjs.org/@scope%2fpkg": fakeResponse(404, {}),
      }),
    );
    const [probe] = await client.probe([npm("@scope/pkg")]);
    expect(probe!.exists).toBe(false);
  });

  test("a network error leaves exists undefined — never a false positive", async () => {
    const client = createRegistryClient((async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch);
    const [probe] = await client.probe([npm("whatever")]);
    expect(probe!.exists).toBeUndefined();
  });
});

describe("registry client — PyPI", () => {
  test("derives earliest upload time and release count, normalizing the name", async () => {
    const client = createRegistryClient(
      fetchFrom({
        [`https://pypi.org/pypi/${normalizePyPI("My_Lib")}/json`]: fakeResponse(
          200,
          {
            releases: {
              "0.1.0": [{ upload_time_iso_8601: "2021-05-01T00:00:00Z" }],
              "0.2.0": [{ upload_time_iso_8601: "2021-06-01T00:00:00Z" }],
            },
          },
        ),
      }),
    );
    const [probe] = await client.probe([pypi("My_Lib")]);
    expect(probe!.exists).toBe(true);
    expect(probe!.createdAt).toBe("2021-05-01T00:00:00Z");
    expect(probe!.versionCount).toBe(2);
  });
});
