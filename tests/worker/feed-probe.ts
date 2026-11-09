// Shared by the feed-sprawl tests: a temp copy of the repo plus a throwaway
// probe feed added the way a real one would be (its folder and one index entry).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const COPIED = ["feeds", "contracts", "config", "worker", "scripts", "app/lib"];

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

/** Copy the folders a feed touches into `work`, sharing the real node_modules. */
export function copyRepo(root: string, work: string): void {
  for (const folder of COPIED) {
    mkdirSync(join(work, folder, ".."), { recursive: true });
    cpSync(join(root, folder), join(work, folder), { recursive: true });
  }
  cpSync(join(root, "package.json"), join(work, "package.json"));
  symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");
}

/** The only hand edits a new feed needs: its folder (feed.js + parse.js) and its index entry. */
export function addProbeFeed(work: string): void {
  mkdirSync(join(work, "feeds/probe-feed"));
  writeFileSync(join(work, "feeds/probe-feed/feed.js"), PROBE_FEED);
  writeFileSync(join(work, "feeds/probe-feed/parse.js"), PROBE_PARSE);
  const indexPath = join(work, "feeds/index.js");
  const index = readFileSync(indexPath, "utf8")
    .replace("export const FEEDS", `import { definition as probeFeedDefinition } from "./probe-feed/feed.js";\nimport * as probeFeedParser from "./probe-feed/parse.js";\n\nexport const FEEDS`)
    .replace("Object.freeze([\n", "Object.freeze([\n  { definition: probeFeedDefinition, collect: probeFeedParser.collect },\n");
  writeFileSync(indexPath, index);
}

export function regenerateProjections(work: string): void {
  execFileSync("node", ["scripts/generate-feed-projections.mjs", "--write"], { cwd: work, stdio: "pipe" });
  execFileSync("node", ["scripts/generate-feed-projections.mjs", "--check"], { cwd: work, stdio: "pipe" });
}

/** Run an ES module snippet inside `work` and parse the JSON it prints last. */
export function probeJson(work: string, source: string): unknown {
  const output = execFileSync("node", ["--input-type=module", "-e", source], { cwd: work, encoding: "utf8" });
  return JSON.parse(output.trim().split("\n").at(-1) as string);
}
