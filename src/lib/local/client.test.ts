import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalClient } from "./client";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "rr-local-"));
  await mkdir(join(dir, "src"), { recursive: true });
  await writeFile(join(dir, "src", "app.ts"), "export const x = 1;");
  await writeFile(join(dir, "README.md"), "# hi");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("LocalClient", () => {
  test("getTree lists files (filesystem-walk fallback outside a git repo)", async () => {
    const { paths } = await new LocalClient(dir).getTree();
    expect(paths.sort()).toEqual(["README.md", "src/app.ts"]);
  });

  test("getFile reads content; a missing file is null", async () => {
    const client = new LocalClient(dir);
    const repo = await client.getRepo();
    expect((await client.getFile(repo, "README.md"))?.content).toBe("# hi");
    expect(await client.getFile(repo, "does-not-exist.txt")).toBeNull();
  });

  test("getRepo treats a local scan as private and never nags for a license", async () => {
    const repo = await new LocalClient(dir).getRepo();
    expect(repo.isPrivate).toBe(true);
    expect(repo.owner).toBeTruthy();
    expect(repo.repo).toBeTruthy();
  });

  test("history scanning is a no-op locally (gitleaks owns it)", async () => {
    const client = new LocalClient(dir);
    expect(await client.listCommits()).toEqual([]);
    expect(await client.getCommitPatches()).toEqual([]);
  });

  test(".reporoastignore excludes matching paths from the tree", async () => {
    const ig = await mkdtemp(join(tmpdir(), "rr-ignore-"));
    await mkdir(join(ig, "src"), { recursive: true });
    await writeFile(join(ig, "src", "keep.ts"), "x");
    await writeFile(join(ig, "vendored.ts"), "x");
    await writeFile(join(ig, ".reporoastignore"), "# skip\nvendored.ts\n");
    const { paths } = await new LocalClient(ig).getTree();
    await rm(ig, { recursive: true, force: true });
    expect(paths).toContain("src/keep.ts");
    expect(paths).not.toContain("vendored.ts");
  });
});
