import {
  COMPARISON_COUNTRIES,
  COMPARISON_MEASURES,
  COMPARISON_SCHEMA_VERSION,
  COMPARISON_SET_ID,
  buildComparisonMeasure,
  validateInternationalComparisonPublication,
} from "./international-comparison.js";
import {
  OECD_COMPARABLE_IDS,
  SOURCE_QUERIES,
  calculatePerResidentFromPercentGdp,
  calculatePerResidentFromTotal,
  fetchImfSeries,
  fetchOecdSeries,
  fetchSipriCurrentUsdHistory,
  fetchWorldBankSeries,
  fetchWorldBankSeriesHistory,
} from "./international-comparison-sources.js";

const COUNTRY_IDS = COMPARISON_COUNTRIES.map(({ id }) => id);
const OECD_IDS = new Set(OECD_COMPARABLE_IDS);
const DESCRIPTORS = new Map(COMPARISON_MEASURES.map((measure) => [measure.id, measure]));
const MEASURE_SOURCE_DEPENDENCIES = Object.freeze({
  governmentDebt: ["imf-gdp-2026", "imf-debt-2026"],
  officialDevelopmentAssistance: ["world-bank-population-2025", "oecd-oda-2025"],
  defenceSpending: ["world-bank-population-2025", "sipri-2025"],
  publicSocialExpenditure: ["world-bank-gdp-per-capita-2023", "oecd-socx-2023"],
  healthcareSpending: ["world-bank-health-2024"],
  taxRevenue: ["world-bank-gdp-per-capita-2024", "oecd-tax-2024"],
  debtInterest: ["world-bank-gdp-per-capita-2024", "imf-interest-2024"],
});
const INTERNATIONAL_SOURCES = Object.freeze([
  "imf-gdp-2026",
  "world-bank-population-2025",
  "imf-debt-2026",
  "imf-interest-2024",
  "oecd-oda-2025",
  "sipri-2025",
  "oecd-socx-2023",
  "world-bank-health-2024",
  "oecd-tax-2024",
  "world-bank-gdp-per-capita-2023",
  "world-bank-gdp-per-capita-2024",
]);
const INTERNATIONAL_COMPARISON_REFRESH_BATCHES = Object.freeze([
  Object.freeze({ id: "government-debt", sourceIds: Object.freeze(["imf-gdp-2026", "imf-debt-2026"]), measureIds: Object.freeze(["governmentDebt"]) }),
  Object.freeze({ id: "oda", sourceIds: Object.freeze(["world-bank-population-2025", "oecd-oda-2025"]), measureIds: Object.freeze(["officialDevelopmentAssistance"]) }),
  Object.freeze({ id: "defence", sourceIds: Object.freeze(["world-bank-population-2025", "sipri-2025"]), measureIds: Object.freeze(["defenceSpending"]) }),
  Object.freeze({ id: "social-spending", sourceIds: Object.freeze(["world-bank-gdp-per-capita-2023", "oecd-socx-2023"]), measureIds: Object.freeze(["publicSocialExpenditure"]) }),
  Object.freeze({ id: "healthcare", sourceIds: Object.freeze(["world-bank-health-2024"]), measureIds: Object.freeze(["healthcareSpending"]) }),
  Object.freeze({ id: "tax-revenue", sourceIds: Object.freeze(["world-bank-gdp-per-capita-2024", "oecd-tax-2024"]), measureIds: Object.freeze(["taxRevenue"]) }),
  Object.freeze({ id: "debt-interest", sourceIds: Object.freeze(["world-bank-gdp-per-capita-2024", "imf-interest-2024"]), measureIds: Object.freeze(["debtInterest"]) }),
]);
const COMPARISON_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

