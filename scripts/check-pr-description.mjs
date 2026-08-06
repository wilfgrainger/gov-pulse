import fs from "node:fs";
import process from "node:process";
import { changedFiles } from "./lib/pr-changed-files.mjs";
import { validatePrDescription } from "./lib/pr-description-policy.mjs";

function pullRequestChangedFiles(baseRef) {
  const base = `origin/${baseRef}`;
  try {
    return changedFiles(base);
  } catch (error) {
    console.error(
      `Could not compare the PR with ${base}. Ensure actions/checkout uses fetch-depth: 0.`
    );
    throw error;
  }
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath || !fs.existsSync(eventPath)) {
  console.log("PR description check skipped: GITHUB_EVENT_PATH is unavailable.");
  process.exit(0);
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const pullRequest = event.pull_request;
if (!pullRequest) {
  console.log("PR description check skipped: event is not a pull request.");
  process.exit(0);
}

const body = pullRequest.body ?? "";
const baseRef = pullRequest.base?.ref ?? process.env.GITHUB_BASE_REF ?? "main";
const headSha = pullRequest.head?.sha ?? "";
const failures = validatePrDescription(body, pullRequestChangedFiles(baseRef), headSha);

if (failures.length > 0) {
  console.error("Pull request description does not match the diff/evidence policy:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Pull request description matches the diff and current head ${headSha}.`);
