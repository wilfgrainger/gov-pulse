// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

const removedPaths = [
  "worker/economy-section-cache.js",
  "worker/health-report.js",
  "app/components/WithdrawnEvidence.tsx",
  "scripts/ensure-cloudflare-pages-domain.mjs",
  "scripts/fetch-betting-odds.mjs",
  "scripts/prepare-election-poll-ingest.mjs",
  "scripts/verify-uk-context-route.mjs",
  "tests/worker/economy-section-cache.test.ts",
  "tests/worker/health-report.test.ts",
];

// Kept on purpose: the NHS retrieval path is undecided (master plan Wave 3).
const keptPaths = ["scripts/prepare-nhs-rtt-ingest.mjs", "scripts/nhs-rtt-parser.mjs"];

const forbiddenPattern = /createEconomySectionCache|readManifest|v10:manifest|v10:section:/;

// Scans only runtime source. tests/ and docs/ are excluded so this test file
// and documentation that describes the removals cannot match the pattern.
const scannedRoots = ["worker", "app", "scripts"];
const skippedDirs = new Set(["node_modules", "generated", ".next", ".open-next"]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skippedDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

describe("dead code", () => {
  it("removed modules stay removed", () => {
    for (const file of removedPaths) {
      expect(fs.existsSync(path.join(root, file)), `${file} should be deleted`).toBe(false);
    }

    for (const file of keptPaths) {
      expect(fs.existsSync(path.join(root, file)), `${file} should be kept`).toBe(true);
    }

    const offenders = scannedRoots
      .flatMap((dir) => walk(path.join(root, dir)))
      .filter((file) => forbiddenPattern.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file));

    expect(offenders).toEqual([]);
  });
});
