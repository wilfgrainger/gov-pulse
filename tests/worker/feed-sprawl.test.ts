// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const COPIED = ["feeds", "contracts", "config", "worker", "scripts", "app/lib"];
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

const PROBE_FEED = `import { defineFeed } from "../define-feed.js";

export const definition = defineFeed({
  id: "probeFeed",
  slug: "probe-feed",
  title: "Probe feed",
  displayName: "Probe",
  description: "A throwaway feed proving that registration needs only its folder and one index entry.",
  category: "Economy",
  evidenceClass: "official-statistics",
  geography: { code: "UK", label: "United Kingdom" },
  editorial: {
    publicationPeriod: "Latest probe",
    unit: "Index",
    revisionStatus: "Not revised",
    caveat: "Test fixture only.",
  },
  sources: ["ons-cpi-d7g7"],
  registry: "feed",
  automation: "automated",
  collectionLayer: "worker",
  retrieval: "scheduled-publication-check",
  cadence: { collect: "daily", publication: "monthly", frequency: "monthly" },
  collection: { jobType: "refresh-section", collector: "section-builder" },
  validity: { retrievalMaxAgeMs: 36 * 60 * 60 * 1000, observationMaxAgeDays: 40, extractor: "publishedObservation" },
  requirement: "optional",
  measures: [],
  downloads: { json: true, csv: true, geography: "United Kingdom" },
  releaseTitles: [{ pattern: "^Probe release:", flags: "i" }],
  discovery: { title: "Probe", kind: "dataset", sameAs: ["https://www.ons.gov.uk/"] },
  view: "Probe",
});
`;
const PROBE_PARSE = `export async function collect() {
  return { data: { headline: {} } };
}
`;

describe("feed sprawl", () => {
  const work = mkdtempSync(join(tmpdir(), "feed-sprawl-"));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it("a new feed needs only its folder and one index entry", () => {
    for (const folder of COPIED) {
      mkdirSync(join(work, folder, ".."), { recursive: true });
      cpSync(join(root, folder), join(work, folder), { recursive: true });
    }
    cpSync(join(root, "package.json"), join(work, "package.json"));
    symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");
    const before = hashes(work);

    // The only hand edits: a feed folder (feed.js + parse.js) and its index entry.
    mkdirSync(join(work, "feeds/probe-feed"));
    writeFileSync(join(work, "feeds/probe-feed/feed.js"), PROBE_FEED);
    writeFileSync(join(work, "feeds/probe-feed/parse.js"), PROBE_PARSE);
    const indexPath = join(work, "feeds/index.js");
    const index = readFileSync(indexPath, "utf8")
      .replace("export const FEEDS", `import { definition as probeFeedDefinition } from "./probe-feed/feed.js";\nimport * as probeFeedParser from "./probe-feed/parse.js";\n\nexport const FEEDS`)
      .replace("Object.freeze([\n", "Object.freeze([\n  { definition: probeFeedDefinition, collect: probeFeedParser.collect },\n");
    writeFileSync(indexPath, index);

    execFileSync("node", ["scripts/generate-feed-projections.mjs", "--write"], { cwd: work, stdio: "pipe" });
    execFileSync("node", ["scripts/generate-feed-projections.mjs", "--check"], { cwd: work, stdio: "pipe" });

    const probe = execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
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
      ],
      { cwd: work, encoding: "utf8" },
    );
    expect(JSON.parse(probe.trim().split("\n").at(-1) as string)).toEqual({
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