const SOURCES = Object.freeze({
  imfWEO2026: Object.freeze({
    publisher: "International Monetary Fund",
    url: SOURCE_QUERIES.imfDebtPctGdp2026,
    series: "World Economic Outlook April 2026: gross general government debt (% GDP)",
    additionalSources: [Object.freeze({
      publisher: "International Monetary Fund",
      url: SOURCE_QUERIES.imfGdpPerCapita2026,
      series: "World Economic Outlook April 2026: GDP per capita (current USD), 2026 projection",
    })],
  }),
  imfInterest2024: Object.freeze({
    publisher: "International Monetary Fund",
    url: SOURCE_QUERIES.imfInterestPctGdp2024,
    series: "Public Finances in Modern History: interest paid (% GDP)",
    additionalSources: [Object.freeze({
      publisher: "World Bank World Development Indicators",
      url: SOURCE_QUERIES.worldBankGdpPerCapita2024,
      series: "NY.GDP.PCAP.CD: GDP per capita (current US$), 2024",
    })],
  }),
  oecdOda2025: Object.freeze({
    publisher: "OECD",
    url: SOURCE_QUERIES.oecdOda2025,
    series: "DAC1: Official Development Assistance (ODA), grant equivalent, 2025 preliminary/current USD",
  }),
  oecdSocx2023: Object.freeze({
    publisher: "OECD",
    url: SOURCE_QUERIES.oecdSocx2023,
    series: "SOCX: public social expenditure, % GDP (2023 common comparable year)",
  }),
  oecdTax2024: Object.freeze({
    publisher: "OECD",
    url: SOURCE_QUERIES.oecdTax2024,
    series: "Revenue Statistics: total general-government tax revenue, % GDP",
  }),
  worldBankGdpPerCapita2023: Object.freeze({
    publisher: "World Bank World Development Indicators",
    url: SOURCE_QUERIES.worldBankGdpPerCapita2023,
    series: "NY.GDP.PCAP.CD: GDP per capita (current US$), 2023",
  }),
  worldBankGdpPerCapita2024: Object.freeze({
    publisher: "World Bank World Development Indicators",
    url: SOURCE_QUERIES.worldBankGdpPerCapita2024,
    series: "NY.GDP.PCAP.CD: GDP per capita (current US$), 2024",
  }),
  sipri2025: Object.freeze({
    publisher: "SIPRI",
    url: SOURCE_QUERIES.sipriMilitary2025,
    series: "SIPRI Military Expenditure Database: 2025 current USD",
  }),
  worldBankPopulationHistory: Object.freeze({
    publisher: "World Bank World Development Indicators",
    url: "https://api.worldbank.org/v2/country/GBR;USA;CHN;RUS;UKR;DEU;FRA;ITA;ESP;IRL;NLD;CHE;POL/indicator/SP.POP.TOTL?date=2015:2025&format=json&per_page=500",
    series: "SP.POP.TOTL: annual population used to calculate SIPRI military expenditure per resident",
  }),
  whoViaWorldBank2024: Object.freeze({
    publisher: "WHO Global Health Expenditure Database via World Bank WDI",
    url: SOURCE_QUERIES.worldBankHealth2024,
    series: "SH.XPD.CHEX.PC.CD",
  }),
});

function comparisonSourceBundle(values = {}) {
  return {
    gdpPerCapita2023: values.gdpPerCapita2023 ?? null,
    gdpPerCapita2024: values.gdpPerCapita2024 ?? null,
    gdpPerCapita2026: values.gdpPerCapita2026 ?? null,
    population2025: values.population2025 ?? null,
    debtPctGdp2026: values.debtPctGdp2026 ?? null,
    interestPctGdp2024: values.interestPctGdp2024 ?? null,
    odaUsd2025: values.odaUsd2025 ?? null,
    defenceUsd2025: values.defenceUsd2025 ?? null,
    defenceUsdByYear: values.defenceUsdByYear ?? null,
    populationByYear: values.populationByYear ?? null,
    socialPctGdp2023: values.socialPctGdp2023 ?? null,
    healthPerCapita2024: values.healthPerCapita2024 ?? null,
    taxPctGdp2024: values.taxPctGdp2024 ?? null,
    sourceFailures: Array.isArray(values.sourceFailures) ? values.sourceFailures : [],
    attemptedSources: Array.isArray(values.attemptedSources) ? values.attemptedSources : [...INTERNATIONAL_SOURCES],
  };
}

function fingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function lifecycleFor(id, comparisonMeasure, now, sourceFailures) {
  const failed = MEASURE_SOURCE_DEPENDENCIES[id].some((source) => sourceFailures.includes(source));
  const nowText = now.toISOString();
  if (failed) {
    return {
      sourceEditionId: null,
      validUntil: null,
      lastSuccessAt: null,
      retryAfter: nowText,
      status: "unavailable",
    };
  }
  const sourceDetails = (source) => source ? {
    publisher: source.publisher,
    url: source.url,
    series: source.series,
    publicationDate: source.publicationDate ?? null,
    additionalSources: (source.additionalSources ?? []).map(({ publisher, url, series, publicationDate }) => ({
      publisher,
      url,
      series,
      publicationDate: publicationDate ?? null,
    })),
  } : null;
  const sourceEdition = comparisonMeasure.countries.map(({ country, value, source, calculationInputs }) => [
    country,
    value,
    calculationInputs ?? null,
    sourceDetails(source),
  ]);
  if (comparisonMeasure.countryHistory) {
    sourceEdition.push(...comparisonMeasure.countryHistory.map(({ country, value, observationYear, source, calculationInputs }) => [
      country,
      observationYear,
      value,
      calculationInputs ?? null,
      sourceDetails(source),
    ]));
  }
  const hasValues = comparisonMeasure.comparableCountryCount > 0;
  const historical = comparisonMeasure.observationYear < now.getUTCFullYear();
  return {
    sourceEditionId: `${id}-${comparisonMeasure.observationYear}-${fingerprint(sourceEdition)}`,
    validUntil: new Date(now.getTime() + COMPARISON_VALIDITY_MS).toISOString(),
    lastSuccessAt: nowText,
    retryAfter: null,
    status: hasValues ? (historical ? "historical" : "current") : "unavailable",
  };
}

function value(map, country) {
  if (!(map instanceof Map)) return null;
  const candidate = map.get(country);
  return Number.isFinite(candidate) ? candidate : null;
}

function withAdditionalSource(source, additionalSource) {
  return { ...source, additionalSources: [additionalSource] };
}

function nullObservation(country, year, exclusionReason, valueType = "historical") {
  return {
    country,
    value: null,
    rank: null,
    observationYear: year,
    valueType,
    source: null,
    exclusionReason,
  };
}

function directObservations(map, year, source, coverage = () => true, notCoveredReason = "publisher-reported-no-value", valueType = "historical") {
  return COUNTRY_IDS.map((country) => {
    if (!coverage(country)) return nullObservation(country, year, notCoveredReason, valueType);
    const direct = value(map, country);
    if (direct === null) return nullObservation(country, year, "publisher-reported-no-value", valueType);
    return { country, value: direct, observationYear: year, valueType, source };
  });
}

function percentGdpObservations(percentMap, gdpMap, year, source, coverage = () => true, notCoveredReason = "publisher-reported-no-value", valueType = "historical") {
  return COUNTRY_IDS.map((country) => {
    if (!coverage(country)) return nullObservation(country, year, notCoveredReason, valueType);
    const percentGdp = value(percentMap, country);
    const gdpPerResidentUsd = value(gdpMap, country);
    if (percentGdp === null || gdpPerResidentUsd === null) {
      return nullObservation(country, year, "publisher-reported-no-value", valueType);
    }
    return {
      country,
      value: calculatePerResidentFromPercentGdp(percentGdp, gdpPerResidentUsd),
      observationYear: year,
      valueType,
      source,
      calculationInputs: { percentGdp, gdpPerResidentUsd },
    };
  });
}

function totalObservations(totalMap, populationMap, year, source, coverage = () => true, notCoveredReason = "publisher-reported-no-value", valueType = "historical") {
  return COUNTRY_IDS.map((country) => {
    if (!coverage(country)) return nullObservation(country, year, notCoveredReason, valueType);
    const totalUsd = value(totalMap, country);
    const population = value(populationMap, country);
    if (totalUsd === null || population === null) {
      return nullObservation(country, year, "publisher-reported-no-value", valueType);
    }
    return {
      country,
      value: calculatePerResidentFromTotal(totalUsd, population),
      observationYear: year,
      valueType,
      source,
      calculationInputs: { totalUsd, population },
    };
  });
}

function sourceUnavailableObservations(year, coverage = () => true, notCoveredReason = "not-covered-by-comparable-series", valueType = "historical") {
  return COUNTRY_IDS.map((country) =>
    nullObservation(country, year, coverage(country) ? "source-unavailable" : notCoveredReason, valueType)
  );
}

