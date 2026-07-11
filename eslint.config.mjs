import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src/lib/scanners/fixtures/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...nextTs,
];

export default config;
