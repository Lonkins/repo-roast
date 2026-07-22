import { describe, expect, test } from "vitest";
import {
  dedupeDeps,
  matchesManifest,
  parsePackageJsonNames,
  parseRequirementsNames,
} from "./collect";
import { normalizePyPI } from "./registry";

describe("parsePackageJsonNames", () => {
  test("collects names across all dependency fields, ranges included", () => {
    const json = JSON.stringify({
      dependencies: { react: "^19.0.0", "left-pad": "1.0.0" },
      devDependencies: { vitest: "*" },
      peerDependencies: { next: ">=15" },
    });
    const names = parsePackageJsonNames(json, "package.json").map(
      (d) => d.name,
    );
    expect(names).toEqual(["react", "left-pad", "vitest", "next"]);
  });

  test("skips local/vcs/url specs that don't resolve to a registry name", () => {
    const json = JSON.stringify({
      dependencies: {
        real: "^1.0.0",
        localdep: "file:../local",
        wsdep: "workspace:*",
        gitdep: "git+https://example.com/x.git",
      },
    });
    const names = parsePackageJsonNames(json, "package.json").map(
      (d) => d.name,
    );
    expect(names).toEqual(["real"]);
  });

  test("malformed JSON yields nothing rather than throwing", () => {
    expect(parsePackageJsonNames("{ not json", "package.json")).toEqual([]);
  });
});

describe("parseRequirementsNames", () => {
  test("extracts names before version specifiers, extras, and markers", () => {
    const text = [
      "requests==2.31.0",
      "flask>=2.0",
      "uvicorn[standard]",
      "numpy ; python_version >= '3.9'",
      "# a comment",
      "-r other.txt",
      "-e .",
      "git+https://example.com/pkg.git",
    ].join("\n");
    const names = parseRequirementsNames(text, "requirements.txt").map(
      (d) => d.name,
    );
    expect(names).toEqual(["requests", "flask", "uvicorn", "numpy"]);
  });
});

describe("matchesManifest", () => {
  test("matches manifests but not lockfiles or vendored copies", () => {
    expect(matchesManifest("package.json")).toBe(true);
    expect(matchesManifest("api/requirements.txt")).toBe(true);
    expect(matchesManifest("package-lock.json")).toBe(false);
    expect(matchesManifest("node_modules/x/package.json")).toBe(false);
  });
});

describe("dedupeDeps", () => {
  test("dedupes case-insensitively per ecosystem", () => {
    const deps = dedupeDeps([
      { ecosystem: "npm", name: "React", source: "a" },
      { ecosystem: "npm", name: "react", source: "b" },
      { ecosystem: "PyPI", name: "react", source: "c" },
    ]);
    expect(deps).toHaveLength(2);
  });
});

describe("normalizePyPI", () => {
  test("applies PEP 503 normalization", () => {
    expect(normalizePyPI("Flask_SQLAlchemy")).toBe("flask-sqlalchemy");
    expect(normalizePyPI("zope.interface")).toBe("zope-interface");
  });
});