function measure(id, year, observations) {
  const descriptor = DESCRIPTORS.get(id);
  return buildComparisonMeasure({ id, definition: descriptor.definition, observationYear: year, observations });
}

function buildInternationalComparisonPublication(bundle, now = new Date()) {
  const oecdCoverage = (country) => OECD_IDS.has(country);
  const gdp2023 = bundle.gdpPerCapita2023;
  const gdp2024 = bundle.gdpPerCapita2024;
  const gdp2026 = bundle.gdpPerCapita2026;
  const population2025 = bundle.population2025;

  const measures = {
    governmentDebt: measure(
      "governmentDebt",
      2026,
      bundle.debtPctGdp2026 instanceof Map && gdp2026 instanceof Map
        ? percentGdpObservations(bundle.debtPctGdp2026, gdp2026, 2026, SOURCES.imfWEO2026, () => true, "publisher-reported-no-value", "projection")
        : sourceUnavailableObservations(2026, () => true, "publisher-reported-no-value", "projection")
    ),
    officialDevelopmentAssistance: measure(
      "officialDevelopmentAssistance",
      2025,
      bundle.odaUsd2025 instanceof Map && population2025 instanceof Map
        ? totalObservations(bundle.odaUsd2025, population2025, 2025, SOURCES.oecdOda2025, oecdCoverage, "not-covered-by-comparable-donor-series", "estimate")
        : sourceUnavailableObservations(2025, oecdCoverage, "not-covered-by-comparable-donor-series", "estimate")
    ),
    defenceSpending: measure(
      "defenceSpending",
      2025,
      bundle.defenceUsd2025 instanceof Map && population2025 instanceof Map
        ? totalObservations(bundle.defenceUsd2025, population2025, 2025, SOURCES.sipri2025, () => true, "publisher-reported-no-value", "estimate")
        : sourceUnavailableObservations(2025, () => true, "publisher-reported-no-value", "estimate")
    ),
    publicSocialExpenditure: measure(
      "publicSocialExpenditure",
      2023,
      bundle.socialPctGdp2023 instanceof Map && gdp2023 instanceof Map
        ? percentGdpObservations(bundle.socialPctGdp2023, gdp2023, 2023, withAdditionalSource(SOURCES.oecdSocx2023, SOURCES.worldBankGdpPerCapita2023), oecdCoverage, "not-covered-by-oecd-comparable-series")
        : sourceUnavailableObservations(2023, oecdCoverage, "not-covered-by-oecd-comparable-series")
    ),
    healthcareSpending: measure(
      "healthcareSpending",
      2024,
      bundle.healthPerCapita2024 instanceof Map
        ? directObservations(bundle.healthPerCapita2024, 2024, SOURCES.whoViaWorldBank2024)
        : sourceUnavailableObservations(2024)
    ),
    taxRevenue: measure(
      "taxRevenue",
      2024,
      bundle.taxPctGdp2024 instanceof Map && gdp2024 instanceof Map
        ? percentGdpObservations(bundle.taxPctGdp2024, gdp2024, 2024, withAdditionalSource(SOURCES.oecdTax2024, SOURCES.worldBankGdpPerCapita2024), oecdCoverage, "not-covered-by-oecd-comparable-series")
        : sourceUnavailableObservations(2024, oecdCoverage, "not-covered-by-oecd-comparable-series")
    ),
    debtInterest: measure(
      "debtInterest",
      2024,
      bundle.interestPctGdp2024 instanceof Map && gdp2024 instanceof Map
        ? percentGdpObservations(bundle.interestPctGdp2024, gdp2024, 2024, SOURCES.imfInterest2024)
        : sourceUnavailableObservations(2024)
    ),
  };

  if (bundle.defenceUsdByYear instanceof Map && bundle.populationByYear instanceof Map) {
    const years = [...bundle.defenceUsdByYear.keys()]
      .filter((year) => bundle.populationByYear.has(year) && Number.isInteger(year) && year >= 2015 && year <= 2025)
      .sort((left, right) => left - right);
    const countryHistory = years.flatMap((year) => {
      const defence = bundle.defenceUsdByYear.get(year);
      const population = bundle.populationByYear.get(year);
      if (!(defence instanceof Map) || !(population instanceof Map)) return [];
      const yearSource = {
        ...SOURCES.sipri2025,
        series: `SIPRI Military Expenditure Database: ${year} current USD divided by World Bank SP.POP.TOTL ${year} population`,
        additionalSources: [SOURCES.worldBankPopulationHistory],
      };
      return totalObservations(
        defence,
        population,
        year,
        yearSource,
        () => true,
        "publisher-reported-no-value",
        year === 2025 ? "estimate" : "historical",
      );
    });
    if (countryHistory.length) {
      const latest = measures.defenceSpending;
      measures.defenceSpending = buildComparisonMeasure({
        id: latest.id,
        definition: latest.definition,
        observationYear: latest.observationYear,
        observations: latest.countries,
        countryHistory,
      });
    }
  }

  for (const [id, item] of Object.entries(measures)) {
    item.lifecycle = lifecycleFor(id, item, now, bundle.sourceFailures ?? []);
  }

  return validateInternationalComparisonPublication({
    meta: {
      schemaVersion: COMPARISON_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      comparisonSetId: COMPARISON_SET_ID,
      countries: COUNTRY_IDS,
      sourceStatus: Object.fromEntries(
        Object.entries(measures).map(([id, item]) => [id, item.comparableCountryCount > 0 ? "available" : "unavailable"])
      ),
      sourceFailures: [...(bundle.sourceFailures ?? [])],
      attemptedSources: [...(bundle.attemptedSources ?? INTERNATIONAL_SOURCES)],
    },
    measures,
  });
}

