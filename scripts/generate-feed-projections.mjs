// Feed projection tooling.
//   --capture-legacy  write tests/fixtures/registry/legacy-projections.json from the
//                     registries as they stand (run before a feed is migrated)
//   --check           fail when a feed-owned entry in a checked-in contract or
//                     registry differs from its projection from feeds/
//   --write           rewrite the feed-owned entries of contracts/section-discovery.json
//                     and contracts/measure-definitions.json from feeds/
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FEED_CATALOG } from "../contracts/source-catalog.js";
import { SECTION_COLLECTION_PLAN } from "../worker/publication-plan.js";
import { OBSERVATION_CONTRACTS } from "../worker/observation-contract.js";
import { RELEASE_FAMILIES } from "../worker/ons-release-calendar.js";
import { routeManifest } from "../contracts/route-manifest.js";
import { SECTION_DOWNLOAD_IDS } from "../app/lib/sectionDownloads.ts";
import discovery from "../contracts/section-discovery.json" with { type: "json" };
import measureDefinitions from "../contracts/measure-definitions.json" with { type: "json" };
import { FEEDS } from "../feeds/index.js";
import {
  collectionPlan,
  downloadIds,
  feedCatalog,
  measureDefinitions as projectedMeasures,
  observationContracts,
  sectionDiscovery,
} from "../feeds/registry.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function captureLegacy() {
  return {
    note: "Captured from the hand-written registries before feed migration (Task 6). Do not edit by hand.",
    feedCatalog: JSON.parse(JSON.stringify(FEED_CATALOG)),
    collectionPlan: JSON.parse(JSON.stringify(SECTION_COLLECTION_PLAN)),
    observationContracts: Object.fromEntries(
      Object.entries(OBSERVATION_CONTRACTS).map(([id, c]) => [id, { maxAgeDays: c.maxAgeDays, extractor: c.extract.name }]),
    ),
    sectionDiscovery: discovery.sections,
    measureDefinitions: measureDefinitions.measures,
    downloadIds: [...SECTION_DOWNLOAD_IDS],
    releaseFamilies: RELEASE_FAMILIES.map((f) => ({
      familyIds: f.familyIds,
      pattern: f.pattern.source,
      flags: f.pattern.flags,
      ...(f.exclude ? { exclude: f.exclude.source, excludeFlags: f.exclude.flags } : {}),
    })),
    routeManifest: JSON.parse(JSON.stringify(routeManifest())),
  };
}

if (process.argv.includes("--capture-legacy")) {
  const target = resolve(root, "tests/fixtures/registry/legacy-projections.json");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(captureLegacy(), null, 2)}\n`);
  console.log(`wrote ${target}`);
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const DISCOVERY_PATH = resolve(root, "contracts/section-discovery.json");
const MEASURES_PATH = resolve(root, "contracts/measure-definitions.json");

/** Names every feed-owned entry that differs from its projection. */
export function findDrift() {
  const drift = [];
  const compare = (label, actual, expected) => {
    if (!isDeepStrictEqual(plain(actual), plain(expected))) drift.push(label);
  };
  const catalog = feedCatalog();
  const plan = collectionPlan();
  const contracts = observationContracts();
  for (const { definition } of FEEDS) {
    const { id } = definition;
    compare(`FEED_CATALOG.${id}`, FEED_CATALOG[id], catalog[id]);
    compare(`SECTION_COLLECTION_PLAN.${id}`, SECTION_COLLECTION_PLAN[id], plan[id]);
    compare(`OBSERVATION_CONTRACTS.${id}`, {
      maxAgeDays: OBSERVATION_CONTRACTS[id]?.maxAgeDays,
      extractor: OBSERVATION_CONTRACTS[id]?.extract?.name,
    }, contracts[id]);
  }
  for (const [slug, entry] of Object.entries(sectionDiscovery())) {
    compare(`section-discovery.json sections.${slug}`, discovery.sections[slug], entry);
  }
  const feedIds = new Set(FEEDS.map(({ definition }) => definition.id));
  compare(
    "measure-definitions.json measures (feed-owned)",
    measureDefinitions.measures.filter((measure) => feedIds.has(measure.section)),
    projectedMeasures(),
  );
  const ids = downloadIds();
  compare("SECTION_DOWNLOAD_IDS (feed-owned, in order)", SECTION_DOWNLOAD_IDS.filter((id) => ids.includes(id)), ids);
  return drift;
}

const inline = (value) => {
  if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value).map(([key, entry]) => `${JSON.stringify(key)}: ${inline(entry)}`).join(", ")} }`;
  }
  return JSON.stringify(value);
};
const measureBlock = (measure) =>
  `    {\n      ${Object.entries(measure).map(([key, entry]) => `${JSON.stringify(key)}: ${inline(entry)}`).join(", ")}\n    }`;

async function writeContracts() {
  const sections = { ...discovery.sections, ...sectionDiscovery() };
  await writeFile(DISCOVERY_PATH, `${JSON.stringify({ ...discovery, sections }, null, 2)}\n`);

  let text = await readFile(MEASURES_PATH, "utf8");
  for (const measure of projectedMeasures()) {
    const block = new RegExp(`    \\{\\n      "id": "${measure.id}",[\\s\\S]*?\\n    \\}`);
    if (block.test(text)) text = text.replace(block, () => measureBlock(measure));
    else text = text.replace(/\n  \]\n\}\n?$/, () => `,\n${measureBlock(measure)}\n  ]\n}\n`);
  }
  await writeFile(MEASURES_PATH, text);
}

if (process.argv.includes("--write")) {
  await writeContracts();
  console.log("rewrote feed-owned contract entries");
}

if (process.argv.includes("--check")) {
  const drift = findDrift();
  if (drift.length > 0) {
    console.error(`Feed projection drift (run node scripts/generate-feed-projections.mjs --write):\n- ${drift.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`no drift (${FEEDS.length} feed${FEEDS.length === 1 ? "" : "s"} checked)`);
}
