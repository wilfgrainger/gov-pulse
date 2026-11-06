// Feed projection tooling.
//   --capture-legacy  write tests/fixtures/registry/legacy-projections.json from the
//                     hand-written registries (run once, before a feed is migrated)
// The check mode is added with the feeds/ registry (see feeds/registry.js).
import { mkdir, writeFile } from "node:fs/promises";
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
