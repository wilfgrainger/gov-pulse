import { SOURCE_CATALOG, SOURCE_CATALOG_VERSION, deepFreeze } from "./source-definitions.js";
import { definition as migrationStatsDefinition } from "../feeds/migration/feed.js";
import { definition as nhsStatsDefinition } from "../feeds/nhs/feed.js";
import { definition as crimeStatisticsDefinition } from "../feeds/crime-stats/feed.js";
import { definition as gdpTrackerDefinition } from "../feeds/gdp/feed.js";
import { definition as employmentStatsDefinition } from "../feeds/employment/feed.js";
import { definition as taxRevenueDefinition } from "../feeds/tax/feed.js";
import { definition as nationalDebtDefinition } from "../feeds/national-debt/feed.js";
import { definition as sentimentPulseDefinition } from "../feeds/economy/feed.js";
import { definition as electionPollingDefinition } from "../feeds/election-polls/feed.js";
import { definition as bettingOddsDefinition } from "../feeds/betting-odds/feed.js";
import { definition as releaseCalendarDefinition } from "../feeds/release-calendar/feed.js";
import { definition as nhsReleaseCalendarDefinition } from "../feeds/nhs-release-calendar/feed.js";
import { definition as earlyYearsDefinition } from "../feeds/early-years/feed.js";
import { definition as governmentContractsDefinition } from "../feeds/government-contracts/feed.js";
import { catalogEntryOf } from "../feeds/define-feed.js";
import { definition as housePriceIndexDefinition } from "../feeds/house-price-index/feed.js";
import { definition as realWagesDefinition } from "../feeds/real-wages/feed.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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

export const FEED_CATALOG = deepFreeze({
  // Projected from feeds/economy/feed.js (the single declaration).
  sentimentPulse: defineFeed(catalogEntryOf(sentimentPulseDefinition)),
  // Projected from feeds/gdp/feed.js (the single declaration).
  gdpTracker: defineFeed(catalogEntryOf(gdpTrackerDefinition)),
  // Projected from feeds/employment/feed.js (the single declaration).
  employmentStats: defineFeed(catalogEntryOf(employmentStatsDefinition)),
  // Projected from feeds/national-debt/feed.js (the single declaration).
  nationalDebt: defineFeed(catalogEntryOf(nationalDebtDefinition)),
  // Projected from feeds/tax/feed.js (the single declaration).
  taxRevenue: defineFeed(catalogEntryOf(taxRevenueDefinition)),
  // Projected from feeds/migration/feed.js (the single declaration).
  migrationStats: defineFeed(catalogEntryOf(migrationStatsDefinition)),
  // Projected from feeds/house-price-index/feed.js (the single declaration).
  housePriceIndex: defineFeed(catalogEntryOf(housePriceIndexDefinition)),
  // Projected from feeds/real-wages/feed.js (the single declaration).
  realWages: defineFeed(catalogEntryOf(realWagesDefinition)),
  // Projected from feeds/election-polls/feed.js (the single declaration).
  electionPolling: defineFeed(catalogEntryOf(electionPollingDefinition)),
  // Projected from feeds/nhs/feed.js (the single declaration).
  nhsStats: defineFeed(catalogEntryOf(nhsStatsDefinition)),
  // Projected from feeds/betting-odds/feed.js (the single declaration).
  bettingOdds: defineFeed(catalogEntryOf(bettingOddsDefinition)),
  // Projected from feeds/crime-stats/feed.js (the single declaration).
  crimeStatistics: defineFeed(catalogEntryOf(crimeStatisticsDefinition)),
  // Projected from feeds/government-contracts/feed.js (the single declaration).
  governmentContracts: defineFeed(catalogEntryOf(governmentContractsDefinition)),
  // Projected from feeds/release-calendar/feed.js (the single declaration).
  releaseCalendar: defineFeed(catalogEntryOf(releaseCalendarDefinition)),
  // Projected from feeds/nhs-release-calendar/feed.js (the single declaration).
  nhsReleaseCalendar: defineFeed(catalogEntryOf(nhsReleaseCalendarDefinition)),
  internationalComparison: defineFeed({
    id: "internationalComparison", registry: "publication", title: "International country comparisons", displayName: "International Comparison",
    evidenceClass: "official-statistics", legacyEvidenceClass: "international-comparative-statistics",
    geography: { code: "INT", label: "United Kingdom and twelve named peer countries, with measure-specific coverage" },
    sourceIds: ["imf-data", "world-bank-wdi", "oecd-data-explorer", "sipri-milex", "who-world-bank-health"],
    runtimeSourceIds: [
      "imf-gdp-2026", "world-bank-population-2025", "imf-debt-2026", "imf-interest-2024",
      "oecd-oda-2025", "sipri-2025", "oecd-socx-2023", "world-bank-health-2024",
      "oecd-tax-2024", "world-bank-gdp-per-capita-2023", "world-bank-gdp-per-capita-2024",
    ],
    automation: "automated", collectionLayer: "publication", frequency: "weekly and on-demand by measure",
    retrieval: "scheduled-publication-check", refreshCadence: "weekly and on-demand by measure",
    publicationCadence: "publisher-specific annual releases", retrievalMaxAgeMs: 30 * DAY_MS,
    publicationRequirement: "independent",
  }),
  // Projected from feeds/early-years/feed.js (the single declaration).
  earlyYears: defineFeed(catalogEntryOf(earlyYearsDefinition)),
});

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
