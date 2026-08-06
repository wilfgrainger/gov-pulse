import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const RETIRED_PATHS = ["fetch_intel.py", "public/daily_threat_data.json"];

function workflowFiles() {
  const directory = path.join(ROOT, ".github", "workflows");
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

describe("legacy ingestion retirement", () => {
  it("keeps the unsupported aggregator and output out of the repository", () => {
    for (const retiredPath of RETIRED_PATHS) {
      expect(fs.existsSync(path.join(ROOT, retiredPath)), retiredPath).toBe(false);
    }
  });

  it("keeps package scripts and workflows free of the retired path", () => {
    const supportedExecutionFiles = [
      path.join(ROOT, "package.json"),
      ...workflowFiles(),
    ];

    for (const file of supportedExecutionFiles) {
      const content = fs.readFileSync(file, "utf8");
      for (const retiredPath of RETIRED_PATHS) {
        expect(content, `${file} references ${retiredPath}`).not.toContain(retiredPath);
      }
    }
  });
});
