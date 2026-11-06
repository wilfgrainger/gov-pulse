// Pure projections from FEEDS onto the shapes the hand-written registries used
// to declare. Nothing here fetches, reads storage or decides publication.
//
// Migration contract: every projection for a migrated feed is deep-equal to the
// legacy object, proven against tests/fixtures/registry/legacy-projections.json
// by tests/worker/feed-registry-projection.test.ts and drift-checked by
// `node scripts/generate-feed-projections.mjs --check`.
import PRODUCT_ROUTES from "../contracts/routes.json" with { type: "json" };
import definitions from "../contracts/measure-definitions.json" with { type: "json" };
import { FEED_CATALOG } from "../contracts/source-catalog.js";
import { PUBLICATION_CONFIG } from "../contracts/evidence-policy.js";
import { catalogEntryOf } from "./define-feed.js";
import { FEEDS } from "./index.js";

const definitionsOf = () => FEEDS.map((feed) => feed.definition);
const byId = () => new Map(definitionsOf().map((def) => [def.id, def]));

function mapById(project, include = () => true) {
  return Object.fromEntries(definitionsOf().filter(include).map((def) => [def.id, project(def)]));
}

/** Legacy FEED_CATALOG entries (contracts/source-catalog.js) for migrated feeds. */
export function feedCatalog() {
  return mapById(catalogEntryOf);
}

/** Legacy SECTION_COLLECTION_PLAN entries (worker/publication-plan.js). */
export function collectionPlan() {
  // Feeds collected outside the section job queue (contracts, comparison) and
  // static feeds declare no collection.
  return mapById(
    (def) => ({ jobType: def.collection.jobType, collector: def.collection.collector }),
    (def) => def.collection !== undefined,
  );
}

/**
 * Legacy OBSERVATION_CONTRACTS entries as data: the extractor is named, and
 * worker/observation-contract.js binds the name to its function.
 */
export function observationContracts() {
  // Only feeds with an observation-date contract; retrievalOnly feeds have none.
  return mapById(
    (def) => ({ maxAgeDays: def.validity.observationMaxAgeDays, extractor: def.validity.extractor }),
    (def) => def.validity?.observationMaxAgeDays !== undefined,
  );
}

/** Legacy contracts/section-discovery.json `sections`, keyed by route slug. */
export function sectionDiscovery() {
  return Object.fromEntries(
    definitionsOf().filter((def) => def.discovery !== undefined).map((def) => [
      def.slug,
      {
        title: def.discovery.title,
        description: def.description,
        category: def.category,
        kind: def.discovery.kind,
        sourceKey: def.id,
        sameAs: [...def.discovery.sameAs],
      },
    ]),
  );
}

/**
 * Feed ids with a section distribution (SECTION_DOWNLOAD_IDS order is FEEDS
 * order). `downloads.listed: false` keeps a feed's /data/sections routes in the
 * route manifest without offering a distribution for it (bettingOdds).
 */
export function downloadIds() {
  return definitionsOf()
    .filter((def) => (def.downloads.json || def.downloads.csv) && def.downloads.listed !== false)
    .map((def) => def.id);
}

/** Download geography labels by feed id (app/lib/sectionDownloads.ts). */
export function downloadGeography() {
  return mapById((def) => def.downloads.geography);
}

/** Release-calendar title families. `exclude` is optional. */
export function releaseFamilies() {
  return definitionsOf().flatMap((def) =>
    def.releaseTitles.map((title) => ({
      feedId: def.id,
      pattern: new RegExp(title.pattern, title.flags ?? ""),
      ...(title.exclude ? { exclude: new RegExp(title.exclude, title.excludeFlags ?? "") } : {}),
    })),
  );
}

/**
 * The ONS release-calendar title families: one entry per distinct title
 * pattern, naming every feed (or the explicit `familyIds` override on a title)
 * that follows that release. Pure; worker/ons-release-calendar.js matches
 * calendar titles against it.
 *
 * @returns {Array<{familyIds: string[], pattern: RegExp, exclude?: RegExp}>}
 */
