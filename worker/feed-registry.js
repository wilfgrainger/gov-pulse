const ONS_GENERATOR = "https://www.ons.gov.uk/generator?format=csv&uri=";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function onsSeries(seriesId, datasetId, topicPath, label) {
  return {
    publisher: "Office for National Statistics",
    label,
    seriesId,
    datasetId,
    url: `${ONS_GENERATOR}${topicPath}`,
    sourceClass: "official-primary",
  };
}

export const FEED_REGISTRY_VERSION = "2026-08-02.1";

export const FEED_REGISTRY = Object.freeze({
  sentimentPulse: {
    section: "sentimentPulse",
    title: "Series-level economic indicators",
    evidenceClass: "official-data",
    geography: "United Kingdom",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "series-specific: monthly and event-driven",
    operationalStatus: "active",
    retrievalMaxAgeMs: 36 * HOUR_MS,
    upstreams: [
      {
        publisher: "Office for National Statistics",
        label: "CPI annual rate D7G7 / MM23",
        seriesId: "D7G7",
        datasetId: "MM23",
        url: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
        sourceClass: "official-primary",
        caveat: "The Worker retrieves the official monthly CSV and the series page release metadata; the observation and publication clocks are retained separately.",
      },
      {
        publisher: "Bank of England",
        label: "Official Bank Rate IUDBEDR / IADB",
        seriesId: "IUDBEDR",
        datasetId: "IADB",
        url: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
        sourceClass: "official-primary",
        caveat: "Bank Rate is event-dated and remains current until a later Monetary Policy Committee decision changes it.",
      },
      {
        publisher: "Office for National Statistics",
        label: "Unemployment rate MGSX / LMS",
        seriesId: "MGSX",
        datasetId: "LMS",
        url: "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
        sourceClass: "official-primary",
        caveat: "MGSX is a rolling three-month Labour Force Survey estimate. Its period is not aligned to the CPI month.",
      },
    ],
  },
  gdpTracker: {
    section: "gdpTracker",
    title: "Monthly gross domestic product",
    evidenceClass: "official-data",
    geography: "United Kingdom",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "monthly",
    operationalStatus: "active",
    retrievalMaxAgeMs: 36 * HOUR_MS,
    upstreams: [
      {
        publisher: "Office for National Statistics",
        label: "GDP monthly estimate, UK bulletin",
        url: "https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/latest",
        sourceClass: "official-primary",
        caveat: "The Worker discovers and validates the latest bulletin edition from this rolling publication page.",
      },
    ],
  },
  employmentStats: {
    section: "employmentStats",
    title: "UK labour market",
    evidenceClass: "official-data",
    geography: "United Kingdom",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "monthly",
    operationalStatus: "active",
    retrievalMaxAgeMs: 36 * HOUR_MS,
    upstreams: [
      {
        publisher: "Office for National Statistics",
        label: "UK labour market bulletin",
        url: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest",
        sourceClass: "official-primary",
        caveat: "The Worker keeps Labour Force Survey and vacancies periods explicit and discovers the latest bulletin edition.",
      },
    ],
  },
  nationalDebt: {
    section: "nationalDebt",
    title: "Public sector net debt excluding public sector banks",
    evidenceClass: "official-data",
    geography: "United Kingdom",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "monthly",
    operationalStatus: "active",
    retrievalMaxAgeMs: 40 * DAY_MS,
    upstreams: [
      onsSeries(
        "HF6W",
        "PUSF",
        "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf",
        "Public sector net debt excluding public sector banks"
      ),
      onsSeries(
        "HF6X",
        "PUSF",
        "/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf",
        "Public sector net debt excluding public sector banks as a percentage of GDP"
      ),
    ],
  },
  taxRevenue: {
    section: "taxRevenue",
    title: "Central government receipts",
    evidenceClass: "official-data",
    geography: "United Kingdom",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "monthly",
    operationalStatus: "active",
    retrievalMaxAgeMs: 36 * HOUR_MS,
    upstreams: [
      {
        publisher: "Office for National Statistics",
        label: "Public sector finances, UK bulletin",
        url: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/latest",
        sourceClass: "official-primary",
        caveat: "The Worker extracts one monthly central-government-receipts measure from the latest bulletin and does not mix forecasts or tax-burden estimates.",
      },
    ],
  },
  migrationStats: {
    section: "migrationStats",
    title: "Long-term international migration",
    evidenceClass: "official-data",
    geography: "United Kingdom",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "periodic",
    operationalStatus: "active",
    retrievalMaxAgeMs: 36 * HOUR_MS,
    upstreams: [
      {
        publisher: "Office for National Statistics",
        label: "Long-term international migration, provisional bulletin",
        url: "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional/yearendingdecember2025",
        sourceClass: "official-primary",
        caveat: "The Worker discovers the current edition from the rolling dataset page before retrieving the bulletin; this URL records the edition verified on 14 July 2026.",
      },
      {
        publisher: "Office for National Statistics",
        label: "Long-term immigration, emigration and net migration dataset",
        url: "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional",
        sourceClass: "official-primary",
      },
    ],
  },
  electionPolling: {
    section: "electionPolling",
    title: "Primary voting-intention poll publications",
    evidenceClass: "public-opinion",
    geography: "Great Britain",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "as published",
    operationalStatus: "active",
    retrievalMaxAgeMs: 14 * DAY_MS,
    upstreams: [
      {
        publisher: "YouGov",
        label: "YouGov Westminster voting-intention primary tables",
        url: "https://yougov.com/en-gb/articles",
        sourceClass: "primary-pollster-publication",
        caveat: "The private Worker discovers the latest named voting-intention article and retains the direct primary result-table URL. Each payload expires after 14 days.",
      },
      {
        publisher: "British Polling Council",
        label: "British Polling Council disclosure rules",
        url: "https://www.britishpollingcouncil.org/objects-and-rules/",
        sourceClass: "methodology-standard",
      },
    ],
  },
  nhsStats: {
    section: "nhsStats",
    title: "Referral-to-treatment waiting times",
    evidenceClass: "official-data",
    geography: "England",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "monthly",
    operationalStatus: "active",
    retrievalMaxAgeMs: 45 * DAY_MS,
    upstreams: [
      {
        publisher: "NHS England",
        label: "Referral-to-treatment waiting-times publication page",
        url: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
        sourceClass: "official-primary",
        caveat: "The private Worker discovers the current annual data page and reconciles the latest statistical press notice with the overview time-series workbook.",
      },
    ],
  },
  bettingOdds: {
    section: "bettingOdds",
    title: "Strict political betting market snapshots",
    evidenceClass: "market-signal",
    geography: "United Kingdom",
    retrieval: "scheduled-publication-check",
    refreshCadence: "every 3 hours",
    publicationCadence: "continuous market repricing",
    operationalStatus: "active",
    retrievalMaxAgeMs: 4 * HOUR_MS,
    publicationRequirement: "optional",
    upstreams: [
      {
        publisher: "Oddschecker",
        label: "Next Prime Minister after Andy Burnham",
        url: "https://www.oddschecker.com/politics/british-politics/next-prime-minister-after-andy-burnham",
        sourceClass: "commercial-market-snapshot",
        caveat: "public-data.org retains raw decimal odds and expires the complete three-market snapshot four hours after observation.",
      },
      {
        publisher: "Oddschecker",
        label: "Most seats at the next UK general election",
        url: "https://www.oddschecker.com/politics/british-politics/next-uk-general-election/most-seats",
        sourceClass: "commercial-market-snapshot",
      },
      {
        publisher: "Oddschecker",
        label: "Year of the next UK general election",
        url: "https://www.oddschecker.com/politics/british-politics/next-uk-general-election/year-of-next-general-election",
        sourceClass: "commercial-market-snapshot",
        caveat: "Raw reciprocal percentages are not normalized to 100% and are not official statistics, polls or forecasts.",
      },
    ],
  },
  crimeStatistics: {
    section: "crimeStatistics",
    title: "UK Crime Statistics",
    evidenceClass: "official-data",
    geography: "England and Wales",
    retrieval: "scheduled-publication-check",
    refreshCadence: "daily",
    publicationCadence: "periodic",
    operationalStatus: "active",
    retrievalMaxAgeMs: 36 * HOUR_MS,
    publicationRequirement: "optional",
    upstreams: [
      {
        publisher: "Office for National Statistics",
        label: "Crime Survey for England and Wales (CSEW)",
        url: "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/latest",
        sourceClass: "official-primary",
      },
      {
        publisher: "Home Office",
        label: "Police Recorded Crime (PRC)",
        url: "https://www.gov.uk/government/statistics/police-recorded-crime-open-data-tables",
        sourceClass: "official-primary",
      },
      {
        publisher: "Ministry of Justice",
        label: "Criminal Court Statistics",
        url: "https://www.gov.uk/government/collections/criminal-court-statistics",
        sourceClass: "official-primary",
      },
    ],
  },
});

// Government contracts is a publication-layer source rather than a normal feed,
// but its currentness policy lives beside the feed registry so the publication
// boundary has one runtime owner for every public section.
export const PUBLICATION_SOURCE_REGISTRY = Object.freeze({
  governmentContracts: {
    section: "governmentContracts",
    retrievalMaxAgeMs: 72 * HOUR_MS,
    publicationRequirement: "optional",
  },
});

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
  Object.values(FEED_REGISTRY)
    .filter((feed) => feed.publicationRequirement === "optional")
    .map((feed) => feed.section)
);

export function provenanceFor(section) {
  const feed = FEED_REGISTRY[section];
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