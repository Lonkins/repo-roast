# Test fixtures

All "secrets" here are **synthetic** — fabricated to match detector patterns, never real credentials. This directory is excluded from gitleaks (`.gitleaksignore`), ESLint, Prettier, tsconfig, and coverage so the fake secrets don't trip the project's own hygiene gates.

Fixtures are consumed by scanner unit tests as in-memory strings, not read from disk, so they exercise the rules without polluting real files.
