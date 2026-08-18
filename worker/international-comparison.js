const COMPARISON_SET_ID = "uk-context-13-v1";
const COMPARISON_SCHEMA_VERSION = 1;
const UNIT_USD_PER_RESIDENT = "USD per resident";

const COMPARISON_COUNTRIES = Object.freeze([
  Object.freeze({ id: "GBR", name: "United Kingdom" }),
  Object.freeze({ id: "USA", name: "United States" }),
  Object.freeze({ id: "CHN", name: "China" }),
  Object.freeze({ id: "RUS", name: "Russia" }),
  Object.freeze({ id: "UKR", name: "Ukraine" }),
  Object.freeze({ id: "DEU", name: "Germany" }),
  Object.freeze({ id: "FRA", name: "France" }),
  Object.freeze({ id: "ITA", name: "Italy" }),
  Object.freeze({ id: "ESP", name: "Spain" }),
  Object.freeze({ id: "TUR", name: "Türkiye" }),
  Object.freeze({ id: "NLD", name: "Netherlands" }),
  Object.freeze({ id: "CHE", name: "Switzerland" }),
  Object.freeze({ id: "POL", name: "Poland" }),
]);

const COMPARISON_MEASURES = Object.freeze([
  Object.freeze({
    id: "governmentDebt",
    label: "Government debt outstanding",
    definition: "General-government gross debt expressed in current US dollars per resident.",
    unit: UNIT_USD_PER_RESIDENT,
    rankDirection: "highest-first",
  }),
  Object.freeze({
    id: "officialDevelopmentAssistance",
    label: "Foreign / overseas aid",
    definition: "Official development assistance supplied by comparable providers, expressed in current US dollars per resident.",
    unit: UNIT_USD_PER_RESIDENT,
    rankDirection: "highest-first",
  }),
  Object.freeze({
    id: "defenceSpending",
    label: "Defence spending",
    definition: "Military expenditure expressed in current US dollars per resident.",
    unit: UNIT_USD_PER_RESIDENT,
    rankDirection: "highest-first",
  }),
  Object.freeze({
    id: "publicSocialExpenditure",
    label: "Public social / welfare spending",
    definition: "Public social expenditure expressed in current US dollars per resident.",
    unit: UNIT_USD_PER_RESIDENT,
    rankDirection: "highest-first",
    caveat: "Public social expenditure includes areas such as pensions, health, family support and unemployment programmes, so it overlaps conceptually with healthcare expenditure and must not be added to it as a non-overlapping category.",
  }),
  Object.freeze({
    id: "healthcareSpending",
    label: "Total healthcare spending",
    definition: "Current health expenditure, public plus private, expressed in current US dollars per resident.",
    unit: UNIT_USD_PER_RESIDENT,
    rankDirection: "highest-first",
    caveat: "This is total current health expenditure, not NHS spending or government-only health expenditure.",
  }),
  Object.freeze({
    id: "taxRevenue",
    label: "Tax collected",
    definition: "Economy-wide general-government tax revenue expressed in current US dollars per resident.",
    unit: UNIT_USD_PER_RESIDENT,
    rankDirection: "highest-first",
    caveat: "This is total tax revenue divided by population, not the tax bill of an average individual.",
  }),
  Object.freeze({
    id: "debtInterest",
    label: "Debt interest",
    definition: "Interest paid on public debt expressed in current US dollars per resident.",
    unit: UNIT_USD_PER_RESIDENT,
    rankDirection: "highest-first",
  }),
]);

