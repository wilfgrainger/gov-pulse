import { validateSourceDefinition } from "./evidence-domain.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ONS_GENERATOR = "https://www.ons.gov.uk/generator?format=csv&uri=";

export const SOURCE_CATALOG_VERSION = "2026-10-06.1";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function defineSource(input) {
  const {
    sourceClass = "official-primary",
    seriesId,
    datasetId,
    ...definition
  } = input;
  const source = validateSourceDefinition(definition);
  return deepFreeze({
    ...source,
    sourceClass,
    ...(seriesId ? { seriesId } : {}),
    ...(datasetId ? { datasetId } : {}),
  });
}

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

export const SOURCE_CATALOG = deepFreeze({
  "ons-cpi-d7g7": defineSource({
    id: "ons-cpi-d7g7",
    name: "CPI annual rate D7G7 / MM23",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23"],
    cadence: "monthly",
    caveats: ["The official monthly CSV and series-page release metadata retain separate observation and publication clocks."],
    seriesId: "D7G7",
    datasetId: "MM23",
  }),
  "boe-bank-rate-iudbedr": defineSource({
    id: "boe-bank-rate-iudbedr",
    name: "Official Bank Rate IUDBEDR / IADB",
    publisher: "Bank of England",
    evidenceClass: "official-policy",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp"],
    cadence: "event-driven",
    caveats: ["Bank Rate is event-dated and remains current until a later Monetary Policy Committee decision changes it."],
    seriesId: "IUDBEDR",
    datasetId: "IADB",
  }),
  "ons-unemployment-mgsx": defineSource({
    id: "ons-unemployment-mgsx",
    name: "Unemployment rate MGSX / LMS",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms"],
    cadence: "monthly",
    caveats: ["MGSX is a rolling three-month Labour Force Survey estimate. Its period is not aligned to the CPI month."],
    seriesId: "MGSX",
    datasetId: "LMS",
  }),
  "ons-gdp-monthly": defineSource({
    id: "ons-gdp-monthly",
    name: "GDP monthly estimate, UK bulletin",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk/latest"],
    cadence: "monthly",
    caveats: ["The latest bulletin edition is discovered and validated from the rolling publication page."],
  }),
  "ons-uk-labour-market": defineSource({
    id: "ons-uk-labour-market",
    name: "UK labour market bulletin",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest"],
    cadence: "monthly",
    caveats: ["Labour Force Survey and vacancies periods remain explicit and the latest bulletin edition is discovered from the publisher."],
  }),
  "ons-psnd-hf6w": defineSource({
    id: "ons-psnd-hf6w",
    name: "Public sector net debt excluding public sector banks",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: [`${ONS_GENERATOR}/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf`],
    cadence: "monthly",
    caveats: ["This is a fiscal stock in cash terms, not the amount borrowed during the month."],
    seriesId: "HF6W",
    datasetId: "PUSF",
  }),
  "ons-psnd-hf6x": defineSource({
    id: "ons-psnd-hf6x",
    name: "Public sector net debt excluding public sector banks as a percentage of GDP",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: [`${ONS_GENERATOR}/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf`],
    cadence: "monthly",
    caveats: ["This is the matching public-sector-net-debt-to-GDP series; other debt measures are not interchangeable."],
    seriesId: "HF6X",
    datasetId: "PUSF",
  }),
  "ons-public-sector-finances": defineSource({
    id: "ons-public-sector-finances",
    name: "Public sector finances, UK bulletin",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/latest"],
    cadence: "monthly",
    caveats: ["The receipts measure is taken from the latest bulletin and is not mixed with forecasts or tax-burden estimates."],
  }),
  "ons-long-term-migration-bulletin": defineSource({
    id: "ons-long-term-migration-bulletin",
    name: "Long-term international migration, provisional bulletin",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional/yearendingdecember2025"],
    cadence: "periodic",
    caveats: ["The collector discovers the current edition from the rolling dataset page; the stored URL identifies the previously verified edition."],
  }),
  "ons-long-term-migration-dataset": defineSource({
    id: "ons-long-term-migration-dataset",
    name: "Long-term immigration, emigration and net migration dataset",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional"],
    cadence: "periodic",
    caveats: [],
  }),
  "ons-private-rent-house-prices": defineSource({
    id: "ons-private-rent-house-prices",
    name: "Private rent and house prices, UK bulletin",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/latest"],
    cadence: "monthly",
    caveats: ["PIPR and HPI remain separate. HPI gaps remain explicit and the headline average price is not invented as a historical series."],
  }),
  "ons-average-weekly-earnings": defineSource({
    id: "ons-average-weekly-earnings",
    name: "Average weekly earnings in Great Britain bulletin",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "GB", label: "Great Britain" },
    primaryUrls: ["https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/latest"],
    cadence: "monthly",
    caveats: ["The collector uses ONS's published CPIH-adjusted real-terms earnings measure rather than deriving it from separate nominal-pay and inflation series."],
  }),
  "yougov-voting-intention": defineSource({
    id: "yougov-voting-intention",
    name: "YouGov Westminster voting-intention primary tables",
    publisher: "YouGov",
    evidenceClass: "polling",
    geography: { code: "GB", label: "Great Britain" },
    primaryUrls: ["https://yougov.com/en-gb/articles"],
    cadence: "as published",
    caveats: ["The collector retains the direct primary result-table URL and each accepted poll expires after the defined polling evidence window."],
    sourceClass: "primary-pollster-publication",
  }),
  "more-in-common-voting-intention": defineSource({
    id: "more-in-common-voting-intention",
    name: "More in Common voting-intention tracker archive",
    publisher: "More in Common",
    evidenceClass: "polling",
    geography: { code: "GB", label: "Great Britain" },
    primaryUrls: ["https://www.moreincommon.org.uk/polling-tables/?_polling_tables_type=voting-intention"],
    cadence: "as published",
    caveats: ["The collector reconciles the publisher workbook and retains disclosed fieldwork and method metadata without inventing missing disclosure."],
    sourceClass: "primary-pollster-publication",
  }),
  "british-polling-council-rules": defineSource({
    id: "british-polling-council-rules",
    name: "British Polling Council disclosure rules",
    publisher: "British Polling Council",
    evidenceClass: "official-policy",
    geography: { code: "GB", label: "Great Britain" },
    primaryUrls: ["https://www.britishpollingcouncil.org/objects-and-rules/"],
    cadence: "policy",
    caveats: [],
    sourceClass: "methodology-standard",
  }),
  "nhs-england-rtt": defineSource({
    id: "nhs-england-rtt",
    name: "Referral-to-treatment waiting-times publication page",
    publisher: "NHS England",
    evidenceClass: "administrative-data",
    geography: { code: "ENG", label: "England" },
    primaryUrls: ["https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/"],
    cadence: "monthly",
    caveats: ["The collector reconciles the latest statistical press notice with the overview time-series workbook."],
  }),
  "oddschecker-next-pm": defineSource({
    id: "oddschecker-next-pm",
    name: "Next Prime Minister after Andy Burnham",
    publisher: "Oddschecker",
    evidenceClass: "market-signal",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.oddschecker.com/politics/british-politics/next-prime-minister-after-andy-burnham"],
    cadence: "continuous",
    caveats: ["Raw decimal odds are retained and the complete market snapshot expires after the configured observation window."],
    sourceClass: "commercial-market-snapshot",
  }),
  "oddschecker-most-seats": defineSource({
    id: "oddschecker-most-seats",
    name: "Most seats at the next UK general election",
    publisher: "Oddschecker",
    evidenceClass: "market-signal",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.oddschecker.com/politics/british-politics/next-uk-general-election/most-seats"],
    cadence: "continuous",
    caveats: [],
    sourceClass: "commercial-market-snapshot",
  }),
  "oddschecker-election-year": defineSource({
    id: "oddschecker-election-year",
    name: "Year of the next UK general election",
    publisher: "Oddschecker",
    evidenceClass: "market-signal",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.oddschecker.com/politics/british-politics/next-uk-general-election/year-of-next-general-election"],
    cadence: "continuous",
    caveats: ["Raw reciprocal percentages are not normalized to 100% and are not official statistics, polls or forecasts."],
    sourceClass: "commercial-market-snapshot",
  }),
  "ons-crime-csew": defineSource({
    id: "ons-crime-csew",
    name: "Crime Survey for England and Wales (CSEW)",
    publisher: "Office for National Statistics",
    evidenceClass: "official-statistics",
    geography: { code: "EAW", label: "England and Wales" },
    primaryUrls: ["https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/crimeinenglandandwales/latest"],
    cadence: "periodic",
    caveats: [],
  }),
  "home-office-police-recorded-crime": defineSource({
    id: "home-office-police-recorded-crime",
    name: "Police Recorded Crime (PRC)",
    publisher: "Home Office",
    evidenceClass: "administrative-data",
    geography: { code: "EAW", label: "England and Wales" },
    primaryUrls: ["https://www.gov.uk/government/statistics/police-recorded-crime-open-data-tables"],
    cadence: "periodic",
    caveats: [],
  }),
  "moj-criminal-courts": defineSource({
    id: "moj-criminal-courts",
    name: "Criminal Court Statistics",
    publisher: "Ministry of Justice",
    evidenceClass: "administrative-data",
    geography: { code: "EAW", label: "England and Wales" },
    primaryUrls: ["https://www.gov.uk/government/collections/criminal-court-statistics"],
    cadence: "quarterly",
    caveats: [],
  }),
  "cabinet-office-find-a-tender": defineSource({
    id: "cabinet-office-find-a-tender",
    name: "Find a Tender OCDS award releases",
    publisher: "Cabinet Office",
    evidenceClass: "administrative-data",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.find-tender.service.gov.uk/"],
    cadence: "continuous publication",
    caveats: ["Award values are commitments disclosed in notices, not invoices or confirmed lifetime expenditure."],
  }),
  "ons-release-calendar": defineSource({
    id: "ons-release-calendar",
    name: "Official release calendar (upcoming and cancelled releases)",
    publisher: "Office for National Statistics",
    evidenceClass: "administrative-data",
    geography: { code: "UK", label: "United Kingdom" },
    primaryUrls: ["https://www.ons.gov.uk/releasecalendar"],
    cadence: "publisher-announced",
    caveats: ["Confirmed, provisional and cancelled dates remain distinct; absence from the calendar is not interpreted as a scheduled date."],
  }),
  "nhs-release-calendar": defineSource({
    id: "nhs-release-calendar",
    name: "12-month statistics calendar and current RTT plan PDF",
    publisher: "NHS England",
    evidenceClass: "administrative-data",
    geography: { code: "ENG", label: "England" },
    primaryUrls: ["https://www.england.nhs.uk/statistics/12-months-statistics-calendar/"],
    cadence: "publisher-announced",
    caveats: ["Future dates in the proposed plan remain provisional and are re-read from the current publisher plan."],
  }),
  "imf-data": defineSource({
    id: "imf-data",
    name: "World Economic Outlook and Public Finances in Modern History",
    publisher: "International Monetary Fund",
    evidenceClass: "official-statistics",
    geography: { code: "INT", label: "International" },
    primaryUrls: ["https://www.imf.org/en/Data"],
    cadence: "publisher-specific annual releases",
    caveats: ["GDP and debt-interest coverage is measure- and year-specific; estimates and projections remain labelled."],
  }),
  "world-bank-wdi": defineSource({
    id: "world-bank-wdi",
    name: "World Development Indicators",
    publisher: "World Bank",
    evidenceClass: "official-statistics",
    geography: { code: "INT", label: "International" },
    primaryUrls: ["https://api.worldbank.org/"],
    cadence: "publisher-specific",
    caveats: ["Publisher-reported nulls remain missing and per-resident calculations retain denominator inputs and source update dates."],
  }),
  "oecd-data-explorer": defineSource({
    id: "oecd-data-explorer",
    name: "DAC1, SOCX and Revenue Statistics datasets",
    publisher: "OECD",
    evidenceClass: "official-statistics",
    geography: { code: "INT", label: "International" },
    primaryUrls: ["https://data-explorer.oecd.org/"],
    cadence: "publisher-specific",
    caveats: ["Comparable country coverage varies by dataset and release; incompatible measures are not combined."],
  }),
  "sipri-milex": defineSource({
    id: "sipri-milex",
    name: "Military Expenditure Database",
    publisher: "SIPRI",
    evidenceClass: "official-statistics",
    geography: { code: "INT", label: "International" },
    primaryUrls: ["https://www.sipri.org/databases/milex"],
    cadence: "annual",
    caveats: ["Reported estimates retain source year and currency and are not interchangeable with government budget totals."],
  }),
  "who-world-bank-health": defineSource({
    id: "who-world-bank-health",
    name: "Current health expenditure per capita",
    publisher: "WHO Global Health Expenditure Database via World Bank WDI",
    evidenceClass: "official-statistics",
    geography: { code: "INT", label: "International" },
    primaryUrls: ["https://data.worldbank.org/indicator/SH.XPD.CHEX.PC.CD"],
    cadence: "annual",
    caveats: ["The measure covers public and private current health expenditure, not government-only or NHS spending."],
  }),
  "ukhsa-cover": defineSource({
    id: "ukhsa-cover",
    name: "COVER childhood vaccination statistics",
    publisher: "UK Health Security Agency",
    evidenceClass: "official-statistics",
    geography: { code: "ENG", label: "England" },
    primaryUrls: ["https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-annual-reports/vaccination-coverage-statistics-for-children-aged-up-to-5-years-england-cover-programme-report-april-2024-to-march-2025"],
    cadence: "annual",
    caveats: ["Published immunisation data may receive corrections."],
  }),
  "dfe-eyfs": defineSource({
    id: "dfe-eyfs",
    name: "Early years foundation stage profile results",
    publisher: "Department for Education",
    evidenceClass: "official-statistics",
    geography: { code: "ENG", label: "England" },
    primaryUrls: ["https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/2024-25"],
    cadence: "annual",
    caveats: ["The EYFS profile baseline changed in 2021/22, so rates before and after that change are not directly comparable."],
  }),
});

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
  realWages: defineFeed({
    id: "realWages", registry: "feed", title: "Real-terms growth in average weekly earnings", displayName: "Real Wages",
    evidenceClass: "official-statistics", geography: { code: "GB", label: "Great Britain" },
    sourceIds: ["ons-average-weekly-earnings"], automation: "automated", collectionLayer: "worker", frequency: "monthly",
    retrieval: "scheduled-publication-check", refreshCadence: "daily", publicationCadence: "monthly",
    retrievalMaxAgeMs: 36 * HOUR_MS, publicationRequirement: "required",
    freshnessWindow: "Checked within 36 hours",
    freshnessRationale: "The latest ONS average weekly earnings bulletin is checked regularly, while its publication period is assessed separately.",
    editorial: {
      publicationPeriod: "Latest ONS average weekly earnings bulletin edition",
      unit: "Percentage, real terms (CPIH-adjusted)",
      revisionStatus: "Average weekly earnings are provisional and subject to revision",
      caveat: "This uses ONS's own CPIH-adjusted real-terms earnings growth figure, not a calculation from separate nominal-pay and inflation series.",
    },
  }),
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
      caveat: "Each named market remains separate. Raw reciprocal percentages are not normalized to 100%; liquidity, provider coverage, bookmaker margins and market rules affect them.",
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
      caveat: "Crime Survey estimates, police-recorded offences and court timeliness measure different phenomena and are never added into one total.",
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
  pmApproval: defineFeed({
    id: "pmApproval", registry: null, title: "Prime minister approval", displayName: "PM Approval",
    evidenceClass: "polling", geography: { code: "GB", label: "Great Britain" }, sourceIds: [],
    automation: "withdrawn", collectionLayer: "worker", frequency: "withdrawn",
    uiSourceLabels: ["No current verified source"],
    editorial: {
      publicationPeriod: "No current publication represented", unit: "No approval value displayed",
      revisionStatus: "Previous embedded series withdrawn",
      caveat: "No current PM approval number is inferred or averaged without first-party poll publications, complete fieldwork and sample disclosures, consistent question wording and a tested comparison method.",
    },
  }),
  polarizationMeter: defineFeed({
    id: "polarizationMeter", registry: null, title: "Political polarisation measure", displayName: "Polarization Measure",
    evidenceClass: "derived-analysis", geography: { code: "GB", label: "Great Britain" }, sourceIds: [],
    automation: "withdrawn", collectionLayer: "worker", frequency: "withdrawn",
    uiSourceLabels: ["No current verified source"],
    editorial: {
      publicationPeriod: "No current publication represented", unit: "No derived score displayed",
      revisionStatus: "Previous site-derived score withdrawn",
      caveat: "The measure remains unavailable until its inputs, coverage, weighting, missing-data treatment, exclusions, formula, sensitivity checks and uncertainty are published and tested.",
    },
  }),
  trendLines: defineFeed({
    id: "trendLines", registry: null, title: "Government satisfaction trend", displayName: "Government Satisfaction Trend",
    evidenceClass: "polling", geography: { code: "GB", label: "Great Britain" }, sourceIds: [],
    automation: "withdrawn", collectionLayer: "worker", frequency: "withdrawn",
    uiSourceLabels: ["No current verified source"],
    editorial: {
      publicationPeriod: "No current publication represented", unit: "No satisfaction or trust value displayed",
      revisionStatus: "Previous hardcoded trend and event annotations withdrawn",
      caveat: "Satisfaction, approval and trust questions are not interchangeable. A future series requires one named measure, direct primary tables, complete wave disclosures and explicit comparability breaks.",
    },
  }),
  geographicHeatmap: defineFeed({
    id: "geographicHeatmap", registry: null, title: "UK regional comparison", displayName: "UK Regional Comparison",
    evidenceClass: "derived-analysis", geography: { code: "UK", label: "United Kingdom — former mixed geographies" }, sourceIds: [],
    automation: "withdrawn", collectionLayer: "worker", frequency: "withdrawn",
    uiSourceLabels: ["No current comparable regional series"],
    editorial: {
      publicationPeriod: "No current regional publication represented", unit: "No regional value or ranking displayed",
      revisionStatus: "Previous hardcoded multi-source comparison withdrawn",
      caveat: "The former map mixed non-standard regions and source systems with different national coverage. A future comparison requires official geography codes, one named measure and a reproducible join.",
    },
  }),
  echoChamberMap: defineFeed({
    id: "echoChamberMap", registry: null, title: "Policy relationship matrix", displayName: "Policy Relationship Matrix",
    evidenceClass: "derived-analysis", geography: { code: "GB", label: "Great Britain — former derived analysis" }, sourceIds: [],
    automation: "withdrawn", collectionLayer: "worker", frequency: "withdrawn",
    uiSourceLabels: ["No current reproducible survey analysis"],
    editorial: {
      publicationPeriod: "No current survey publication represented", unit: "No relationship coefficient displayed",
      revisionStatus: "Previous site-derived matrix withdrawn",
      caveat: "The analysis remains unavailable until its inputs, variables, survey coverage, weighting, exclusions, statistic, uncertainty and tests can be published and reproduced.",
    },
  }),
  politicalCompass: defineFeed({
    id: "politicalCompass", registry: null, title: "Political compass", displayName: "Political Compass",
    evidenceClass: "derived-analysis", uiEvidenceClass: "user-generated",
    geography: { code: "NA", label: "Not geographic" }, sourceIds: [],
    automation: "interactive", collectionLayer: "worker", frequency: "user interaction only",
    uiSourceLabels: ["User responses"],
    editorial: {
      publicationPeriod: "Current user session", unit: "User-generated position score",
      revisionStatus: "Recalculated when answers change",
      caveat: "This is an illustrative self-assessment, not a validated diagnosis, public statistic or population estimate.",
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
