// Pure projections from the feed definitions onto the shapes the hand-written
// registries used to declare. Nothing here fetches, reads storage or decides
// publication.
//
// The definitions come from feeds/definitions.generated.js, which
// scripts/generate-feed-projections.mjs --write derives from FEEDS in
// feeds/index.js. Reading the generated list instead of FEEDS keeps every
// collector out of the import graph of anything that only needs feed metadata
// (the web Worker, the data Worker's public routes, scripts).
//
// Migration contract: every projection for a migrated feed is deep-equal to the
// legacy object, proven against tests/fixtures/registry/legacy-projections.json
// by tests/worker/feed-registry-projection.test.ts and drift-checked by
// `node scripts/generate-feed-projections.mjs --check`.
import PRODUCT_ROUTES from "../contracts/routes.json" with { type: "json" };
import definitions from "../contracts/measure-definitions.json" with { type: "json" };
import { FEED_CATALOG, legacyRegistryEntry } from "../contracts/source-catalog.js";
import { PUBLICATION_CONFIG } from "../contracts/evidence-policy.js";
import { catalogEntryOf } from "./define-feed.js";
import { DEFINITIONS } from "./definitions.generated.js";

const definitionsOf = () => DEFINITIONS;
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

/** The full route manifest: hand-written non-feed routes plus routes derived from the feed definitions and the catalogue. */
export function routeManifest(config = PUBLICATION_CONFIG) {
  if (manifestCache.has(config)) return manifestCache.get(config);
  const manifest = Object.freeze(
    [...PRODUCT_ROUTES.routes, ...derivedEntries(config)].map((entry) => Object.freeze(entry)),
  );
  manifestCache.set(config, manifest);
  return manifest;
}

// ---------------------------------------------------------------------------
// Runtime registry views (moved from worker/feed-registry.js, shapes unchanged).
// Source identity, publisher URLs, cadence, geography and caveats are owned by
// contracts/source-catalog.js (projected from feeds/*/feed.js) and must not be
// re-declared here.
// ---------------------------------------------------------------------------

export const FEED_REGISTRY_VERSION = "2026-08-02.1";

function registry(kind) {
  return Object.freeze(Object.fromEntries(
    Object.values(FEED_CATALOG)
      .filter((feed) => feed.registry === kind)
      .map((feed) => [feed.id, Object.freeze(legacyRegistryEntry(feed.id))])
  ));
}

// Source identity, publisher URLs, cadence, geography and caveats are owned by
// contracts/source-catalog.js and must not be re-declared here.
export const FEED_REGISTRY = registry("feed");
export const PUBLICATION_SOURCE_REGISTRY = registry("publication");

export function retrievalMaxAgeMsForSection(section) {
  return (
    FEED_REGISTRY[section]?.retrievalMaxAgeMs ??
    PUBLICATION_SOURCE_REGISTRY[section]?.retrievalMaxAgeMs ??
    null
  );
}

export function registrySnapshot() {
  return {
    version: FEED_REGISTRY_VERSION,
    feeds: FEED_REGISTRY,
  };
}

export const REQUIRED_PUBLISHED_SECTION_IDS = Object.freeze(
  Object.values(FEED_REGISTRY)
    .filter((feed) => feed.publicationRequirement !== "optional")
    .map((feed) => feed.section)
);

export const OPTIONAL_PUBLISHED_SECTION_IDS = Object.freeze(
  [
    ...Object.values(FEED_REGISTRY),
    ...Object.values(PUBLICATION_SOURCE_REGISTRY),
  ]
    .filter((feed) => feed.publicationRequirement === "optional")
    .map((feed) => feed.section)
);

export function provenanceFor(section) {
  const feed = FEED_REGISTRY[section] ?? PUBLICATION_SOURCE_REGISTRY[section];
  if (!feed) return null;
  return {
    registryVersion: FEED_REGISTRY_VERSION,
    section: feed.section,
    title: feed.title,
    evidenceClass: feed.evidenceClass,
    geography: feed.geography,
    retrieval: feed.retrieval,
    refreshCadence: feed.refreshCadence,
    publicationCadence: feed.publicationCadence,
    operationalStatus: feed.operationalStatus,
    publicationRequirement: feed.publicationRequirement ?? "required",
    upstreams: feed.upstreams,
  };
}

export function applyFeedRegistry(descriptors) {
  const descriptorKeys = Object.keys(descriptors).sort();
  const registryKeys = Object.keys(FEED_REGISTRY).sort();
  if (JSON.stringify(descriptorKeys) !== JSON.stringify(registryKeys)) {
    throw new Error(
      `Feed registry mismatch: descriptors=${descriptorKeys.join(",")} registry=${registryKeys.join(",")}`
    );
  }

  for (const [section, descriptor] of Object.entries(descriptors)) {
    const feed = FEED_REGISTRY[section];
    descriptor.source = feed.upstreams.map((upstream) => upstream.label).join(" + ");
    descriptor.registry = provenanceFor(section);
  }

  return descriptors;
}
