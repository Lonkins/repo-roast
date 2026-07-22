/**
 * agents — the attack surface nobody else audits: the config that tells an AI
 * coding agent (Claude Code, Cursor, an MCP client) what it may run and what it
 * may connect to. AI-built repos increasingly ship these, and a bad default
 * here turns ordinary prompt injection into code execution. All deterministic
 * shape/string facts; secret values are redacted.
 */

import type { Finding, RepoRef } from "../../engine/types";

function lineOf(content: string, needle: string): number | undefined {
  const idx = content.split("\n").findIndex((l) => l.includes(needle));
  return idx === -1 ? undefined : idx + 1;
}

function ghUrl(repo: RepoRef, path: string, line?: number): string {
  const base = `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.defaultBranch}/${path}`;
  return line ? `${base}#L${line}` : base;
}

function repoName(repo: RepoRef): string {
  return `${repo.owner}/${repo.repo}`;
}

/* ------------------------------------------------------------------ *
 * Rule 1: human-in-the-loop removed (auto-approve / skip-permissions)
 * ------------------------------------------------------------------ */

const AUTO_APPROVE_PATTERNS: { re: RegExp; label: string }[] = [
  {
    re: /--dangerously-skip-permissions/,
    label: "Claude Code runs with --dangerously-skip-permissions",
  },
  {
    re: /["']?defaultMode["']?\s*:\s*["']bypassPermissions["']/,
    label: 'permission mode is "bypassPermissions"',
  },
  { re: /["']autoApprove["']/, label: "MCP tools are auto-approved" },
  { re: /["']alwaysAllow["']/, label: "MCP tools are set to always-allow" },
  {
    re: /["']?Bash\(\*\)["']?/,
    label: "unrestricted shell is pre-approved (Bash(*))",
  },
  { re: /\byolo\b/i, label: "an agent 'yolo' mode is referenced" },
  {
    re: /\b(auto[_-]?run|autoedit|auto[_-]?approve)\b\s*[:=]\s*true/i,
    label: "agent auto-run / auto-edit is enabled",
  },
];

function autoApproveFinding(
  repo: RepoRef,
  path: string,
  content: string,
): Finding | null {
  const hit = AUTO_APPROVE_PATTERNS.find((p) => p.re.test(content));
  if (!hit) return null;
  const needle = hit.re.source.includes("dangerously")
    ? "--dangerously-skip-permissions"
    : "";
  const line = needle ? lineOf(content, needle) : undefined;
  return {
    id: "agents/auto-approved-execution",
    scanner: "agents",
    severity: "high",
    title: `AI agent runs without a human approval gate in ${path}`,
    evidence: {
      repo: repoName(repo),
      path,
      line,
      url: ghUrl(repo, path, line),
      detail: `${hit.label}. Any content the agent reads — a web page, an issue, a dependency's README — can then instruct it to run commands with no confirmation.`,
    },
    fix: "Remove the auto-approve / skip-permissions setting and require confirmation for shell and file-write tools. If a specific automated flow needs it, scope the allowance to exact commands, not a blanket bypass.",
    why: "An agent with tools and no approval gate is one prompt injection away from running attacker instructions. A poisoned issue, doc, or web page it reads becomes `rm -rf`, an exfiltration curl, or a commit — with your credentials.",
    agentPrompt: `In ${path}, an AI coding agent is configured to skip human approval (${hit.label}). Change it so tool calls that run shell commands or write files require confirmation. If an unattended workflow genuinely needs automation, replace the blanket bypass with an explicit allowlist of the exact commands it may run, and explain the residual risk.`,
  };
}

/* ------------------------------------------------------------------ *
 * Rules 2–4: MCP server structure (unpinned, remote, hardcoded secret)
 * ------------------------------------------------------------------ */

interface McpServer {
  command?: unknown;
  args?: unknown;
  env?: unknown;
  url?: unknown;
  type?: unknown;
  headers?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** MCP servers live under `mcpServers` (Claude/Cursor) or `servers` (VS Code). */
function serverEntries(doc: unknown): [string, McpServer][] {
  if (!isRecord(doc)) return [];
  const map = isRecord(doc.mcpServers)
    ? doc.mcpServers
    : isRecord(doc.servers)
      ? doc.servers
      : null;
  if (!map) return [];
  return Object.entries(map).filter(([, v]) => isRecord(v)) as [
    string,
    McpServer,
  ][];
}

const RUNNER_BASENAMES = new Set(["npx", "uvx", "bunx", "pnpm", "pipx", "dlx"]);
const VERSION_PIN_RE = /@\d|==|@sha256:/;

function isUnpinnedRunner(server: McpServer): boolean {
  const command = typeof server.command === "string" ? server.command : "";
  const base = command.split("/").pop() ?? command;
  if (!RUNNER_BASENAMES.has(base)) return false;
  const args = Array.isArray(server.args)
    ? server.args.filter((a): a is string => typeof a === "string")
    : [];
  // `npx -y pkg` with no @version anywhere = latest, unpinned.
  return !args.some((a) => VERSION_PIN_RE.test(a));
}

function isRemote(server: McpServer): string | null {
  const url = typeof server.url === "string" ? server.url : "";
  if (!/^https?:\/\//.test(url)) return null;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url)) return null;
  return url;
}

const SECRET_VALUE_RE =
  /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[A-Za-z0-9_\-]{40,})/;

function isEnvReference(v: string): boolean {
  return v.includes("${") || /^\$[A-Za-z_]/.test(v) || v.trim() === "";
}

function hardcodedSecretKeys(server: McpServer): string[] {
  const out: string[] = [];
  for (const block of [server.env, server.headers]) {
    if (!isRecord(block)) continue;
    for (const [k, v] of Object.entries(block)) {
      if (typeof v !== "string") continue;
      if (isEnvReference(v)) continue;
      if (SECRET_VALUE_RE.test(v)) out.push(k);
    }
  }
  return out;
}

function mcpFindings(repo: RepoRef, path: string, doc: unknown): Finding[] {
  const findings: Finding[] = [];
  for (const [name, server] of serverEntries(doc)) {
    // Line number isn't recoverable from parsed JSON; link to the file.
    const base = { repo: repoName(repo), path, url: ghUrl(repo, path) };

    if (isUnpinnedRunner(server)) {
      findings.push({
        id: "agents/unpinned-mcp-server",
        scanner: "agents",
        severity: "medium",
        title: `MCP server "${name}" runs an unpinned package in ${path}`,
        evidence: {
          ...base,
          detail: `"${name}" launches via a package runner with no version pin, so it executes whatever the latest published version is — with the env and secrets you hand it.`,
        },
        fix: `Pin "${name}" to an exact version (e.g. \`@1.2.3\`) and, where the client supports it, a lockfile or integrity hash. Prefer servers from publishers you trust.`,
        why: "An MCP server runs with your environment and tokens. An unpinned runner pulls the newest version every launch — a compromised or malicious release executes on your machine the next time your agent starts, no action from you.",
        agentPrompt: `In ${path}, the MCP server "${name}" is launched via an unpinned package runner (npx/uvx/etc. with no @version). Pin it to a specific reviewed version, and confirm the publisher is trustworthy since this server runs with access to the environment and secrets passed to it.`,
      });
    }

    const remoteUrl = isRemote(server);
    if (remoteUrl) {
      findings.push({
        id: "agents/remote-mcp-server",
        scanner: "agents",
        severity: "medium",
        title: `MCP server "${name}" connects to a remote host in ${path}`,
        evidence: {
          ...base,
          detail: `"${name}" points at ${remoteUrl}. A remote MCP server supplies the tool definitions your agent trusts — a malicious or compromised one can poison them or exfiltrate whatever context is sent.`,
        },
        fix: `Confirm you control and trust ${remoteUrl}. Prefer a local/self-hosted server for anything sensitive, pin the server, and review the tools it exposes.`,
        why: "Your agent trusts an MCP server's tool descriptions implicitly. A remote server you don't control can rewrite a tool's behavior (tool poisoning) or harvest the context and secrets your agent passes it.",
        agentPrompt: `In ${path}, the MCP server "${name}" connects to a remote host (${remoteUrl}). Verify this host is one we own and trust. If it isn't essential, remove it or replace it with a local server; if it is, document who controls it and pin the version, since the agent trusts the tools it advertises.`,
      });
    }

    const secretKeys = hardcodedSecretKeys(server);
    if (secretKeys.length > 0) {
      findings.push({
        id: "agents/hardcoded-mcp-secret",
        scanner: "agents",
        severity: "high",
        title: `MCP server "${name}" has a hardcoded secret in ${path}`,
        evidence: {
          ...base,
          detail: `The ${secretKeys.map((k) => `"${k}"`).join(", ")} value(s) in "${name}" are literal credentials committed to the repo, not environment references.`,
        },
        fix: `Replace the literal value(s) with an environment reference (e.g. \`"\${API_KEY}"\`), move the real secret to an untracked \`.env\`, and rotate the exposed credential.`,
        why: "A credential pasted straight into a committed agent config is public to everyone with repo access and stays in git history. It also gets shipped to whatever machine runs the agent.",
        agentPrompt: `In ${path}, the MCP server "${name}" has hardcoded credential(s) in its ${secretKeys.map((k) => `"${k}"`).join(", ")} field. Replace the literal value(s) with environment-variable references, move the real values into an untracked .env file, and remind me to rotate the exposed credential(s). Do not print the values.`,
      });
    }
  }
  return findings;
}

/** Run every applicable rule over one agent/MCP config or script file. */
export function analyzeAgentFile(
  repo: RepoRef,
  path: string,
  content: string,
): Finding[] {
  const findings: Finding[] = [];

  const auto = autoApproveFinding(repo, path, content);
  if (auto) findings.push(auto);

  if (path.endsWith(".json")) {
    try {
      findings.push(...mcpFindings(repo, path, JSON.parse(content)));
    } catch {
      // unparseable config — not our finding to invent
    }
  }
  return findings;
}