async function settledMap(factory, label, failures) {
  try {
    return await factory();
  } catch (error) {
    failures.push(label);
    console.error("International comparison source unavailable", {
      source: label,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function collectInternationalComparison(fetchImpl = fetch, now = new Date(), options = {}) {
  const sourceFailures = [];
  const requested = options.sourceIds ? new Set(options.sourceIds) : new Set(INTERNATIONAL_SOURCES);
  const attempt = (id, factory) => requested.has(id)
    ? settledMap(factory, id, sourceFailures)
    : Promise.resolve(null);
  const [
    gdpPerCapita2023,
    gdpPerCapita2024,
    gdpPerCapita2026,
    populationByYear,
    debtPctGdp2026,
    interestPctGdp2024,
    odaUsd2025,
    defenceUsdByYear,
    socialPctGdp2023,
    healthPerCapita2024,
    taxPctGdp2024,
  ] = await Promise.all([
    attempt("world-bank-gdp-per-capita-2023", () => fetchWorldBankSeries("NY.GDP.PCAP.CD", 2023, fetchImpl)),
    attempt("world-bank-gdp-per-capita-2024", () => fetchWorldBankSeries("NY.GDP.PCAP.CD", 2024, fetchImpl)),
    attempt("imf-gdp-2026", () => fetchImfSeries("NGDPDPC", 2026, fetchImpl)),
    attempt("world-bank-population-2025", () => fetchWorldBankSeriesHistory("SP.POP.TOTL", 2015, 2025, fetchImpl)),
    attempt("imf-debt-2026", () => fetchImfSeries("GGXWDG_NGDP", 2026, fetchImpl)),
    attempt("imf-interest-2024", () => fetchImfSeries("ie", 2024, fetchImpl)),
    attempt("oecd-oda-2025", () => fetchOecdSeries(SOURCE_QUERIES.oecdOda2025, 2025, fetchImpl)),
    attempt("sipri-2025", () => fetchSipriCurrentUsdHistory(fetchImpl, 2015, 2025)),
    attempt("oecd-socx-2023", () => fetchOecdSeries(SOURCE_QUERIES.oecdSocx2023, 2023, fetchImpl)),
    attempt("world-bank-health-2024", () => fetchWorldBankSeries("SH.XPD.CHEX.PC.CD", 2024, fetchImpl)),
    attempt("oecd-tax-2024", () => fetchOecdSeries(SOURCE_QUERIES.oecdTax2024, 2024, fetchImpl)),
  ]);

  return buildInternationalComparisonPublication(
    comparisonSourceBundle({
      gdpPerCapita2023,
      gdpPerCapita2024,
      gdpPerCapita2026,
      populationByYear,
      population2025: populationByYear instanceof Map ? populationByYear.get(2025) ?? null : null,
      debtPctGdp2026,
      interestPctGdp2024,
      odaUsd2025,
      defenceUsdByYear,
      defenceUsd2025: defenceUsdByYear instanceof Map ? defenceUsdByYear.get(2025) ?? null : null,
      socialPctGdp2023,
      healthPerCapita2024,
      taxPctGdp2024,
      sourceFailures,
      attemptedSources: [...requested],
    }),
    now
  );
}

// --- Merged from international-comparison-store.js (STEP 1 simplification) ---
// This KV read/refresh layer previously lived in a separate file that only
// re-used collectInternationalComparison (defined here) and
// validateInternationalComparisonPublication (already imported here), so it is
// folded in to remove an indirection layer.

const INTERNATIONAL_COMPARISON_KEY = "v1:international-comparison:current";
const COMPARISON_REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function due(publication, now = new Date()) {
  const retryDue = Object.values(publication?.measures ?? {}).some((measure) => {
    const retryAt = Date.parse(String(measure?.lifecycle?.retryAfter ?? ""));
    return Number.isFinite(retryAt) && retryAt <= now.getTime();
  });
  if (retryDue) return true;
  const expiredValues = Object.values(publication?.measures ?? {}).some((measure) => {
    if (!(measure?.comparableCountryCount > 0)) return false;
    const validUntil = Date.parse(String(measure?.lifecycle?.validUntil ?? ""));
    return !Number.isFinite(validUntil) || validUntil <= now.getTime();
  });
  if (expiredValues) return true;
  const checkedAt = Date.parse(String(publication?.meta?.checkedAt ?? ""));
  return !Number.isFinite(checkedAt) || now.getTime() - checkedAt >= COMPARISON_REFRESH_MAX_AGE_MS;
}

function sourcesDue(publication, now = new Date()) {
  const checkedAt = Date.parse(String(publication?.meta?.checkedAt ?? ""));
  if (!Number.isFinite(checkedAt) || now.getTime() - checkedAt >= COMPARISON_REFRESH_MAX_AGE_MS) {
    return [...INTERNATIONAL_SOURCES];
  }
  const dueSources = new Set();
  for (const [id, measure] of Object.entries(publication?.measures ?? {})) {
    const retryAt = Date.parse(String(measure?.lifecycle?.retryAfter ?? ""));
    const validUntil = Date.parse(String(measure?.lifecycle?.validUntil ?? ""));
    const hasExpiredValues = measure?.comparableCountryCount > 0 &&
      (!Number.isFinite(validUntil) || validUntil <= now.getTime());
    if (hasExpiredValues || (Number.isFinite(retryAt) && retryAt <= now.getTime())) {
      for (const source of MEASURE_SOURCE_DEPENDENCIES[id] ?? []) dueSources.add(source);
    }
  }
  return [...dueSources];
}

async function readInternationalComparison(env, now = new Date()) {
  if (!env?.METRICS_CACHE?.get) return null;
  const candidate = await env.METRICS_CACHE.get(INTERNATIONAL_COMPARISON_KEY, "json");
  if (!candidate) return null;
  try {
    const publication = validateInternationalComparisonPublication(candidate);
    const measures = { ...publication.measures };
    let redacted = false;
    for (const [id, measure] of Object.entries(measures)) {
      const validUntil = Date.parse(String(measure.lifecycle?.validUntil ?? ""));
      const current = Number.isFinite(validUntil) && validUntil > now.getTime() &&
        measure.lifecycle?.status !== "unavailable";
      if (current || measure.comparableCountryCount === 0) continue;
      redacted = true;
      const observations = measure.countries.map((observation) => ({
        ...observation,
        value: null,
        rank: null,
        source: observation.source ?? null,
        exclusionReason: "source-validity-expired",
      }));
      measures[id] = {
        ...buildComparisonMeasure({
          id,
          definition: measure.definition,
          observationYear: measure.observationYear,
          observations,
        }),
        lifecycle: {
          ...(measure.lifecycle ?? {}),
          sourceEditionId: measure.lifecycle?.sourceEditionId ?? null,
          validUntil: null,
          lastSuccessAt: measure.lifecycle?.lastSuccessAt ?? null,
          retryAfter: measure.lifecycle?.retryAfter &&
            Number.isFinite(Date.parse(measure.lifecycle.retryAfter)) &&
            Date.parse(measure.lifecycle.retryAfter) > now.getTime()
            ? measure.lifecycle.retryAfter
            : now.toISOString(),
          status: "unavailable",
        },
      };
    }
    const meta = {
      ...publication.meta,
      ...(redacted || publication.meta.sourceStatus
        ? {
            sourceStatus: Object.fromEntries(Object.entries(measures).map(([id, measure]) => [
              id,
              measure.comparableCountryCount > 0 ? "available" : "unavailable",
            ])),
          }
        : {}),
    };
    return validateInternationalComparisonPublication({
      ...publication,
      measures,
      meta,
    });
  } catch {
    return null;
  }
}

async function refreshInternationalComparison(env, options = {}) {
  if (!env?.METRICS_CACHE?.put) throw new Error("METRICS_CACHE KV binding is required");
  const now = options.now ?? new Date();
  const current = Object.prototype.hasOwnProperty.call(options, "currentPublication")
    ? options.currentPublication
    : await readInternationalComparison(env, now);
  if (!options.force && current && !due(current, now)) {
    return { updated: false, reason: "not-due", publication: current };
  }

  const collect = options.collect ?? collectInternationalComparison;
  const selectedSources = options.sourceIds ??
    (current && !options.force ? sourcesDue(current, now) : [...INTERNATIONAL_SOURCES]);
  const candidate = await collect(options.fetchImpl ?? fetch, now, { sourceIds: selectedSources });
  const candidatePublication = validateInternationalComparisonPublication(candidate);
  const mergedMeasures = { ...candidatePublication.measures };
  for (const [id, dependencies] of Object.entries(MEASURE_SOURCE_DEPENDENCIES)) {
    const attempted = candidatePublication.meta.attemptedSources ?? INTERNATIONAL_SOURCES;
    const measureAttempted = dependencies.filter((source) => attempted.includes(source));
    const previous = current?.measures?.[id];
    if (measureAttempted.length === 0) {
      if (previous) mergedMeasures[id] = previous;
      continue;
    }
    const failed = dependencies.some((source) => (candidatePublication.meta.sourceFailures ?? []).includes(source));
    const allDependenciesAttempted = dependencies.every((source) => attempted.includes(source));
    if (!allDependenciesAttempted && !failed) {
      if (previous) mergedMeasures[id] = previous;
      continue;
    }
    if (!failed && allDependenciesAttempted) {
      const previousEdition = previous?.lifecycle?.sourceEditionId;
      const candidateEdition = candidatePublication.measures[id].lifecycle?.sourceEditionId;
      if (previous && previousEdition && previousEdition === candidateEdition) {
        mergedMeasures[id] = {
          ...candidatePublication.measures[id],
          lifecycle: {
            ...candidatePublication.measures[id].lifecycle,
            validUntil: previous.lifecycle.validUntil,
            lastSuccessAt: previous.lifecycle.lastSuccessAt,
            retryAfter: null,
            status: previous.lifecycle.status,
          },
        };
      }
      continue;
    }
    const validUntil = Date.parse(String(previous?.lifecycle?.validUntil ?? ""));
    const lifecycle = candidatePublication.measures[id].lifecycle;
    if (previous && Number.isFinite(validUntil) && validUntil > now.getTime()) {
      mergedMeasures[id] = {
        ...previous,
        lifecycle: {
          ...previous.lifecycle,
          retryAfter: lifecycle?.retryAfter ?? now.toISOString(),
        },
      };
    } else {
      mergedMeasures[id] = {
        ...candidatePublication.measures[id],
        lifecycle: {
          ...(lifecycle ?? {}),
          sourceEditionId: previous?.lifecycle?.sourceEditionId ?? null,
          validUntil: null,
          lastSuccessAt: previous?.lifecycle?.lastSuccessAt ?? null,
          retryAfter: lifecycle?.retryAfter ?? now.toISOString(),
          status: "unavailable",
        },
      };
    }
  }
  const publication = validateInternationalComparisonPublication({
    ...candidatePublication,
    measures: mergedMeasures,
    meta: {
      ...candidatePublication.meta,
      checkedAt: now.toISOString(),
      sourceStatus: Object.fromEntries(Object.entries(mergedMeasures).map(([id, item]) => [
        id,
        item.comparableCountryCount > 0 ? "available" : "unavailable",
      ])),
    },
  });
  const availableMeasureCount = Object.values(publication.measures).filter(
    (measure) => measure.comparableCountryCount > 0
  ).length;
  if (options.publish !== false) {
    await env.METRICS_CACHE.put(
      INTERNATIONAL_COMPARISON_KEY,
      JSON.stringify(publication)
    );
  }
  return {
    updated: true,
    reason: current ? "refreshed" : "published",
    publication,
    availableMeasureCount,
  };
}

function mergeInternationalComparisonBatchResults(basePublication, batchResults, now = new Date()) {
  const measures = { ...basePublication.measures };
  const attemptedSources = new Set();
  const sourceFailures = new Set(basePublication.meta.sourceFailures ?? []);
  const generatedAtValues = [basePublication.meta.generatedAt];
  const checkedAtValues = [basePublication.meta.checkedAt];

  for (const result of batchResults) {
    const batch = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === result?.batchId);
    if (!batch || !result?.measures || !result?.meta) {
      throw new Error("International comparison batch result is invalid");
    }
    const attemptedInBatch = Array.isArray(result.meta.attemptedSources)
      ? result.meta.attemptedSources.filter((sourceId) => batch.sourceIds.includes(sourceId))
      : batch.sourceIds;
    for (const sourceId of attemptedInBatch) {
      attemptedSources.add(sourceId);
      sourceFailures.delete(sourceId);
    }
    for (const sourceId of result.meta.sourceFailures ?? []) {
      if (batch.sourceIds.includes(sourceId)) sourceFailures.add(sourceId);
    }
    if (typeof result.meta.generatedAt === "string") generatedAtValues.push(result.meta.generatedAt);
    if (typeof result.meta.checkedAt === "string") checkedAtValues.push(result.meta.checkedAt);

    for (const measureId of batch.measureIds) {
      const candidate = result.measures[measureId];
      if (!candidate) throw new Error(`International comparison batch '${batch.id}' omitted '${measureId}'`);
      const previous = measures[measureId];
      const previousSuccessAt = Date.parse(String(previous?.lifecycle?.lastSuccessAt ?? ""));
      const candidateSuccessAt = Date.parse(String(candidate.lifecycle?.lastSuccessAt ?? ""));
      if (Number.isFinite(previousSuccessAt) && previousSuccessAt > candidateSuccessAt) continue;
      measures[measureId] = candidate;
    }
  }

  const latestTimestamp = (values) => values
    .map((value) => ({ value, timestamp: Date.parse(String(value ?? "")) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp))
    .sort((left, right) => right.timestamp - left.timestamp)[0]?.value ?? now.toISOString();

  return validateInternationalComparisonPublication({
    ...basePublication,
    meta: {
      ...basePublication.meta,
      generatedAt: latestTimestamp(generatedAtValues),
      checkedAt: latestTimestamp(checkedAtValues),
      attemptedSources: [...attemptedSources].sort(),
      sourceFailures: [...sourceFailures].sort(),
      sourceStatus: Object.fromEntries(Object.entries(measures).map(([id, measure]) => [
        id,
        measure.comparableCountryCount > 0 ? "available" : "unavailable",
      ])),
    },
    measures,
  });
}

export {
  COMPARISON_REFRESH_MAX_AGE_MS,
  INTERNATIONAL_COMPARISON_KEY,
  SOURCES,
  COMPARISON_VALIDITY_MS,
  INTERNATIONAL_SOURCES,
  INTERNATIONAL_COMPARISON_REFRESH_BATCHES,
  buildInternationalComparisonPublication,
  collectInternationalComparison,
  comparisonSourceBundle,
  due,
  sourcesDue,
  readInternationalComparison,
  refreshInternationalComparison,
  mergeInternationalComparisonBatchResults,
};
