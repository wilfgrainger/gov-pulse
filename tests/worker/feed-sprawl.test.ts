// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { COPIED, addProbeFeed, checkProjections, copyRepo, probeJson, regenerateProjections } from "./feed-probe";

const root = process.cwd();
const GENERATED = new Set([
  "feeds/definitions.generated.js",
  "contracts/section-discovery.json",
  "contracts/measure-definitions.json",
]);

function hashes(dir: string): Map<string, string> {
  const result = new Map<string, string>();
  const walk = (relative: string) => {
    for (const entry of readdirSync(join(dir, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) result.set(path, createHash("sha256").update(readFileSync(join(dir, path))).digest("hex"));
    }
  };
  for (const folder of COPIED) walk(folder);
  return result;
}

describe("feed sprawl", () => {
  const work = mkdtempSync(join(tmpdir(), "feed-sprawl-"));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it("a new feed needs only its folder and one index entry", () => {
    copyRepo(root, work);
    const before = hashes(work);

    addProbeFeed(work);
    regenerateProjections(work);
    checkProjections(work);

    const probe = probeJson(
      work,
      `import * as r from "./feeds/registry.js";
       import { decisionFor } from "./contracts/evidence-policy.js";
       import { FEED_CATALOG } from "./contracts/source-catalog.js";
       import { SECTION_COLLECTION_PLAN } from "./worker/publication-plan.js";
       import { OBSERVATION_CONTRACTS } from "./worker/observation-contract.js";
       console.log(JSON.stringify({
         catalog: Boolean(r.feedCatalog().probeFeed), legacyCatalog: Boolean(FEED_CATALOG.probeFeed),
         plan: r.collectionPlan().probeFeed, legacyPlan: SECTION_COLLECTION_PLAN.probeFeed,
         contract: Boolean(OBSERVATION_CONTRACTS.probeFeed),
         download: r.downloadIds().includes("probeFeed"),
         release: r.releaseFamilies().some((f) => f.feedId === "probeFeed"),
         discovery: r.sectionDiscovery()["probe-feed"]?.sourceKey,
         registry: Boolean(r.FEED_REGISTRY.probeFeed),
         decision: decisionFor("probeFeed"),
       }));`,
    );
    expect(probe).toEqual({
      catalog: true,
      legacyCatalog: true,
      plan: { jobType: "refresh-section", collector: "section-builder" },
      legacyPlan: { jobType: "refresh-section", collector: "section-builder" },
      contract: true,
      download: true,
      release: true,
      discovery: "probeFeed",
      registry: true,
      decision: "held",
    });

    const after = hashes(work);
    const changed = [...after.keys()].filter((path) => before.get(path) !== after.get(path)).sort();
    const handEdited = changed.filter((path) => !GENERATED.has(path));
    expect(handEdited).toEqual(["feeds/index.js", "feeds/probe-feed/feed.js", "feeds/probe-feed/parse.js"]);
    expect(changed.filter((path) => GENERATED.has(path))).toEqual(
      [...GENERATED].filter((path) => changed.includes(path)).sort(),
    );
    expect(existsSync(join(work, "feeds/definitions.generated.js"))).toBe(true);
    expect(statSync(join(work, "feeds/definitions.generated.js")).size).toBeGreaterThan(0);
  }, 60_000);
});
