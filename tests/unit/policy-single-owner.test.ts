// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "worker", "scripts", "contracts"];
const OWNER = "contracts/evidence-policy.js";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "generated" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(js|mjs|ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const files = SOURCE_DIRS.flatMap((dir) => walk(join(ROOT, dir))).map((path) => ({
  path: relative(ROOT, path),
  text: readFileSync(path, "utf8"),
}));

describe("policy", () => {
  it("only evidence-policy defines currentness", () => {
    const definition = /(?:function\s+|const\s+)(filterCurrentSnapshot|currentSectionRecord|sectionValidityDeadline)\b/;
    const offenders = files.filter((f) => f.path !== OWNER && definition.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("keeps source-status literals out of app/lib", () => {
    const offenders = files
      .filter((f) => f.path.startsWith("app/lib/"))
      .filter((f) => /status\s*!==\s*"ok"|cacheState\s*!==\s*"fresh"/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("has no hard-coded section arrays on the cost-of-living page", () => {
    const page = files.find((f) => f.path === "app/cost-of-living/page.tsx")!;
    expect(page.text).not.toMatch(/\[\s*"sentimentPulse"/);
  });

  it("no module imports worker/publication-currentness or worker/freshness-policy", () => {
    const offenders = files
      .filter((f) => /publication-currentness|freshness-policy/.test(f.text.replace(/\/\/.*$/gm, "")))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("no module imports evidence-policy re-exports through contracts/publication-policy", () => {
    const reexported = [
      "PUBLICATION_CONFIG", "PUBLICATION_STATES", "filterPublicationCatalog", "filterPublicationSnapshot",
      "filterPublicationSummary", "publicationDecision", "publicationHeld", "publicationPublished",
      "publicationRetired", "publicationState",
    ];
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of f.text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*publication-policy(?:\.js)?["']/g)) {
        const names = m[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]);
        if (names.some((n) => reexported.includes(n))) offenders.push(f.path);
      }
    }
    expect(offenders).toEqual([]);
  });
});
