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
  fetchSipri2025Series,
  fetchWorldBankSeries,
} from "./international-comparison-sources.js";

const COUNTRY_IDS = COMPARISON_COUNTRIES.map(({ id }) => id);
const OECD_IDS = new Set(OECD_COMPARABLE_IDS);
const DESCRIPTORS = new Map(COMPARISON_MEASURES.map((measure) => [measure.id, measure]));
const MEASURE_SOURCE_DEPENDENCIES = Object.freeze({
  governmentDebt: ["imf-gdp-2026", "imf-debt-2026"],
  officialDevelopmentAssistance: ["world-bank-population-2025", "oecd-oda-2025"],
  defenceSpending: ["world-bank-population-2025", "sipri-2025"],
  publicSocialExpenditure: ["imf-gdp-2023", "oecd-socx-2023"],
  healthcareSpending: ["world-bank-health-2024"],
  taxRevenue: ["imf-gdp-2024", "oecd-tax-2024"],
  debtInterest: ["imf-gdp-2024", "imf-interest-2024"],
});
const INTERNATIONAL_SOURCES = Object.freeze([
  "imf-gdp-2023",
  "imf-gdp-2024",
  "imf-gdp-2026",
  "world-bank-population-2025",
  "imf-debt-2026",
  "imf-interest-2024",
  "oecd-oda-2025",
  "sipri-2025",
  "oecd-socx-2023",
  "world-bank-health-2024",
  "oecd-tax-2024",
]);
const COMPARISON_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

const SOURCES = Object.freeze({
  imfWEO2026: Object.freeze({
    publisher: "International Monetary Fund",
    url: SOURCE_QUERIES.imfDebtPctGdp2026,
    series: "World Economic Outlook April 2026: 2026 NGDPDPC and GGXWDG_NGDP projections",
  }),
  imfInterest2024: Object.freeze({
    publisher: "International Monetary Fund",
    url: SOURCE_QUERIES.imfInterestPctGdp2024,
    series: "Public Finances in Modern History: interest paid (% GDP)",
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
  sipri2025: Object.freeze({
    publisher: "SIPRI",
    url: SOURCE_QUERIES.sipriMilitary2025,
    series: "SIPRI Military Expenditure Database: 2025 current USD",
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
  const sourceEdition = comparisonMeasure.countries.map(({ country, value, source }) => [
    country,
    value,
    source?.url ?? null,
    source?.series ?? null,
  ]);
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
        ? percentGdpObservations(bundle.socialPctGdp2023, gdp2023, 2023, SOURCES.oecdSocx2023, oecdCoverage, "not-covered-by-oecd-comparable-series")
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
        ? percentGdpObservations(bundle.taxPctGdp2024, gdp2024, 2024, SOURCES.oecdTax2024, oecdCoverage, "not-covered-by-oecd-comparable-series")
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
    population2025,
    debtPctGdp2026,
    interestPctGdp2024,
    odaUsd2025,
    defenceUsd2025,
    socialPctGdp2023,
    healthPerCapita2024,
    taxPctGdp2024,
  ] = await Promise.all([
    attempt("imf-gdp-2023", () => fetchImfSeries("NGDPDPC", 2023, fetchImpl)),
    attempt("imf-gdp-2024", () => fetchImfSeries("NGDPDPC", 2024, fetchImpl)),
    attempt("imf-gdp-2026", () => fetchImfSeries("NGDPDPC", 2026, fetchImpl)),
    attempt("world-bank-population-2025", () => fetchWorldBankSeries("SP.POP.TOTL", 2025, fetchImpl)),
    attempt("imf-debt-2026", () => fetchImfSeries("GGXWDG_NGDP", 2026, fetchImpl)),
    attempt("imf-interest-2024", () => fetchImfSeries("ie", 2024, fetchImpl)),
    attempt("oecd-oda-2025", () => fetchOecdSeries(SOURCE_QUERIES.oecdOda2025, 2025, fetchImpl)),
    attempt("sipri-2025", () => fetchSipri2025Series(fetchImpl)),
    attempt("oecd-socx-2023", () => fetchOecdSeries(SOURCE_QUERIES.oecdSocx2023, 2023, fetchImpl)),
    attempt("world-bank-health-2024", () => fetchWorldBankSeries("SH.XPD.CHEX.PC.CD", 2024, fetchImpl)),
    attempt("oecd-tax-2024", () => fetchOecdSeries(SOURCE_QUERIES.oecdTax2024, 2024, fetchImpl)),
  ]);

  return buildInternationalComparisonPublication(
    comparisonSourceBundle({
      gdpPerCapita2023,
      gdpPerCapita2024,
      gdpPerCapita2026,
      population2025,
      debtPctGdp2026,
      interestPctGdp2024,
      odaUsd2025,
      defenceUsd2025,
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
  const current = await readInternationalComparison(env, now);
  if (!options.force && current && !due(current, now)) {
    return { updated: false, reason: "not-due", publication: current };
  }

  const collect = options.collect ?? collectInternationalComparison;
  const selectedSources = current && !options.force ? sourcesDue(current, now) : [...INTERNATIONAL_SOURCES];
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
  await env.METRICS_CACHE.put(
    INTERNATIONAL_COMPARISON_KEY,
    JSON.stringify(publication)
  );
  return {
    updated: true,
    reason: current ? "refreshed" : "published",
    publication,
    availableMeasureCount,
  };
}

export {
  COMPARISON_REFRESH_MAX_AGE_MS,
  INTERNATIONAL_COMPARISON_KEY,
  SOURCES,
  COMPARISON_VALIDITY_MS,
  INTERNATIONAL_SOURCES,
  buildInternationalComparisonPublication,
  collectInternationalComparison,
  comparisonSourceBundle,
  due,
  sourcesDue,
  readInternationalComparison,
  refreshInternationalComparison,
};
