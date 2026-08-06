import { execFileSync } from "node:child_process";

const DIFF_FILTER = "ACMRD";

function changedFileArguments(baseRevision) {
  return [
    "diff",
    "--name-only",
    "--no-renames",
    `--diff-filter=${DIFF_FILTER}`,
    "-z",
    `${baseRevision}...HEAD`,
  ];
}

function changedFiles(baseRevision, cwd = process.cwd()) {
  return execFileSync("git", changedFileArguments(baseRevision), {
    cwd,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

export { DIFF_FILTER, changedFileArguments, changedFiles };
