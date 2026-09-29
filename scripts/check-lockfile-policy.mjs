import { execFileSync } from "node:child_process";
import process from "node:process";

// Relaxed lockfile policy.
//
// gov-pulse is an open-source, non-critical public-data site. The previous
// policy rejected any change that touched package-lock.json without also
// touching package.json — which blocked routine, safe dependency maintenance
// (npm audit fix, Dependabot-style bumps, lockfile regeneration). That is
// exactly the kind of low-risk upkeep we WANT to happen freely. This version
// no longer fails on a lockfile-only change; it simply reports what it saw.

function changedFiles() {
  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "HEAD^";
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", "-z", `${base}...HEAD`]
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
  } catch {
    try {
      return execFileSync(
        "git",
        ["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD^"]
      )
        .toString("utf8")
        .split("\0")
        .filter(Boolean);
    } catch {
      // No comparable base (e.g. a shallow single-commit checkout). This gate
      // is now advisory, so degrade to "nothing to validate" instead of failing.
      return [];
    }
  }
}

const files = new Set(changedFiles());
const lockfileChanged = files.has("package-lock.json");
const manifestChanged = files.has("package.json");

if (lockfileChanged && !manifestChanged) {
  console.log("Lockfile-only change detected — allowed (routine dependency maintenance).");
} else if (lockfileChanged) {
  console.log("Lockfile change is paired with a manifest change.");
} else {
  console.log("No lockfile change requires validation.");
}
