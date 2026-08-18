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
  fetchWorldBankSeries,
} from "./international-comparison-sources.js";

const COUNTRY_IDS = COMPARISON_COUNTRIES.map(({ id }) => id);
const OECD_IDS = new Set(OECD_COMPARABLE_IDS);
const DESCRIPTORS = new Map(COMPARISON_MEASURES.map((measure) => [measure.id, measure]));

const SOURCES = Object.freeze({
  imfWEO2024: Object.freeze({
    publisher: "International Monetary Fund",
    url: SOURCE_QUERIES.imfGdpPerCapita2024,
    series: "World Economic Outlook April 2026: NGDPDPC and GGXWDG_NGDP",
  }),
  imfInterest2024: Object.freeze({
    publisher: "International Monetary Fund",
    url: SOURCE_QUERIES.imfInterestPctGdp2024,
    series: "Public Finances in Modern History: interest paid (% GDP)",
  }),
  oecdOda2024: Object.freeze({
    publisher: "OECD",
    url: SOURCE_QUERIES.oecdOda2024,
    series: "DAC2A: ODA disbursements, current USD",
  }),
  oecdSocx2022: Object.freeze({
    publisher: "OECD",
    url: SOURCE_QUERIES.oecdSocx2022,
    series: "SOCX: public social expenditure, % GDP",
  }),
  oecdTax2024: Object.freeze({
    publisher: "OECD",
    url: SOURCE_QUERIES.oecdTax2024,
    series: "Revenue Statistics: total general-government tax revenue, % GDP",
  }),
  sipriViaWorldBank2024: Object.freeze({
    publisher: "SIPRI via World Bank WDI",
    url: SOURCE_QUERIES.worldBankDefence2024,
    series: "MS.MIL.XPND.CD",
  }),
  whoViaWorldBank2024: Object.freeze({
    publisher: "WHO Global Health Expenditure Database via World Bank WDI",
    url: SOURCE_QUERIES.worldBankHealth2024,
    series: "SH.XPD.CHEX.PC.CD",
  }),
});

function comparisonSourceBundle(values = {}) {
  return {
    gdpPerCapita2024: values.gdpPerCapita2024 ?? null,
    gdpPerCapita2022: values.gdpPerCapita2022 ?? null,
    population2024: values.population2024 ?? null,
    debtPctGdp2024: values.debtPctGdp2024 ?? null,
    interestPctGdp2024: values.interestPctGdp2024 ?? null,
    odaUsd2024: values.odaUsd2024 ?? null,
    defenceUsd2024: values.defenceUsd2024 ?? null,
    socialPctGdp2022: values.socialPctGdp2022 ?? null,
    healthPerCapita2024: values.healthPerCapita2024 ?? null,
    taxPctGdp2024: values.taxPctGdp2024 ?? null,
  };
}

function value(map, country) {
  if (!(map instanceof Map)) return null;
  const candidate = map.get(country);
  return Number.isFinite(candidate) ? candidate : null;
}

function nullObservation(country, year, exclusionReason) {
  return {
    country,
    value: null,
    rank: null,
    observationYear: year,
    valueType: "historical",
    source: null,
    exclusionReason,
  };
}

function directObservations(map, year, source, coverage = () => true, notCoveredReason = "publisher-reported-no-value") {
  return COUNTRY_IDS.map((country) => {
    if (!coverage(country)) return nullObservation(country, year, notCoveredReason);
    const direct = value(map, country);
    if (direct === null) return nullObservation(country, year, "publisher-reported-no-value");
    return {
      country,
      value: direct,
      observationYear: year,
      valueType: "historical",
      source,
    };
  });
}

function percentGdpObservations(percentMap, gdpMap, year, source, coverage = () => true, notCoveredReason = "publisher-reported-no-value") {
  return COUNTRY_IDS.map((country) => {
    if (!coverage(country)) return nullObservation(country, year, notCoveredReason);
    const percentGdp = value(percentMap, country);
    const gdpPerResidentUsd = value(gdpMap, country);
    if (percentGdp === null || gdpPerResidentUsd === null) {
      return nullObservation(country, year, "publisher-reported-no-value");
    }
    return {
      country,
      value: calculatePerResidentFromPercentGdp(percentGdp, gdpPerResidentUsd),
      observationYear: year,
      valueType: "historical",
      source,
      calculationInputs: { percentGdp, gdpPerResidentUsd },
    };
  });
}

function totalObservations(totalMap, populationMap, year, source, coverage = () => true, notCoveredReason = "publisher-reported-no-value") {
  return COUNTRY_IDS.map((country) => {
    if (!coverage(country)) return nullObservation(country, year, notCoveredReason);
    const totalUsd = value(totalMap, country);
    const population = value(populationMap, country);
    if (totalUsd === null || population === null) {
      return nullObservation(country, year, "publisher-reported-no-value");
    }
    return {
      country,
      value: calculatePerResidentFromTotal(totalUsd, population),
      observationYear: year,
      valueType: "historical",
      source,
      calculationInputs: { totalUsd, population },
    };
  });
}

