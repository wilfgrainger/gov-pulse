import fs from "node:fs";
import process from "node:process";
import { durationSeconds, median, stepSeconds } from "./lib/workflow-cost.mjs";

const token = process.env.GITHUB_TOKEN ?? "";
const repository = process.env.GITHUB_REPOSITORY ?? "wilfgrainger/gov-pulse";

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "public-data-org-workflow-cost",
    },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${path}`);
  return response.json();
}

function formatSeconds(value) {
  if (!Number.isFinite(value)) return "unknown";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}m ${seconds}s`;
}

async function report() {
  if (!token) return "## Deployment workflow cost\n\nStatus: unknown — GITHUB_TOKEN unavailable.";

  try {
    const response = await github(
      `/repos/${repository}/actions/workflows/deploy.yml/runs?status=completed&per_page=20`
    );
    const runs = response.workflow_runs
      .filter((run) => run.event === "push" || run.event === "schedule")
      .slice(0, 10);
    const samples = [];

    for (const run of runs) {
      const jobsResponse = await github(
        `/repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`
      );
      const jobs = jobsResponse.jobs ?? [];
      samples.push({
        event: run.event,
        duration: durationSeconds(run.run_started_at ?? run.created_at, run.updated_at),
        npm: stepSeconds(jobs, ["Install dependencies"]).reduce(
          (total, value) => total + value,
          0
        ),
        browser: stepSeconds(jobs, [
          "Install Playwright browser",
          "Install publication extractors",
        ]).reduce((total, value) => total + value, 0),
      });
    }

    const lines = ["## Deployment workflow cost", ""];
    for (const event of ["push", "schedule"]) {
      const group = samples.filter((sample) => sample.event === event);
      lines.push(`### ${event}`, "");
      lines.push(`- Completed runs sampled: ${group.length}`);
      lines.push(`- Median workflow duration: ${formatSeconds(median(group.map((item) => item.duration)))}`);
      lines.push(`- Median total npm install time: ${formatSeconds(median(group.map((item) => item.npm)))}`);
      lines.push(`- Median browser/extractor setup time: ${formatSeconds(median(group.map((item) => item.browser)))}`);
      lines.push("");
    }
    return lines.join("\n");
  } catch (error) {
    return `## Deployment workflow cost\n\nStatus: unknown — ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

const output = await report();
console.log(output);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${output}\n`, "utf8");
}
