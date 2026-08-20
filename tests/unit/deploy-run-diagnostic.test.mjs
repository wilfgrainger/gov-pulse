// Disposable diagnostic. This branch and PR must never merge.
import { expect, it } from "vitest";

it("prints the latest production deploy runs", async () => {
  const response = await fetch(
    "https://api.github.com/repos/wilfgrainger/gov-pulse/actions/workflows/deploy.yml/runs?per_page=5",
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "public-data-deploy-run-diagnostic/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  const payload = await response.json();
  const runs = (payload.workflow_runs ?? []).map((run) => ({
    id: run.id,
    runNumber: run.run_number,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
  }));
  console.log("DEPLOY_RUN_DIAGNOSTICS", JSON.stringify({ status: response.status, runs }));
  expect(runs.length, "diagnostic intentionally fails after printing run status").toBe(-1);
}, 20_000);
