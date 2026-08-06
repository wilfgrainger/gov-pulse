import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { assessChanges } from "./lib/change-complexity.mjs";

function diffBase() {
  return process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "HEAD^";
}

function numstat() {
  const base = diffBase();
  let output;
  try {
    output = execFileSync("git", ["diff", "--numstat", `${base}...HEAD`], {
      encoding: "utf8",
    });
  } catch {
    output = execFileSync("git", ["diff", "--numstat", "HEAD^"], {
      encoding: "utf8",
    });
  }

  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [added, deleted, ...pathParts] = line.split("\t");
      return {
        path: pathParts.join("\t"),
        additions: added === "-" ? 0 : Number(added),
        deletions: deleted === "-" ? 0 : Number(deleted),
        binary: added === "-" || deleted === "-",
      };
    });
}

const assessment = assessChanges(numstat());
const summary = [
  "## Change complexity",
  "",
  `- Files: ${assessment.fileCount}`,
  `- Concern groups: ${assessment.concerns.join(", ") || "none"}`,
  `- Non-data source additions: ${assessment.sourceAdditions}`,
  "",
  "### Largest changed files",
  "",
  ...assessment.largest.map(
    (entry) => `- \`${entry.path}\`: +${entry.additions} / -${entry.deletions}`
  ),
];

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`, "utf8");
}

if (assessment.violations.length > 0) {
  console.error("Autonomous change complexity budget exceeded:\n");
  for (const violation of assessment.violations) console.error(`- ${violation}`);
  console.error("\nSplit unrelated concerns into issue-scoped PRs or document a mechanical migration separately.");
  process.exit(1);
}

console.log(summary.join("\n"));
