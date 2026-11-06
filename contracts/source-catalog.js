import { SOURCE_CATALOG, SOURCE_CATALOG_VERSION, deepFreeze } from "./source-definitions.js";
import { catalogEntryOf } from "../feeds/define-feed.js";
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
  gdpTracker: defineFeed({
    id: "gdpTracker", registry: "feed", title: "Monthly gross domestic product", displayName: "GDP",
    evidenceClass: "official-statistics", geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["ons-gdp-monthly"], automation: "automated", collectionLayer: "worker", frequency: "monthly",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "monthly",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "required",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The rolling ONS bulletin is checked regularly. The observation period is assessed separately from the date of that check.",
    editorial: {
      publicationPeriod: "Latest ONS monthly GDP bulletin edition",
      unit: "Percentage change in real, seasonally adjusted GDP",
      revisionStatus: "Early monthly estimate; revised as fuller source data become available",
      caveat: "The latest monthly movement, three-month comparison and annual movement remain separate; forecasts, nominal totals and international estimates are not mixed into the headline.",
    },
  }),
  employmentStats: defineFeed({
    id: "employmentStats", registry: "feed", title: "UK labour market", displayName: "Employment",
    evidenceClass: "official-statistics", geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["ons-uk-labour-market"], automation: "automated", collectionLayer: "worker", frequency: "monthly",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "monthly",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "required",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The latest labour-market bulletin is checked regularly, with each observation period shown separately.",
    editorial: {
      publicationPeriod: "Latest ONS UK labour-market bulletin edition",
      unit: "Rates (%) and vacancies (people), as labelled",
      revisionStatus: "Labour Force Survey and vacancy estimates may be revised",
      caveat: "Employment, unemployment and inactivity use rolling three-month periods. Vacancies come from a separate employer survey and retain their own period.",
    },
  }),
  nationalDebt: defineFeed({
    id: "nationalDebt", registry: "feed", title: "Public sector net debt excluding public sector banks", displayName: "National Debt",
    evidenceClass: "official-statistics", geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["ons-psnd-hf6w", "ons-psnd-hf6x"], automation: "automated", collectionLayer: "worker", frequency: "monthly",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "monthly",
    retrievalMaxAgeMs: 40 * DAY_MS, publicationRequirement: "required",
    freshnessWindow: "Checked within 40 days",
    freshnessRationale: "Public sector finance data is normally monthly; the window allows for weekends, bank holidays and release-calendar variation.",
    uiSourceLabels: ["ONS Public Sector Finances"],
    editorial: {
      publicationPeriod: "Latest monthly public-sector-finance period available",
      unit: "£ billions and percentage of GDP",
      revisionStatus: "Subject to routine ONS public-sector-finance revisions",
      caveat: "Public sector net debt excluding public sector banks (HF6W) and the matching percentage-of-GDP series (HF6X) are shown together. Other debt measures are not interchangeable.",
    },
  }),
  taxRevenue: defineFeed({
    id: "taxRevenue", registry: "feed", title: "Central government receipts", displayName: "Government Receipts",
    evidenceClass: "official-statistics", geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["ons-public-sector-finances"], automation: "automated", collectionLayer: "worker", frequency: "monthly",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "monthly",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "required",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The rolling public-sector-finance bulletin is checked regularly, while its publication period is assessed separately.",
    uiSourceLabels: ["ONS Public Sector Finances"],
    editorial: {
      publicationPeriod: "Latest ONS public-sector-finance bulletin edition",
      unit: "£ billions of central government receipts",
      revisionStatus: "Subject to routine public-finance revisions",
      caveat: "The monthly receipts measure is not a tax-burden ratio, category breakdown, forecast or average-per-person estimate.",
    },
  }),
  migrationStats: defineFeed({
    id: "migrationStats", registry: "feed", title: "Long-term international migration", displayName: "Migration",
    evidenceClass: "official-statistics", geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["ons-long-term-migration-bulletin", "ons-long-term-migration-dataset"], automation: "automated", collectionLayer: "worker", frequency: "periodic",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "periodic",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "required",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The latest ONS edition is checked regularly, while its publication period is assessed separately.",
    uiSourceLabels: ["ONS Long-term international migration"],
    editorial: {
      publicationPeriod: "Latest ONS long-term international migration bulletin edition",
      unit: "People",
      revisionStatus: "Official statistics in development; the newest estimates are provisional for one year and earlier periods may be revised",
      caveat: "Long-term migration estimates cover people moving for 12 months or more. Visa grants and nationality tables are different administrative measures and are not mixed into this headline.",
    },
  }),
  housePriceIndex: defineFeed({
    id: "housePriceIndex", registry: "feed", title: "UK House Price Index", displayName: "House Price Index",
    evidenceClass: "official-statistics", geography: { code: "UK", label: "United Kingdom" },
    sourceIds: ["ons-private-rent-house-prices"], automation: "automated", collectionLayer: "worker", frequency: "monthly",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "monthly",
    retrievalMaxAgeMs: 45 * DAY_MS, publicationRequirement: "required",
    freshnessWindow: "Checked within 45 days",
    freshnessRationale: "The latest ONS edition is discovered from the rolling bulletin; the house-price percentage-change series can lag the bulletin's publication.",
    editorial: {
      publicationPeriod: "Latest ONS Private rent and house prices, UK bulletin edition",
      unit: "Average price (£, headline-only) and annual %-change (with monthly history)",
      revisionStatus: "UK HPI first estimates are provisional and subject to revision as later transaction data is incorporated",
      caveat: "The average price level is headline-only and is not presented as a fabricated historical series. The annual percentage-change figure can lag the bulletin's publication by one to two months.",
    },
  }),
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
  nhsStats: defineFeed({
    id: "nhsStats", registry: "feed", title: "Referral-to-treatment waiting times", displayName: "NHS Referral to Treatment",
    evidenceClass: "administrative-data", geography: { code: "ENG", label: "England" },
    sourceIds: ["nhs-england-rtt"], automation: "automated", collectionLayer: "worker", frequency: "monthly",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "monthly",
    retrievalMaxAgeMs: 45 * DAY_MS, publicationRequirement: "required",
    freshnessWindow: "Within 45 days of primary publication",
    freshnessRationale: "Each accepted RTT publication retains its NHS England publication date and is withdrawn after 45 days.",
    editorial: {
      publicationPeriod: "Latest verified NHS England referral-to-treatment month",
      unit: "Incomplete pathways, weeks or percentage, as labelled",
      revisionStatus: "NHS England may revise provider submissions, usually through periodic revision releases",
      caveat: "The headline counts consultant-led pathways rather than unique people. National figures include estimates for non-reporting acute trusts, while treatment-function rows exclude those estimates.",
    },
  }),
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
  crimeStatistics: defineFeed({
    id: "crimeStatistics", registry: "feed", title: "UK Crime Statistics", displayName: "Crime Statistics",
    evidenceClass: "official-statistics", geography: { code: "EAW", label: "England and Wales" },
    sourceIds: ["ons-crime-csew", "home-office-police-recorded-crime", "moj-criminal-courts"],
    automation: "automated", collectionLayer: "worker", frequency: "periodic",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "periodic",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "optional",
    editorial: {
      publicationPeriod: "Latest verified ONS Crime in England and Wales edition and current MoJ quarterly court publication, shown separately",
      unit: "Estimated incidents, recorded offences or median days, as labelled",
      revisionStatus: "Official source publications may be revised; each module retains its own release and observation period",
      caveat: "Crime Survey estimates, police-recorded offences and court timeliness measure different phenomena and are never added into one total. Regional rankings remain unavailable until one versioned geography and population method is reproducible. Geography is England and Wales.",
    },
  }),
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
