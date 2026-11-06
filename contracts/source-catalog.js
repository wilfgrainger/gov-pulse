import { SOURCE_CATALOG, SOURCE_CATALOG_VERSION, deepFreeze } from "./source-definitions.js";
import { catalogEntryOf } from "../feeds/define-feed.js";
import { DEFINITIONS } from "../feeds/definitions.generated.js";

export { SOURCE_CATALOG, SOURCE_CATALOG_VERSION };

function defineFeed(input) {
  const {
    id,
    sourceIds = [],
    registry = null,
    runtimeSourceIds,
    ...rest
  } = input;
  if (typeof id !== "string" || !id.trim()) throw new Error("Feed id is required");
  if (!Array.isArray(sourceIds) || new Set(sourceIds).size !== sourceIds.length) {
    throw new Error(`Feed '${id}' source ids must be a unique array`);
  }
  for (const sourceId of sourceIds) {
    if (!Object.hasOwn(SOURCE_CATALOG, sourceId)) {
      throw new Error(`Feed '${id}' references unknown source '${sourceId}'`);
    }
  }
  return deepFreeze({
    id,
    sourceIds,
    registry,
    ...(runtimeSourceIds ? { runtimeSourceIds } : {}),
    ...rest,
  });
}


const UI_CLASS = Object.freeze({
  "official-statistics": "official-data",
  "official-policy": "official-data",
  "administrative-data": "official-data",
  polling: "public-opinion",
  "market-signal": "market-signal",
  "derived-analysis": "derived-analysis",
});

// Every entry is projected from its feed definition (feeds/<slug>/feed.js), the
// single declaration. Membership is every definition; the order below is the
// published catalogue order of the existing feeds, and feeds added later follow
// in definition order.
const CATALOG_ORDER = [
  "sentimentPulse", "gdpTracker", "employmentStats", "nationalDebt", "taxRevenue", "migrationStats",
  "housePriceIndex", "realWages", "electionPolling", "nhsStats", "bettingOdds", "crimeStatistics",
  "governmentContracts", "releaseCalendar", "nhsReleaseCalendar", "internationalComparison", "earlyYears",
];
const CATALOG_DEFINITIONS = [
  ...CATALOG_ORDER.flatMap((id) => DEFINITIONS.filter((definition) => definition.id === id)),
  ...DEFINITIONS.filter((definition) => !CATALOG_ORDER.includes(definition.id)),
];

export const FEED_CATALOG = deepFreeze(
  Object.fromEntries(CATALOG_DEFINITIONS.map((definition) => [definition.id, defineFeed(catalogEntryOf(definition))])),
);

export function sourceFor(id) {
  return SOURCE_CATALOG[id] ?? null;
}

export function feedFor(id) {
  return FEED_CATALOG[id] ?? null;
}

export function sourcesForFeed(id) {
  const feed = feedFor(id);
  return feed ? feed.sourceIds.map((sourceId) => SOURCE_CATALOG[sourceId]) : [];
}

export function sourceLinksForFeed(id) {
  return sourcesForFeed(id).flatMap((source) =>
    source.primaryUrls.map((url) => ({ sourceId: source.id, publisher: source.publisher, label: source.name, url }))
  );
}

export function uiEvidenceClassForFeed(id) {
  const feed = feedFor(id);
  if (!feed) return null;
  return feed.uiEvidenceClass ?? UI_CLASS[feed.evidenceClass] ?? null;
}

export function uiSourceLabelsForFeed(id) {
  const feed = feedFor(id);
  if (!feed) return [];
  return feed.uiSourceLabels ?? sourcesForFeed(id).map((source) => source.name);
}

export function legacyUpstreamsForFeed(id) {
  return sourcesForFeed(id).map((source) => ({
    publisher: source.publisher,
    label: source.name,
    url: source.primaryUrls[0],
    sourceClass: source.sourceClass,
    ...(source.seriesId ? { seriesId: source.seriesId } : {}),
    ...(source.datasetId ? { datasetId: source.datasetId } : {}),
    ...(source.caveats[0] ? { caveat: source.caveats[0] } : {}),
  }));
}

export function legacyRegistryEntry(id) {
  const feed = feedFor(id);
  if (!feed || !feed.registry) return null;
  return {
    section: feed.id,
    title: feed.title,
    evidenceClass: feed.legacyEvidenceClass ?? (
      feed.evidenceClass === "polling" ? "public-opinion" :
      feed.evidenceClass === "market-signal" ? "market-signal" :
      feed.evidenceClass === "derived-analysis" ? "derived-analysis" :
      "official-data"
    ),
    geography: feed.geography.label,
    retrieval: feed.retrieval,
    refreshCadence: feed.refreshCadence,
    publicationCadence: feed.publicationCadence,
    operationalStatus: "active",
    retrievalMaxAgeMs: feed.retrievalMaxAgeMs,
    publicationRequirement: feed.publicationRequirement ?? "required",
    ...(feed.runtimeSourceIds ? { sourceIds: feed.runtimeSourceIds } : {}),
    upstreams: legacyUpstreamsForFeed(id),
  };
}

export function legacyDataSourceDefinition(id) {
  const feed = feedFor(id);
  if (!feed || !feed.automation) return null;
  return {
    name: feed.displayName,
    frequency: feed.frequency,
    sources: uiSourceLabelsForFeed(id),
    automation: feed.automation,
    ...(feed.collectionLayer === "publication" ? { collectionLayer: "publication" } : {}),
    evidenceClass: uiEvidenceClassForFeed(id),
    geographicCoverage: feed.geography.label,
    ...(feed.freshnessWindow ? { freshnessWindow: feed.freshnessWindow } : {}),
    ...(feed.freshnessRationale ? { freshnessRationale: feed.freshnessRationale } : {}),
    ...(feed.retrievalMaxAgeMs ? { freshnessWindowMs: feed.retrievalMaxAgeMs } : {}),
    ...(feed.publicationRequirement === "optional" ? { publicationRequirement: "optional" } : {}),
  };
}

export function legacyDataSourceDetail(id) {
  const feed = feedFor(id);
  return feed?.editorial ? { ...feed.editorial } : null;
}
