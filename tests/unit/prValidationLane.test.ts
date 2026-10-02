import { describe, expect, it } from "vitest";
import { isDocumentationOnlyPath, validationLane } from "../../scripts/lib/pr-validation-lane.mjs";

describe("pull-request validation lanes", () => {
  it("keeps prose-only changes on the fast lane", () => {
    expect(validationLane(["README.md", "docs/architecture/overview.md"])).toBe("docs");
    expect(isDocumentationOnlyPath(".agents/skills/cave-pony/SKILL.md")).toBe(true);
    expect(isDocumentationOnlyPath(".github/ISSUE_TEMPLATE/bug_report.md")).toBe(true);
    expect(isDocumentationOnlyPath(".github/ISSUE_TEMPLATE/bug_report.yaml")).toBe(false);
  });

  it("runs code checks for executable and machine-readable files in documentation folders", () => {
    for (const file of [
      "docs/architecture/source-ownership.json",
      "docs/tools/check.mjs",
      ".agents/hooks/check.mjs",
      ".github/workflows/pr-validation.yml",
      ".gitignore",
      ".editorconfig",
      "contracts/public-surfaces.json",
    ]) {
      expect(isDocumentationOnlyPath(file), file).toBe(false);
      expect(validationLane([file]), file).toBe("full");
    }
  });

  it("does not classify an empty or mixed change as documentation-only", () => {
    expect(validationLane([])).toBe("full");
    expect(validationLane(["README.md", "worker/public-data-entry.js"])).toBe("full");
  });
});
