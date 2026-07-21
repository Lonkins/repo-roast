/**
 * A small bundled set of the most-depended-on package names per ecosystem, used
 * only to spot typosquat/hallucination near-misses (an AI fat-fingering a
 * famous name). This is NOT a popularity ranking and NOT an allowlist — it is
 * the set of names a slop dependency is most likely to be mistaken *for*.
 */

export type Ecosystem = "npm" | "PyPI";

/** Top npm names by dependents — the ones LLMs hallucinate variants of. */
const NPM_POPULAR: string[] = [
  "react",
  "react-dom",
  "next",
  "vue",
  "express",
  "lodash",
  "axios",
  "chalk",
  "commander",
  "typescript",
  "eslint",
  "prettier",
  "webpack",
  "vite",
  "rollup",
  "jest",
  "vitest",
  "mocha",
  "chai",
  "dotenv",
  "zod",
  "yup",
  "moment",
  "dayjs",
  "uuid",
  "nanoid",
  "cors",
  "body-parser",
  "mongoose",
  "prisma",
  "sequelize",
  "pg",
  "mysql2",
  "redis",
  "socket.io",
  "ws",
  "tailwindcss",
  "postcss",
  "autoprefixer",
  "classnames",
  "clsx",
  "framer-motion",
  "styled-components",
  "@tanstack/react-query",
  "swr",
  "zustand",
  "redux",
  "react-router-dom",
  "bcrypt",
  "bcryptjs",
  "jsonwebtoken",
  "passport",
  "nodemailer",
  "sharp",
  "puppeteer",
  "playwright",
  "cheerio",
  "fastify",
  "nestjs",
  "rxjs",
];

/** Top PyPI names, normalized (PEP 503). */
const PYPI_POPULAR: string[] = [
  "requests",
  "urllib3",
  "numpy",
  "pandas",
  "scipy",
  "matplotlib",
  "flask",
  "django",
  "fastapi",
  "uvicorn",
  "gunicorn",
  "sqlalchemy",
  "pydantic",
  "click",
  "rich",
  "typer",
  "httpx",
  "aiohttp",
  "beautifulsoup4",
  "lxml",
  "pillow",
  "pytest",
  "tox",
  "black",
  "flake8",
  "ruff",
  "mypy",
  "boto3",
  "openai",
  "anthropic",
  "langchain",
  "transformers",
  "torch",
  "tensorflow",
  "scikit-learn",
  "python-dotenv",
  "pyyaml",
  "jinja2",
  "celery",
  "redis",
];

const POPULAR: Record<Ecosystem, Set<string>> = {
  npm: new Set(NPM_POPULAR),
  PyPI: new Set(PYPI_POPULAR),
};

export function isPopular(ecosystem: Ecosystem, name: string): boolean {
  return POPULAR[ecosystem].has(name.toLowerCase());
}

/** Bounded Levenshtein distance. Returns early once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length]!;
}

/**
 * The popular name a candidate is a likely typo of, or null. Requires an exact
 * edit distance of 1, the candidate to differ from the popular name, and the
 * candidate itself to not be a popular name (so `react` never "typosquats"
 * `preact`). Scoped npm names are compared on their bare part.
 */
export function nearestPopular(
  ecosystem: Ecosystem,
  name: string,
): string | null {
  const lower = name.toLowerCase();
  if (isPopular(ecosystem, lower)) return null;
  const bare = lower.includes("/")
    ? lower.slice(lower.indexOf("/") + 1)
    : lower;
  let best: string | null = null;
  for (const popular of POPULAR[ecosystem]) {
    const target = popular.includes("/")
      ? popular.slice(popular.indexOf("/") + 1)
      : popular;
    if (editDistance(bare, target, 1) === 1) {
      best = popular;
      break;
    }
  }
  return best;
}
