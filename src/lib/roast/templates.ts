import type { Finding } from "../engine/types";

/** Deterministic non-negative hash so the same finding always picks the same
 * burn (reproducible roasts) while different findings vary. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(options: T[], seed: string): T {
  return options[hashString(seed) % options.length]!;
}

const p = (f: Finding) => f.evidence.path ?? "somewhere in there";

/** Burn banks, keyed by finding id. Each targets the CODE, never the coder. */
const BURNS: Record<string, (f: Finding) => string[]> = {
  "secrets/committed-dotenv": (f) => [
    `\`${p(f)}\` is committed. The "env" stands for "everyone now views."`,
    `A tracked \`${p(f)}\` — bold of this repo to assume secrets wanted privacy.`,
    `\`${p(f)}\` in the tree. git add -A really said "and the credentials too."`,
  ],
  "secrets/leaked-credential": (f) => [
    `There's a live credential sitting in \`${p(f)}\`. It's not hidden, it's just... trusting.`,
    `A working secret in \`${p(f)}\` — great for attackers, less great for you.`,
    `\`${p(f)}\` ships a real key. The repo is basically a "please rotate me" form.`,
  ],
  "secrets/leaked-credential-history": (f) => [
    `The secret got deleted from \`${p(f)}\`, but git is a diary that never forgets. It's still in history.`,
    `Deleting the file didn't delete the secret — git kept a copy out of spite. Check the history.`,
    `\`${p(f)}\` was cleaned up on the surface. History still has the receipts.`,
  ],
  "workflows/pull-request-target-checkout": (f) => [
    `\`${p(f)}\` uses pull_request_target AND checks out the PR's code. That's handing the keys to a stranger and asking them to drive.`,
    `pull_request_target + untrusted checkout in \`${p(f)}\`: the security equivalent of "what could go wrong?"`,
    `This workflow runs your secrets against attacker-authored code. Chef's kiss of RCE.`,
  ],
  "workflows/broad-permissions": (f) => [
    `\`${p(f)}\` grants write-all. Every step now has admin, including the one that runs a random action.`,
    `The token in \`${p(f)}\` can do everything. That's not a permission, that's a hall pass to the whole school.`,
    `write-all permissions: because scoping is hard and regret is easy.`,
  ],
  "workflows/script-injection": (f) => [
    `\`${p(f)}\` pipes a PR title straight into the shell. Someone's going to name their PR \`; rm -rf\` and mean it.`,
    `Untrusted input interpolated into a run step — the shell can't tell your data from a command, and neither can you now.`,
    `A cleverly-named issue could run commands here. The workflow trusts strangers to be nice.`,
  ],
  "workflows/unpinned-action": (f) => [
    `A third-party action pinned to a floating tag. You're running whatever they push tomorrow, sight unseen.`,
    `\`${p(f)}\` trusts a moving tag. Supply-chain roulette with extra steps.`,
    `Unpinned action: you didn't choose a version, you chose a vibe.`,
  ],
  "deps/known-vulnerability": (f) => [
    `A dependency in \`${p(f)}\` has a public CVE. The vulnerability isn't hiding — it has a webpage.`,
    `\`${p(f)}\` ships a package with a known hole. Attackers read the same advisories you skipped.`,
    `Known-vulnerable dependency detected. It's not a zero-day, it's a "we've known for a while" day.`,
  ],
  "hygiene/suspicious-file": (f) => [
    `\`${p(f)}\` is in the repo. That's a file that usually comes with a "why is this public?" energy.`,
    `Found \`${p(f)}\` tracked in git. Some files are meant to be seen; this is not one of them.`,
    `\`${p(f)}\` really said "ship it." It should not have said that.`,
  ],
  "hygiene/committed-artifacts": (f) => [
    `Build artifacts are committed. The repo is carrying luggage git was built to leave at home.`,
    `\`${p(f)}\` is generated and tracked. Every diff now includes machine noise nobody reads.`,
    `Committed \`${p(f)}\` — version-controlling the output instead of the source, living dangerously.`,
  ],
  "hygiene/missing-security-md": () => [
    `No SECURITY.md. When someone finds a bug, their only option is to yell about it publicly.`,
    `There's nowhere to report a vulnerability privately, so people just... won't. Or worse, will loudly.`,
    `Missing SECURITY.md: the "no comment" of open source.`,
  ],
  "hygiene/missing-license": () => [
    `Public repo, no license. Legally, everyone's just admiring the code through glass.`,
    `No LICENSE means "all rights reserved" by default — the opposite of what a public repo usually wants.`,
    `Missing license: the code is open, the permission to use it is not.`,
  ],
};

const GENERIC = (f: Finding) => [
  `${f.title} — and not in a fun way.`,
  `Flagged: ${f.title}. The fix is right there, though.`,
];

/** Pick a deterministic burn for a finding. */
export function burnFor(finding: Finding): string {
  const bank = BURNS[finding.id]?.(finding) ?? GENERIC(finding);
  const seed = `${finding.id}:${finding.evidence.path ?? ""}:${finding.evidence.ref ?? ""}`;
  return pick(bank, seed);
}

const INTROS: [minScore: number, lines: string[]][] = [
  [
    90,
    [
      "Okay. Deep breath. This repo is a five-alarm fire and we're the only ones who showed up with a hose.",
      "I've seen a lot of repos. This one made me sit down first.",
    ],
  ],
  [
    70,
    [
      "This repo is actively smoldering. Grab the extinguisher labeled 'git'.",
      "Good news: there's a lot to work with. Bad news: it's because there's a lot going on.",
    ],
  ],
  [
    45,
    [
      "Smoke detected. Not a disaster, but somebody left something on.",
      "A few things here would make a security reviewer tilt their head.",
    ],
  ],
  [
    20,
    [
      "Mostly solid, singed around one or two edges.",
      "Pretty tidy — just a couple of spots asking for attention.",
    ],
  ],
  [
    1,
    [
      "Barely a wisp of smoke. We had to look hard for these.",
      "Nearly spotless. Nitpicks incoming, and that's a compliment.",
    ],
  ],
];

const CLEAN_ROAST = [
  "Well, this is awkward. I came to roast and found... nothing. No secrets, no cursed workflows, no vulnerable deps, no skeletons in the git history. Grudging respect. Keep it up before I have to write jokes about how there are no jokes.",
  "I scanned the whole thing looking for a burn and came up empty. That's the highest compliment this tool gives. Suspiciously clean — in the good way.",
];

const OUTROS = [
  "Every burn above comes with a fix. Roast the code, fix the code, repeat.",
  "None of this is about you — it's about the code, and the code can be fixed. Go get 'em.",
  "The jokes are free. The fixes are the point. Ship them.",
];

export function introFor(score: number, seed: string): string {
  const band = INTROS.find(([min]) => score >= min);
  if (!band) return pick(CLEAN_ROAST, seed);
  return pick(band[1], seed);
}

export function cleanRoast(seed: string): string {
  return pick(CLEAN_ROAST, seed);
}

export function outroFor(seed: string): string {
  return pick(OUTROS, seed);
}
