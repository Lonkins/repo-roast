/**
 * Bundled secret-detection rules for the API blob-walk strategy — a curated
 * subset of gitleaks' ruleset covering the highest-signal token formats.
 * The gitleaks binary strategy (self-host) uses gitleaks' own full ruleset.
 */

export interface SecretRule {
  id: string;
  description: string;
  regex: RegExp;
  /** require Shannon entropy of the match above this, for generic rules */
  minEntropy?: number;
}

export const SECRET_RULES: SecretRule[] = [
  {
    id: "aws-access-key-id",
    description: "AWS access key ID",
    regex: /\b(A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/,
  },
  {
    id: "github-token",
    description: "GitHub personal access / app token",
    regex:
      /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  },
  {
    id: "private-key",
    description: "Private key material",
    regex:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    id: "slack-token",
    description: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    id: "stripe-secret-key",
    description: "Stripe secret key",
    regex: /\b[rs]k_live_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: "openai-api-key",
    description: "OpenAI API key",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: "anthropic-api-key",
    description: "Anthropic API key",
    regex: /\bsk-ant-[A-Za-z0-9-]{20,}\b/,
  },
  {
    id: "google-api-key",
    description: "Google API key",
    regex: /\bAIza[A-Za-z0-9_-]{35}\b/,
  },
  {
    id: "npm-token",
    description: "npm access token",
    regex: /\bnpm_[A-Za-z0-9]{36}\b/,
  },
  {
    id: "jwt",
    description: "Hardcoded JSON Web Token",
    regex:
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: "generic-credential-assignment",
    description: "High-entropy value assigned to a credential-named variable",
    regex:
      /(?:secret|password|passwd|api[_-]?key|auth[_-]?token|access[_-]?token)["']?\s*[:=]\s*["']([A-Za-z0-9+/_=-]{16,})["']/i,
    minEntropy: 3.5,
  },
];

/** Shannon entropy in bits per character. */
export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export interface RuleMatch {
  rule: SecretRule;
  /** the line the match occurred on — used for location only, never displayed */
  lineNumber: number;
}

/** Scan text with the bundled rules. Returns matches without secret values. */
export function matchSecrets(text: string): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const lines = text.split("\n");
  for (const rule of SECRET_RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const m = rule.regex.exec(line);
      if (!m) continue;
      if (rule.minEntropy !== undefined) {
        const candidate = m[1] ?? m[0];
        if (shannonEntropy(candidate) < rule.minEntropy) continue;
      }
      matches.push({ rule, lineNumber: i + 1 });
      break; // one hit per rule per file chunk is enough signal
    }
  }
  return matches;
}
