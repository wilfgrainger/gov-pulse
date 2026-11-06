import { SOURCE_CATALOG, SOURCE_CATALOG_VERSION, deepFreeze } from "./source-definitions.js";
import { definition as migrationStatsDefinition } from "../feeds/migration/feed.js";
import { definition as nhsStatsDefinition } from "../feeds/nhs/feed.js";
import { definition as crimeStatisticsDefinition } from "../feeds/crime-stats/feed.js";
import { definition as gdpTrackerDefinition } from "../feeds/gdp/feed.js";
import { definition as employmentStatsDefinition } from "../feeds/employment/feed.js";
import { definition as taxRevenueDefinition } from "../feeds/tax/feed.js";
import { definition as nationalDebtDefinition } from "../feeds/national-debt/feed.js";
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
  sentimentPulse: defineFeed({
    id: "sentimentPulse",
    registry: "feed",
    title: "Series-level economic indicators",
    displayName: "Key Economic Indicators",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["ons-cpi-d7g7", "boe-bank-rate-iudbedr", "ons-unemployment-mgsx"],
    automation: "automated",
    collectionLayer: "worker",
    frequency: "series-specific",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "series-specific: monthly and event-driven",
    retrievalMaxAgeMs: 36 * HOUR_MS,
    publicationRequirement: "required",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "CPI, Bank Rate and unemployment keep separate observation periods, publication dates and revision status.",
    editorial: {
      publicationPeriod: "Separate latest periods for CPI, Bank Rate and unemployment",
      unit: "Percentage for each named series",
      revisionStatus: "CPI and Labour Force Survey estimates may be revised; Bank Rate is event-dated",
      caveat: "CPI is monthly, unemployment is a rolling three-month estimate and Bank Rate changes after Monetary Policy Committee decisions. Their observation periods, publication dates, check dates and revision status stay separate.",
    },
  }),
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
  electionPolling: defineFeed({
    id: "electionPolling", registry: "feed", title: "Primary voting-intention poll publications", displayName: "Election Polling",
    evidenceClass: "polling", geography: { code: "GB", label: "Great Britain" },
    sourceIds: ["yougov-voting-intention", "more-in-common-voting-intention", "british-polling-council-rules"],
    automation: "automated", collectionLayer: "worker", frequency: "as published",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "as published",
    retrievalMaxAgeMs: 14 * DAY_MS, publicationRequirement: "required",
    freshnessWindow: "Within 14 days of primary publication",
    freshnessRationale: "Each accepted poll retains its original publication date and is withdrawn after 14 days.",
    uiSourceLabels: ["Verified primary pollster publications", "British Polling Council disclosure rules"],
    editorial: {
      publicationPeriod: "Latest verified primary pollster publication inside a 14-day evidence window",
      unit: "Published party share (%)",
      revisionStatus: "Individual poll publications are normally final; the site does not revise or average them",
      caveat: "Each poll is shown separately with fieldwork, sample, question or headline method, commissioner, uncertainty and a direct primary source. One poll is not evidence of a durable trend.",
    },
  }),
  // Projected from feeds/nhs/feed.js (the single declaration).
  nhsStats: defineFeed(catalogEntryOf(nhsStatsDefinition)),
  bettingOdds: defineFeed({
    id: "bettingOdds", registry: "feed", title: "Strict political betting market snapshots", displayName: "Political Betting Markets",
    evidenceClass: "market-signal", geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["oddschecker-next-pm", "oddschecker-most-seats", "oddschecker-election-year"],
    automation: "automated", collectionLayer: "worker", frequency: "every 3 hours",
    retrieval: "scheduled-publication-check", refreshCadence: "every 3 hours", publicationCadence: "continuous market repricing",
    retrievalMaxAgeMs: 4 * HOUR_MS, publicationRequirement: "optional",
    freshnessWindow: "Within 4 hours of market observation",
    freshnessRationale: "Each observation retains its original time and is withdrawn after four hours. Older prices are never presented as current.",
    uiSourceLabels: ["Oddschecker public politics markets"],
    editorial: {
      publicationPeriod: "Latest complete Oddschecker snapshot inside a four-hour observation window",
      unit: "Decimal odds and raw reciprocal percentage",
      revisionStatus: "Continuously repriced rather than statistically revised",
      caveat: "public-data.org shows each named market separately, calculates 100 divided by decimal odds and does not normalize prices to 100%. The results are neither official statistics nor official forecasts. Liquidity, provider coverage, bookmaker margins and market rules affect them; stale, embedded or incomplete prices are unavailable.",
    },
  }),
  // Projected from feeds/crime-stats/feed.js (the single declaration).
  crimeStatistics: defineFeed(catalogEntryOf(crimeStatisticsDefinition)),
  governmentContracts: defineFeed({
    id: "governmentContracts", registry: "publication", title: "Government contracts", displayName: "Government Contracts",
    evidenceClass: "administrative-data", geography: { code: "UK", label: "United Kingdom — Find a Tender publication coverage" },
    sourceIds: ["cabinet-office-find-a-tender"], automation: "automated", collectionLayer: "publication", frequency: "daily Cloudflare Queue collection",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "continuous notice publication",
    retrievalMaxAgeMs: 72 * HOUR_MS, publicationRequirement: "optional",
    freshnessWindow: "Within 72 hours of the verified collection",
    freshnessRationale: "The ranking uses seven complete UTC day shards and can reuse only a still-current accepted publication.",
    uiSourceLabels: ["Cabinet Office Find a Tender OCDS award releases"],
    editorial: {
      publicationPeriod: "Latest complete seven-day Find a Tender update window, collected in six-hour slices",
      unit: "Disclosed award value in GBP, excluding VAT where supplied",
      revisionStatus: "Contracting authorities can publish corrections, updates and later notices; the newest release for each award identity is retained",
      caveat: "Award values are not invoices or confirmed lifetime expenditure. Framework ceilings, lots and multi-supplier awards may not be fully spent; missing, redacted and non-GBP values are excluded.",
    },
  }),
  releaseCalendar: defineFeed({
    id: "releaseCalendar", registry: "publication", title: "Official release calendar", displayName: "Release Calendar",
    evidenceClass: "administrative-data", legacyEvidenceClass: "official-publication-schedule",
    geography: { code: "UK", label: "United Kingdom" }, sourceIds: ["ons-release-calendar"],
    automation: "automated", collectionLayer: "publication", frequency: "daily",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "publisher-announced dates",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "optional",
  }),
  nhsReleaseCalendar: defineFeed({
    id: "nhsReleaseCalendar", registry: "publication", title: "NHS England RTT release schedule", displayName: "NHS Release Calendar",
    evidenceClass: "administrative-data", legacyEvidenceClass: "official-publication-schedule",
    geography: { code: "ENG", label: "England" }, sourceIds: ["nhs-release-calendar"],
    automation: "automated", collectionLayer: "publication", frequency: "daily",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "publisher-announced dates",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "optional",
  }),
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
  earlyYears: defineFeed({
    id: "earlyYears", registry: null, title: "Early years evidence", displayName: "Early Years Spotlight",
    evidenceClass: "official-statistics", geography: { code: "ENG", label: "England" },
    sourceIds: ["ukhsa-cover", "dfe-eyfs"], automation: "static", collectionLayer: "worker", frequency: "periodic",
    uiSourceLabels: ["UKHSA COVER childhood vaccination statistics", "DfE School Readiness"],
    editorial: {
      publicationPeriod: "UKHSA COVER 2024/25 and DfE EYFS profile 2024/25",
      unit: "Rates (%) as labelled",
      revisionStatus: "UKHSA immunisation data can be corrected; DfE profiles may receive publication updates",
      caveat: "EYFSP profiles were cancelled during the COVID-19 pandemic (2019/20 and 2020/21). A new EYFS profile baseline was introduced in 2021/22, so earlier and later rates are not directly comparable.",
    },
  }),
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