export function releaseFamilyGroups() {
  const groups = new Map();
  for (const def of definitionsOf()) {
    for (const title of def.releaseTitles) {
      const key = JSON.stringify([title.pattern, title.flags ?? "", title.exclude ?? null, title.excludeFlags ?? ""]);
      if (!groups.has(key)) {
        groups.set(key, {
          familyIds: [],
          pattern: new RegExp(title.pattern, title.flags ?? ""),
          ...(title.exclude ? { exclude: new RegExp(title.exclude, title.excludeFlags ?? "") } : {}),
        });
      }
      const group = groups.get(key);
      for (const id of title.familyIds ?? [def.id]) if (!group.familyIds.includes(id)) group.familyIds.push(id);
    }
  }
  return [...groups.values()];
}

/** Legacy contracts/measure-definitions.json `measures` entries for migrated feeds. */
export function measureDefinitions() {
  return definitionsOf().flatMap((def) => def.measures.map((measure) => structuredClone(measure)));
}

/**
 * @typedef {{path:string, kind:"static"|"evidence"|"api", feeds:string[], gate:"none"|"any-published"|"all-of"|"product", capability?:string}} RouteEntry
 * @typedef {import("../contracts/evidence-policy.js").PublicationConfig} PublicationConfig
 */

const manifestCache = new WeakMap();

/** @param {PublicationConfig} config @returns {RouteEntry[]} */
function derivedEntries(config) {
  const feedDefs = byId();
  /** @type {RouteEntry[]} */
  const entries = [];
  const publications = config?.publications ?? {};

  for (const [id, decision] of Object.entries(publications)) {
    // A feed with a public section page routes it by slug; publications with no
    // page of their own (release calendars) or no definition still declare
    // theirs in config.
    const slugs = feedDefs.get(id)?.discovery ? [feedDefs.get(id).slug] : (decision.sections ?? []);
    for (const slug of slugs) {
      entries.push({ path: `/section/${slug}/`, kind: "evidence", feeds: [id], gate: "any-published" });
    }
  }

  for (const [id, feed] of Object.entries(FEED_CATALOG)) {
    if (feed?.registry !== "feed") continue;
    const def = feedDefs.get(id);
    for (const ext of ["json", "csv"]) {
      if (def && !def.downloads[ext]) continue;
      entries.push({ path: `/data/sections/${id}.${ext}`, kind: "api", feeds: [id], gate: "any-published" });
    }
  }

  for (const measure of definitions.measures) {
    entries.push({ path: `/measure/${measure.id}/`, kind: "evidence", feeds: [measure.section], gate: "any-published" });
  }
  // A measure id that is not defined is reported unavailable, as before, not 404.
  entries.push({ path: "/measure/[id]/", kind: "evidence", feeds: [], gate: "all-of" });

  const sourceIds = new Set([...Object.keys(publications), ...Object.keys(FEED_CATALOG)]);
  for (const id of sourceIds) {
    entries.push({ path: `/sources/${id}/`, kind: "evidence", feeds: [id], gate: "any-published", capability: "sources" });
  }
  entries.push({ path: "/sources/[id]/", kind: "evidence", feeds: [], gate: "all-of", capability: "sources" });

  return entries;
}

/** The full route manifest: hand-written non-feed routes plus routes derived from FEEDS and the catalogue. */
export function routeManifest(config = PUBLICATION_CONFIG) {
  if (manifestCache.has(config)) return manifestCache.get(config);
  const manifest = Object.freeze(
    [...PRODUCT_ROUTES.routes, ...derivedEntries(config)].map((entry) => Object.freeze(entry)),
  );
  manifestCache.set(config, manifest);
  return manifest;
}

// Runtime registry views (FEED_REGISTRY and friends). They live in
// registry-views.js, which never imports FEEDS, so modules the collectors
// themselves import (worker/live-feed-common.js) can read provenance without
// creating an import cycle through every collector.
export {
  FEED_REGISTRY,
  FEED_REGISTRY_VERSION,
  OPTIONAL_PUBLISHED_SECTION_IDS,
  PUBLICATION_SOURCE_REGISTRY,
  REQUIRED_PUBLISHED_SECTION_IDS,
  applyFeedRegistry,
  provenanceFor,
  registrySnapshot,
  retrievalMaxAgeMsForSection,
} from "./registry-views.js";
