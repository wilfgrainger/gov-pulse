import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { validationLane } from "./lib/pr-validation-lane.mjs";

const base = process.env.GITHUB_BASE_REF
  ? `origin/${process.env.GITHUB_BASE_REF}`
  : "HEAD^";
let output;
try {
  output = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", "-z", `${base}...HEAD`],
    { encoding: "utf8" }
  );
} catch {
  output = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD^"],
    { encoding: "utf8" }
  );
}

const files = output.split("\0").filter(Boolean);
const lane = validationLane(files);
const report = [
  "## PR validation lane",
  "",
  `- Lane: ${lane}`,
  `- Changed files: ${files.length}`,
  ...files.map((file) => `- \`${file}\``),
].join("\n");

console.log(report);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `lane=${lane}\n`, "utf8");
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`, "utf8");
}