const COUNTRY_IDS = new Set(COMPARISON_COUNTRIES.map(({ id }) => id));
const MEASURE_BY_ID = new Map(COMPARISON_MEASURES.map((measure) => [measure.id, measure]));
const VALUE_TYPES = new Set(["historical", "estimate", "projection"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validateSource(source) {
  if (!isRecord(source)) throw new Error("Comparison value source is required");
  if (typeof source.publisher !== "string" || !source.publisher.trim()) {
    throw new Error("Comparison value source publisher is required");
  }
  if (!validHttpsUrl(source.url)) {
    throw new Error("Comparison value source URL must be HTTPS");
  }
  if (typeof source.series !== "string" || !source.series.trim()) {
    throw new Error("Comparison value source series is required");
  }
  if (
    source.publicationDate !== undefined &&
    (typeof source.publicationDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(source.publicationDate))
  ) {
    throw new Error("Comparison value source publicationDate must be YYYY-MM-DD");
  }
  return source;
}

function validateObservation(observation) {
  if (!isRecord(observation) || !COUNTRY_IDS.has(observation.country)) {
    throw new Error("Comparison observation country must belong to the fixed comparison set");
  }
  if (!Number.isInteger(observation.observationYear)) {
    throw new Error("Comparison observation observationYear is required");
  }
  if (!VALUE_TYPES.has(observation.valueType)) {
    throw new Error("Comparison observation valueType must be historical, estimate or projection");
  }

  if (observation.value === null) {
    if (observation.source !== null && observation.source !== undefined) {
      validateSource(observation.source);
    }
    if (typeof observation.exclusionReason !== "string" || !observation.exclusionReason.trim()) {
      throw new Error("Unavailable comparison observations require an exclusionReason");
    }
    return observation;
  }

  if (!Number.isFinite(observation.value) || observation.value < 0) {
    throw new Error("Comparison observation value must be a non-negative finite number or null");
  }
  validateSource(observation.source);
  return observation;
}

function rankComparisonObservations(observations) {
  if (!Array.isArray(observations)) {
    throw new Error("Comparison observations must be an array");
  }

  const seen = new Set();
  const validated = observations.map((observation) => {
    if (!isRecord(observation) || !COUNTRY_IDS.has(observation.country)) {
      throw new Error("Comparison observation country must belong to the fixed comparison set");
    }
    if (seen.has(observation.country)) {
      throw new Error(`Duplicate comparison observation for ${observation.country}`);
    }
    seen.add(observation.country);
    if (observation.value !== null && !Number.isFinite(observation.value)) {
      throw new Error("Comparison observation value must be finite or null");
    }
    return { ...observation, rank: null };
  });

  const comparable = validated
    .filter((observation) => observation.value !== null)
    .sort((left, right) => right.value - left.value || left.country.localeCompare(right.country));

  let previousValue = null;
  let previousRank = 0;
  for (const [index, observation] of comparable.entries()) {
    const rank = previousValue !== null && observation.value === previousValue
      ? previousRank
      : index + 1;
    observation.rank = rank;
    previousValue = observation.value;
    previousRank = rank;
  }

  const byCountry = new Map(comparable.map((observation) => [observation.country, observation]));
  return validated.map((observation) => byCountry.get(observation.country) ?? observation);
}

function buildComparisonMeasure({ id, definition, observationYear, observations }) {
  const descriptor = MEASURE_BY_ID.get(id);
  if (!descriptor) throw new Error(`Unknown comparison measure '${id}'`);
  if (typeof definition !== "string" || !definition.trim()) {
    throw new Error("Comparison measure definition is required");
  }
  if (!Number.isInteger(observationYear)) {
    throw new Error("Comparison measure observationYear is required");
  }
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error("Comparison measure observations are required");
  }

  const validated = observations.map((observation) => validateObservation({ ...observation }));
  const ranked = rankComparisonObservations(validated);
  return {
    id,
    label: descriptor.label,
    definition: definition.trim(),
    unit: descriptor.unit,
    rankDirection: descriptor.rankDirection,
    observationYear,
    comparableCountryCount: ranked.filter(({ value }) => value !== null).length,
    ...(descriptor.caveat ? { caveat: descriptor.caveat } : {}),
    countries: ranked,
  };
}

function validateInternationalComparisonPublication(publication) {
  if (!isRecord(publication) || !isRecord(publication.meta) || !isRecord(publication.measures)) {
    throw new Error("International comparison publication is invalid");
  }
  if (publication.overallScore !== undefined || publication.meta.overallScore !== undefined) {
    throw new Error("International comparison publication must not contain an overallScore");
  }
  if (publication.meta.schemaVersion !== COMPARISON_SCHEMA_VERSION) {
    throw new Error("International comparison schema version is invalid");
  }
  if (publication.meta.comparisonSetId !== COMPARISON_SET_ID) {
    throw new Error("International comparison set is invalid");
  }
  if (!Number.isFinite(Date.parse(publication.meta.generatedAt))) {
    throw new Error("International comparison generatedAt is invalid");
  }
  const expectedCountries = COMPARISON_COUNTRIES.map(({ id }) => id);
  if (JSON.stringify(publication.meta.countries) !== JSON.stringify(expectedCountries)) {
    throw new Error("International comparison country universe is invalid");
  }

  const expectedMeasureIds = COMPARISON_MEASURES.map(({ id }) => id);
  if (JSON.stringify(Object.keys(publication.measures).sort()) !== JSON.stringify([...expectedMeasureIds].sort())) {
    throw new Error("International comparison measures are incomplete");
  }

  for (const id of expectedMeasureIds) {
    const measure = publication.measures[id];
    if (!isRecord(measure) || measure.id !== id || measure.unit !== UNIT_USD_PER_RESIDENT) {
      throw new Error(`International comparison measure '${id}' is invalid`);
    }
    if (!Array.isArray(measure.countries)) {
      throw new Error(`International comparison measure '${id}' has no country observations`);
    }
    const measureCountries = measure.countries.map(({ country }) => country);
    if (JSON.stringify([...measureCountries].sort()) !== JSON.stringify([...expectedCountries].sort())) {
      throw new Error(`International comparison measure '${id}' does not cover the fixed country universe`);
    }
    for (const observation of measure.countries) validateObservation(observation);
    const ranked = rankComparisonObservations(measure.countries);
    const expectedRanks = new Map(ranked.map(({ country, rank }) => [country, rank]));
    for (const observation of measure.countries) {
      if ((observation.rank ?? null) !== expectedRanks.get(observation.country)) {
        throw new Error(`International comparison measure '${id}' contains an invalid rank`);
      }
    }
    if (measure.comparableCountryCount !== measure.countries.filter(({ value }) => value !== null).length) {
      throw new Error(`International comparison measure '${id}' has an invalid denominator`);
    }
  }

  return publication;
}

export {
  COMPARISON_COUNTRIES,
  COMPARISON_MEASURES,
  COMPARISON_SCHEMA_VERSION,
  COMPARISON_SET_ID,
  UNIT_USD_PER_RESIDENT,
  buildComparisonMeasure,
  rankComparisonObservations,
  validateInternationalComparisonPublication,
};
