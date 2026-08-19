import { describe, expect, it } from "vitest";
import {
  isDocumentationOnlyPath,
  validationLane,
} from "@/scripts/lib/pr-validation-lane.mjs";

describe("PR validation lanes", () => {
  it("uses the lightweight lane only when every path is durable documentation", () => {
    expect(validationLane(["README.md", "docs/architecture/example.md"])).toBe(
      "docs"
    );
  });

  it("uses full validation for application, evidence and test changes", () => {
    expect(validationLane(["docs/note.md", "app/page.tsx"])).toBe("full");
    expect(validationLane(["data/example.json"])).toBe("full");
    expect(validationLane(["tests/unit/example.test.ts"])).toBe("full");
  });

  it("uses full validation for workflows, manifests and unknown paths", () => {
    expect(validationLane([".github/workflows/pr-validation.yml"])).toBe("full");
    expect(validationLane(["package.json"])).toBe("full");
    expect(validationLane(["misc/unknown.txt"])).toBe("full");
    expect(validationLane([])).toBe("full");
  });

  it("recognises issue templates but not workflow files as documentation-only", () => {
    expect(isDocumentationOnlyPath(".github/ISSUE_TEMPLATE/bug.md")).toBe(true);
    expect(isDocumentationOnlyPath(".github/workflows/deploy.yml")).toBe(false);
  });
});
