import { describe, expect, it } from "vitest";
import { assessChanges, concernForPath } from "@/scripts/lib/change-complexity.mjs";

type Entry = {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
};

const entry = (
  path: string,
  additions = 10,
  deletions = 2,
  binary = false
): Entry => ({ path, additions, deletions, binary });

describe("change complexity budget", () => {
  it("accepts a focused issue-scoped change", () => {
    const assessment = assessChanges([
      entry("scripts/check-example.mjs", 45, 0),
      entry("tests/unit/check-example.test.ts", 40, 0),
      entry(".github/workflows/pr-validation.yml", 4, 0),
    ]);

    expect(assessment.violations).toEqual([]);
    expect(assessment.concerns).toEqual(["delivery", "tests", "tooling"]);
  });

  it("rejects the mixed-concern and lockfile-churn shape seen in oversized PRs", () => {
    const assessment = assessChanges([
      entry("app/components/Example.tsx", 400, 100),
      entry("worker/example.js", 400, 100),
      entry("scripts/example.mjs", 400, 100),
      entry("tests/unit/example.test.ts", 400, 100),
      entry("docs/example.md", 100, 20),
      entry("data/example.json", 5000, 0),
      entry("package-lock.json", 9500, 9500),
    ]);

    expect(assessment.violations.join(" ")).toMatch(/concern groups/i);
    expect(assessment.violations.join(" ")).toMatch(/lockfile/i);
  });

  it("does not treat a versioned data-only fixture as source-code complexity", () => {
    const assessment = assessChanges([entry("data/official/large-fixture.json", 12000, 0)]);

    expect(assessment.sourceAdditions).toBe(0);
    expect(assessment.violations).toEqual([]);
  });

  it("classifies dependency and agent-skill paths explicitly", () => {
    expect(concernForPath("package-lock.json")).toBe("dependencies");
    expect(concernForPath(".agents/skills/cave-pony/SKILL.md")).toBe("governance");
  });
});
