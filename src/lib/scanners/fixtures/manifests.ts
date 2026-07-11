/** Synthetic dependency manifests/lockfiles for parser + OSV tests. */

export const PACKAGE_LOCK_V3 = JSON.stringify({
  name: "app",
  lockfileVersion: 3,
  packages: {
    "": { name: "app", version: "1.0.0" },
    "node_modules/lodash": { version: "4.17.11" },
    "node_modules/left-pad": { version: "1.1.3" },
    "node_modules/@scope/pkg": { version: "2.0.0" },
  },
});

export const PACKAGE_JSON = JSON.stringify({
  name: "app",
  dependencies: { express: "4.17.1", react: "^18.2.0" },
  devDependencies: { vitest: "1.0.0" },
});

export const REQUIREMENTS_TXT = `# app deps
flask==0.12.2
requests==2.20.0
urllib3>=1.24    # range, ignored
`;

export const CARGO_LOCK = `# auto-generated
version = 3

[[package]]
name = "time"
version = "0.1.42"

[[package]]
name = "serde"
version = "1.0.130"
`;
