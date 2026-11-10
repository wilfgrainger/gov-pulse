import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { isDocumentationOnlyPath, staticExportCheck, validationLane } from "../../scripts/lib/pr-validation-lane.mjs";

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

describe("static export check lane output", () => {
  it("static-export surface change enables the export check", () => {
    for (const file of [
      "next.config.ts", "scripts/build-edition-site.mjs", "app/lib/editionManifest.ts",
      "worker/asset-gate.js", "worker/static-wrangler.toml",
      "app/compare/page.tsx", "app/measure/page.tsx", "app/sources/[id]/page.tsx",
    ]) expect(staticExportCheck([file]), file).toBe(true);
    expect(staticExportCheck(["README.md", "worker/pipeline.js"])).toBe(false);
  });

  it("default full lane contains no second Next build", () => {
    const workflow = fs.readFileSync(".github/workflows/pr-validation.yml", "utf8");
    expect(workflow).not.toMatch(/next build/);
    expect(workflow).toMatch(/if: needs\.classify\.outputs\.static_export_check == 'true'/);
    expect(workflow).toMatch(/STATIC_EXPORT_CHECK: "1"/);
    expect(workflow).toMatch(/workflow_dispatch/);
  });
});
