import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const repository = process.env.GITHUB_REPOSITORY ?? "wilfgrainger/gov-pulse";
const token = process.env.GITHUB_TOKEN ?? "";

function localSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "public-data-org-state-report",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${path}`);
  }
  return response.json();
}

function itemList(items, emptyText) {
  if (items.length === 0) return `- ${emptyText}`;
  return items.map((item) => `- #${item.number} ${item.title}`).join("\n");
}

async function render() {
  const checkedAt = new Date().toISOString();
  const fallback = [
    "## Live GitHub state",
    "",
    `- Checked at: ${checkedAt}`,
    `- Repository: ${repository}`,
    `- Checked-out SHA: ${localSha()}`,
  ];

  if (!token) {
    return [
      ...fallback,
      "- Status: unknown — GITHUB_TOKEN was not available",
      "- Open pull requests: unknown",
      "- Open issues: unknown",
    ].join("\n");
  }

  try {
    const [repo, pulls, issueResults] = await Promise.all([
      github(`/repos/${repository}`),
      github(`/repos/${repository}/pulls?state=open&per_page=100`),
      github(`/repos/${repository}/issues?state=open&per_page=100`),
    ]);
    const defaultBranch = repo.default_branch;
    const branch = await github(`/repos/${repository}/branches/${defaultBranch}`);
    const issues = issueResults.filter((item) => !item.pull_request);

    return [
      "## Live GitHub state",
      "",
      `- Checked at: ${checkedAt}`,
      `- Repository: ${repository}`,
      `- Default branch: ${defaultBranch}`,
      `- Default-branch SHA: ${branch.commit.sha}`,
      `- Checked-out SHA: ${localSha()}`,
      "",
      "### Open pull requests",
      "",
      itemList(pulls, "None"),
      "",
      "### Open issues",
      "",
      itemList(issues, "None"),
    ].join("\n");
  } catch (error) {
    return [
      ...fallback,
      `- Status: unknown — ${error instanceof Error ? error.message : String(error)}`,
      "- Open pull requests: unknown",
      "- Open issues: unknown",
    ].join("\n");
  }
}

const report = await render();
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`, "utf8");
}
