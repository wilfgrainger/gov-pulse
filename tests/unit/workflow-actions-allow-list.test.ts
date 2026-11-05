import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflowDir = path.join(root, ".github", "workflows");
const ALLOWED = /^actions\/(checkout|setup-node|upload-artifact)@\S+$/;

describe("CI action allow-list", () => {
  it("every uses: in .github/workflows matches the documented allow-list", () => {
    const files = readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    let count = 0;
    for (const file of files) {
      const text = readFileSync(path.join(workflowDir, file), "utf8");
      for (const match of text.matchAll(/^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)/gm)) {
        count += 1;
        expect(match[1], `${file} uses ${match[1]}`).toMatch(ALLOWED);
      }
    }
    expect(count).toBeGreaterThan(0);

    const docs = readFileSync(path.join(root, "docs/operations/deployment-ci-frugality.md"), "utf8");
    expect(docs).toContain("actions/checkout@*, actions/setup-node@*, actions/upload-artifact@*");
  });
});
