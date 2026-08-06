import { execFileSync } from "node:child_process";
import process from "node:process";

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
    return execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD^"]
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
  }
}

const files = new Set(changedFiles());
const lockfileChanged = files.has("package-lock.json");
const manifestChanged = files.has("package.json");
const explicitOverride = process.argv.includes("--allow-lockfile-only");

if (lockfileChanged && !manifestChanged && !explicitOverride) {
  console.error(
    "package-lock.json changed without package.json. Restore the lockfile, or use " +
      "--allow-lockfile-only for an intentional, separately reviewed lockfile-maintenance change."
  );
  process.exit(1);
}

if (explicitOverride && !lockfileChanged) {
  console.error("--allow-lockfile-only was supplied but package-lock.json did not change.");
  process.exit(1);
}

console.log(
  lockfileChanged
    ? "Lockfile change is paired with a manifest change or explicit maintenance override."
    : "No lockfile change requires validation."
);
