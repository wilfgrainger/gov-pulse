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
function steps(text: string) {
  const parts = text.split(/^(?=      - name: )/m);
  return parts.filter((part) => part.startsWith("      - name: "));
}

// Commands that run lint or the unit suite. `npm run test:release` is the
// release smoke test, which runs on every release, so it is excluded.
const LINT_OR_TEST_COMMAND =
  /\bnpm (?:run )?(?:lint|test)(?::(?!release\b)[\w-]+)?(?=\s|$|&)|\bnpx vitest\b|\bvitest run\b/;

const DISPATCH_GATE = /^\s+if: github\.event_name == 'workflow_dispatch'$/m;

// Returns the steps that run lint or the unit suite without the dispatch gate.
function ungatedLintOrTestSteps(text: string) {
  return steps(text).filter(
    (step) => LINT_OR_TEST_COMMAND.test(step) && !DISPATCH_GATE.test(step),
  );
}

// Index of the build:prepare step must precede every lint/test step.
function prepareBeforeLintOrTest(text: string) {
  const all = steps(text);
  const prepare = all.findIndex((step) => /\bnpm run build:prepare\b/.test(step));
  const checks = all.flatMap((step, index) => (LINT_OR_TEST_COMMAND.test(step) ? [index] : []));
  return prepare >= 0 && checks.every((index) => prepare < index);
}

describe("deploy workflow", () => {
  it("prepares generated data before any lint or test step", () => {
    const production = jobs().find((job) => job.name === "deploy-production");
    expect(production).toBeDefined();
    expect(prepareBeforeLintOrTest(production!.text)).toBe(true);

    // The previous ordering (validation before build:prepare) must be rejected.
    const previous = [
      "      - name: Validate manually dispatched release source",
      "        if: github.event_name == 'workflow_dispatch'",
      "        run: npm run lint && npm run test",
      "",
      "      - name: Prepare generated data and assets",
      "        run: npm run build:prepare",
      "",
    ].join("\n");
    expect(prepareBeforeLintOrTest(previous)).toBe(false);
  });

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
    const testSteps = steps(workflow).filter((step) =>
      LINT_OR_TEST_COMMAND.test(step),
    );

    expect(testSteps.length).toBeGreaterThan(0);
    expect(ungatedLintOrTestSteps(workflow)).toEqual([]);
  });

  describe("dispatch-only matcher", () => {
    const ungatedNpmTest = `
      - name: Unit tests
        run: npm test
`;
    const ungatedNpmLint = `
      - name: Lint
        run: npm run lint
`;
    const ungatedVitest = `
      - name: Vitest
        run: npx vitest run
`;
    const ungatedUnitSuite = `
      - name: Unit suite
        run: npm run test:unit
`;
    const releaseSmoke = `
      - name: Release smoke
        run: npm run test:release -- "https://public-data.org/" "\${{ github.sha }}"
`;
    const gatedLintAndTest = `
      - name: Validate manually dispatched release source
        if: github.event_name == 'workflow_dispatch'
        run: npm run lint && npm run test
`;

    it("flags an ungated npm test step", () => {
      expect(ungatedLintOrTestSteps(ungatedNpmTest)).toHaveLength(1);
    });

    it("flags an ungated npm run lint step", () => {
      expect(ungatedLintOrTestSteps(ungatedNpmLint)).toHaveLength(1);
    });

    it("flags an ungated npx vitest step", () => {
      expect(ungatedLintOrTestSteps(ungatedVitest)).toHaveLength(1);
    });

    it("flags an ungated npm run test:unit step", () => {
      expect(ungatedLintOrTestSteps(ungatedUnitSuite)).toHaveLength(1);
    });

    it("does not flag the release smoke test npm run test:release", () => {
      expect(ungatedLintOrTestSteps(releaseSmoke)).toEqual([]);
    });

    it("accepts a dispatch-gated lint and test step", () => {
      expect(ungatedLintOrTestSteps(gatedLintAndTest)).toEqual([]);
      expect(steps(gatedLintAndTest)).toHaveLength(1);
    });
  });
});
