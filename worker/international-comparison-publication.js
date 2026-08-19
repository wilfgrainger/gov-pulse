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
    series: "DAC1: ODA grant equivalent, current USD (2025 preliminary)",
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

  return validateInternationalComparisonPublication({
    meta: {
      schemaVersion: COMPARISON_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      comparisonSetId: COMPARISON_SET_ID,
      countries: COUNTRY_IDS,
      sourceStatus: Object.fromEntries(
        Object.entries(measures).map(([id, item]) => [id, item.comparableCountryCount > 0 ? "available" : "unavailable"])
      ),
    },
    measures,
  });
}

async function settledMap(factory) {
  try {
    return await factory();
  } catch {
    return null;
  }
}

async function collectInternationalComparison(fetchImpl = fetch, now = new Date()) {
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
    settledMap(() => fetchImfSeries("NGDPDPC", 2023, fetchImpl)),
    settledMap(() => fetchImfSeries("NGDPDPC", 2024, fetchImpl)),
    settledMap(() => fetchImfSeries("NGDPDPC", 2026, fetchImpl)),
    settledMap(() => fetchWorldBankSeries("SP.POP.TOTL", 2025, fetchImpl)),
    settledMap(() => fetchImfSeries("GGXWDG_NGDP", 2026, fetchImpl)),
    settledMap(() => fetchImfSeries("ie@FPP", 2024, fetchImpl)),
    settledMap(() => fetchOecdSeries(SOURCE_QUERIES.oecdOda2025, 2025, fetchImpl)),
    settledMap(() => fetchSipri2025Series(fetchImpl)),
    settledMap(() => fetchOecdSeries(SOURCE_QUERIES.oecdSocx2023, 2023, fetchImpl)),
    settledMap(() => fetchWorldBankSeries("SH.XPD.CHEX.PC.CD", 2024, fetchImpl)),
    settledMap(() => fetchOecdSeries(SOURCE_QUERIES.oecdTax2024, 2024, fetchImpl)),
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
    }),
    now
  );
}

export {
  SOURCES,
  buildInternationalComparisonPublication,
  collectInternationalComparison,
  comparisonSourceBundle,
};