function sourceUnavailableObservations(year, coverage = () => true, notCoveredReason = "not-covered-by-comparable-series") {
  return COUNTRY_IDS.map((country) =>
    nullObservation(
      country,
      year,
      coverage(country) ? "source-unavailable" : notCoveredReason
    )
  );
}

function measure(id, year, observations) {
  const descriptor = DESCRIPTORS.get(id);
  return buildComparisonMeasure({
    id,
    definition: descriptor.definition,
    observationYear: year,
    observations,
  });
}

function buildInternationalComparisonPublication(bundle, now = new Date()) {
  const oecdCoverage = (country) => OECD_IDS.has(country);
  const gdp2024 = bundle.gdpPerCapita2024;
  const gdp2022 = bundle.gdpPerCapita2022;
  const population = bundle.population2024;

  const measures = {
    governmentDebt: measure(
      "governmentDebt",
      2024,
      bundle.debtPctGdp2024 instanceof Map && gdp2024 instanceof Map
        ? percentGdpObservations(bundle.debtPctGdp2024, gdp2024, 2024, SOURCES.imfWEO2024)
        : sourceUnavailableObservations(2024)
    ),
    officialDevelopmentAssistance: measure(
      "officialDevelopmentAssistance",
      2024,
      bundle.odaUsd2024 instanceof Map && population instanceof Map
        ? totalObservations(
            bundle.odaUsd2024,
            population,
            2024,
            SOURCES.oecdOda2024,
            oecdCoverage,
            "not-covered-by-comparable-donor-series"
          )
        : sourceUnavailableObservations(2024, oecdCoverage, "not-covered-by-comparable-donor-series")
    ),
    defenceSpending: measure(
      "defenceSpending",
      2024,
      bundle.defenceUsd2024 instanceof Map && population instanceof Map
        ? totalObservations(bundle.defenceUsd2024, population, 2024, SOURCES.sipriViaWorldBank2024)
        : sourceUnavailableObservations(2024)
    ),
    publicSocialExpenditure: measure(
      "publicSocialExpenditure",
      2022,
      bundle.socialPctGdp2022 instanceof Map && gdp2022 instanceof Map
        ? percentGdpObservations(
            bundle.socialPctGdp2022,
            gdp2022,
            2022,
            SOURCES.oecdSocx2022,
            oecdCoverage,
            "not-covered-by-oecd-comparable-series"
          )
        : sourceUnavailableObservations(2022, oecdCoverage, "not-covered-by-oecd-comparable-series")
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
        ? percentGdpObservations(
            bundle.taxPctGdp2024,
            gdp2024,
            2024,
            SOURCES.oecdTax2024,
            oecdCoverage,
            "not-covered-by-oecd-comparable-series"
          )
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
        Object.entries(measures).map(([id, item]) => [
          id,
          item.comparableCountryCount > 0 ? "available" : "unavailable",
        ])
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
    gdpPerCapita2024,
    gdpPerCapita2022,
    population2024,
    debtPctGdp2024,
    interestPctGdp2024,
    odaUsd2024,
    defenceUsd2024,
    socialPctGdp2022,
    healthPerCapita2024,
    taxPctGdp2024,
  ] = await Promise.all([
    settledMap(() => fetchImfSeries("NGDPDPC", 2024, fetchImpl)),
    settledMap(() => fetchImfSeries("NGDPDPC", 2022, fetchImpl)),
    settledMap(() => fetchWorldBankSeries("SP.POP.TOTL", 2024, fetchImpl)),
    settledMap(() => fetchImfSeries("GGXWDG_NGDP", 2024, fetchImpl)),
    settledMap(() => fetchImfSeries("ie@FPP", 2024, fetchImpl)),
    settledMap(() => fetchOecdSeries(SOURCE_QUERIES.oecdOda2024, 2024, fetchImpl)),
    settledMap(() => fetchWorldBankSeries("MS.MIL.XPND.CD", 2024, fetchImpl)),
    settledMap(() => fetchOecdSeries(SOURCE_QUERIES.oecdSocx2022, 2022, fetchImpl)),
    settledMap(() => fetchWorldBankSeries("SH.XPD.CHEX.PC.CD", 2024, fetchImpl)),
    settledMap(() => fetchOecdSeries(SOURCE_QUERIES.oecdTax2024, 2024, fetchImpl)),
  ]);

  return buildInternationalComparisonPublication(
    comparisonSourceBundle({
      gdpPerCapita2024,
      gdpPerCapita2022,
      population2024,
      debtPctGdp2024,
      interestPctGdp2024,
      odaUsd2024,
      defenceUsd2024,
      socialPctGdp2022,
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
