import fs from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("repository residue", () => {
  it("does not commit volatile progress state", () => {
    expect(fs.existsSync(".agents/PROGRESS.md")).toBe(false);

    const guide = source("AGENTS.md");
    expect(guide).not.toContain(".agents/PROGRESS.md");
    expect(guide).toContain("derive current repository, pull-request and deployment state from GitHub");
  });

  it("keeps the live state reporter focused on live state rather than policing a handoff file", () => {
    const reporter = source("scripts/report-github-current-state.mjs");

    expect(reporter).not.toContain('const progressPath = ".agents/PROGRESS.md"');
    expect(reporter).not.toContain("validateProgress");
  });

  it("does not ship the unused motion dependency", () => {
    const manifest = source("package.json");
    const lockfile = source("package-lock.json");

    expect(manifest).not.toContain('"framer-motion"');
    expect(lockfile).not.toContain('"framer-motion"');
    expect(lockfile).not.toContain('"node_modules/framer-motion"');
  });
});
