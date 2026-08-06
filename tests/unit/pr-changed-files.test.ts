import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DIFF_FILTER,
  changedFileArguments,
  changedFiles,
} from "@/scripts/lib/pr-changed-files.mjs";
import { validatePrDescription } from "@/scripts/lib/pr-description-policy.mjs";

const temporaryDirectories: string[] = [];
const FIXTURE_DIRECTORY = "fixtures";

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function fixturePath(file: string) {
  return `${FIXTURE_DIRECTORY}/${file}`;
}

function write(cwd: string, file: string, content: string) {
  const target = path.join(cwd, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function fixtureRepository() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "gov-metrics-pr-paths-"));
  temporaryDirectories.push(cwd);
  git(cwd, "init", "--initial-branch=main");
  git(cwd, "config", "user.email", "tests@public-data.org");
  git(cwd, "config", "user.name", "public-data.org tests");

  write(cwd, fixturePath("modified.txt"), "before\n");
  write(cwd, fixturePath("deleted.txt"), "delete me\n");
  write(cwd, fixturePath("renamed-old.txt"), "rename me\n");
  git(cwd, "add", ".");
  git(cwd, "commit", "-m", "base");
  const base = git(cwd, "rev-parse", "HEAD");

  write(cwd, fixturePath("modified.txt"), "after\n");
  fs.rmSync(path.join(cwd, fixturePath("deleted.txt")));
  fs.renameSync(
    path.join(cwd, fixturePath("renamed-old.txt")),
    path.join(cwd, fixturePath("renamed-new.txt"))
  );
  write(cwd, fixturePath("added.txt"), "new\n");
  git(cwd, "add", "-A");
  git(cwd, "commit", "-m", "change all path states");
  return { cwd, base };
}

function body(paths: string[]) {
  return `Closes #231

## What changed

${paths.map((file) => `- updates \`${file}\``).join("\n")}

## Public impact

None.

## Validation

Exact-head checks are required before merge.
`;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("pull-request changed file discovery", () => {
  it("includes added, modified, deleted and both sides of a rename", () => {
    const { cwd, base } = fixtureRepository();
    expect(DIFF_FILTER).toBe("ACMRD");
    expect(changedFileArguments(base)).toContain("--no-renames");
    expect(changedFiles(base, cwd).sort()).toEqual([
      fixturePath("added.txt"),
      fixturePath("deleted.txt"),
      fixturePath("modified.txt"),
      fixturePath("renamed-new.txt"),
      fixturePath("renamed-old.txt"),
    ]);
  });

  it("accepts truthful deleted and renamed path claims but rejects invented paths", () => {
    const { cwd, base } = fixtureRepository();
    const files = changedFiles(base, cwd).sort();
    expect(validatePrDescription(body(files), files, "a".repeat(40))).toEqual([]);

    const inventedPath = fixturePath("never-existed.txt");
    const invented = [...files, inventedPath];
    expect(validatePrDescription(body(invented), files, "a".repeat(40)).join(" ")).toMatch(
      /fixtures\/never-existed\.txt.*absent from the diff/i
    );
  });
});
