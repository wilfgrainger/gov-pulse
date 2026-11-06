import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/deploy.yml"),
  "utf8",
);

// Jobs are the two-space indented keys directly under `jobs:`.
function jobs() {
  const jobsStart = workflow.indexOf("\njobs:\n");
  if (jobsStart < 0) throw new Error("Missing jobs section");
  const body = workflow.slice(jobsStart + "\njobs:\n".length);
  const parts = body.split(/^  ([a-z][a-z0-9-]*):\n/m);
  const result: Array<{ name: string; text: string }> = [];
  for (let i = 1; i < parts.length; i += 2) {
    result.push({ name: parts[i], text: parts[i + 1] });
  }
  return result;
}

// Steps are list items starting with `- name:` at six-space indentation.
function steps(jobText: string) {
  const parts = jobText.split(/^(?=      - name: )/m);
  return parts.filter((part) => part.startsWith("      - name: "));
}

const LINT_OR_TEST = /npm run (lint && )?test(\s|$)/;

describe("deploy workflow", () => {
  it("installs dependencies once", () => {
    const installing = jobs().filter((job) => job.text.includes("npm ci"));
    expect(installing.map((job) => job.name)).toEqual(["deploy-production"]);

    for (const job of jobs()) {
      const count = job.text.split("npm ci").length - 1;
      expect(count, `${job.name} npm ci occurrences`).toBeLessThanOrEqual(1);
    }
    const total = workflow.split("npm ci").length - 1;
    expect(total).toBe(1);
  });

  it("lint and tests remain dispatch-only", () => {
    const testSteps = jobs().flatMap((job) =>
      steps(job.text)
        .filter((step) => LINT_OR_TEST.test(step))
        .map((step) => ({ job: job.name, step })),
    );

    expect(testSteps.length).toBeGreaterThan(0);
    for (const { job, step } of testSteps) {
      expect(
        step,
        `${job} lint/test step must be gated to workflow_dispatch`,
      ).toMatch(/^\s+if: github\.event_name == 'workflow_dispatch'$/m);
    }
  });
});
