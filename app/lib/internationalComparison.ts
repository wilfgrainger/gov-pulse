export const COMPARISON_COUNTRY_NAMES = {
  GBR: "United Kingdom",
  USA: "United States",
  CHN: "China",
  RUS: "Russia",
  UKR: "Ukraine",
  DEU: "Germany",
  FRA: "France",
  ITA: "Italy",
  ESP: "Spain",
  TUR: "Türkiye",
  NLD: "Netherlands",
  CHE: "Switzerland",
  POL: "Poland",
} as const;

export type ComparisonCountryId = keyof typeof COMPARISON_COUNTRY_NAMES;
export type ComparisonValueType = "historical" | "estimate" | "projection";

export const COMPARISON_MEASURE_ORDER = [
  "governmentDebt",
  "officialDevelopmentAssistance",
  "defenceSpending",
  "publicSocialExpenditure",
  "healthcareSpending",
  "taxRevenue",
  "debtInterest",
] as const;

export type ComparisonMeasureId = (typeof COMPARISON_MEASURE_ORDER)[number];

export interface ComparisonSource {
  publisher: string;
  url: string;
  series: string;
  publicationDate?: string;
}

export interface ComparisonObservation {
  country: ComparisonCountryId;
  value: number | null;
  rank: number | null;
  observationYear: number;
  valueType: ComparisonValueType;
  source: ComparisonSource | null;
  exclusionReason?: string;
  calculationInputs?: Record<string, number>;
}

export interface ComparisonMeasure {
  id: ComparisonMeasureId;
  label: string;
  definition: string;
  unit: "USD per resident";
  rankDirection: "highest-first";
  observationYear: number;
  comparableCountryCount: number;
  caveat?: string;
  countries: ComparisonObservation[];
}

export interface InternationalComparisonPublication {
  meta: {
    schemaVersion: 1;
    generatedAt: string;
    checkedAt?: string;
    comparisonSetId: "uk-context-13-v1";
    countries: ComparisonCountryId[];
    sourceStatus?: Record<string, string>;
  };
  measures: Record<ComparisonMeasureId, ComparisonMeasure>;
}

const COUNTRY_IDS = Object.keys(COMPARISON_COUNTRY_NAMES) as ComparisonCountryId[];
const VALUE_TYPES = new Set<ComparisonValueType>(["historical", "estimate", "projection"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isInternationalComparisonPublication(
  value: unknown
): value is InternationalComparisonPublication {
  if (!isRecord(value) || !isRecord(value.meta) || !isRecord(value.measures)) return false;
  if (value.meta.schemaVersion !== 1 || value.meta.comparisonSetId !== "uk-context-13-v1") return false;
  if (!Array.isArray(value.meta.countries)) return false;
  if (JSON.stringify(value.meta.countries) !== JSON.stringify(COUNTRY_IDS)) return false;
  if (!Number.isFinite(Date.parse(String(value.meta.generatedAt ?? "")))) return false;

  for (const id of COMPARISON_MEASURE_ORDER) {
    const measure = value.measures[id];
    if (!isRecord(measure) || measure.id !== id || measure.unit !== "USD per resident") return false;
    if (!Array.isArray(measure.countries) || measure.countries.length !== COUNTRY_IDS.length) return false;
    if (!Number.isInteger(measure.observationYear) || !Number.isInteger(measure.comparableCountryCount)) return false;

    for (const observation of measure.countries) {
      if (!isRecord(observation) || !COUNTRY_IDS.includes(observation.country as ComparisonCountryId)) return false;
      if (!Number.isInteger(observation.observationYear)) return false;
      if (!VALUE_TYPES.has(observation.valueType as ComparisonValueType)) return false;
      if (observation.value !== null && !Number.isFinite(observation.value)) return false;
      if (observation.rank !== null && !Number.isInteger(observation.rank)) return false;
    }
  }
  return true;
}

export function formatUsdPerResident(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const rounded = Math.round(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  const remainder10 = value % 10;
  if (remainder10 === 1) return `${value}st`;
  if (remainder10 === 2) return `${value}nd`;
  if (remainder10 === 3) return `${value}rd`;
  return `${value}th`;
}

function comparisonNoun(measure: ComparisonMeasure) {
  return measure.id === "officialDevelopmentAssistance"
    ? "comparable donors"
    : "comparable countries";
}

export function rankLabel(measure: ComparisonMeasure, observation: ComparisonObservation) {
  if (observation.rank === null || observation.value === null || measure.comparableCountryCount === 0) {
    return "Not ranked";
  }
  return `${ordinal(observation.rank)} highest of ${measure.comparableCountryCount} ${comparisonNoun(measure)}`;
}

function naturalList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function comparisonSummary(
  measure: ComparisonMeasure,
  observation: ComparisonObservation
) {
  if (
    observation.rank === null ||
    observation.value === null ||
    measure.comparableCountryCount === 0
  ) {
    return "Comparison unavailable";
  }

  const rankedAbove = measure.countries
    .filter(
      (candidate) =>
        candidate.value !== null &&
        candidate.rank !== null &&
        candidate.rank < observation.rank!
    )
    .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999));

  if (rankedAbove.length === 0) {
    return `Highest of ${measure.comparableCountryCount} ${comparisonNoun(measure)}`;
  }
  if (rankedAbove.length <= 3) {
    const names = rankedAbove.map(
      (candidate) => COMPARISON_COUNTRY_NAMES[candidate.country]
    );
    return `Only ${naturalList(names)} ${names.length === 1 ? "is" : "are"} higher`;
  }

  const position = observation.rank / measure.comparableCountryCount;
  if (position <= 1 / 3) {
    return `Upper third of ${measure.comparableCountryCount} ${comparisonNoun(measure)}`;
  }
  if (position <= 2 / 3) {
    return `Middle of ${measure.comparableCountryCount} ${comparisonNoun(measure)}`;
  }
  return `Lower third of ${measure.comparableCountryCount} ${comparisonNoun(measure)}`;
}

export function ukObservation(measure: ComparisonMeasure) {
  return measure.countries.find((observation) => observation.country === "GBR") ?? null;
}

export function valueTypeLabel(valueType: ComparisonValueType) {
  if (valueType === "estimate") return "Estimate";
  if (valueType === "projection") return "Projection";
  return "Historical observation";
}

export function exclusionLabel(reason?: string) {
  switch (reason) {
    case "not-covered-by-comparable-donor-series":
      return "Outside the comparable OECD donor series";
    case "not-covered-by-oecd-comparable-series":
      return "Outside the comparable OECD series";
    case "publisher-reported-no-value":
      return "No comparable value published";
    case "source-unavailable":
      return "Source temporarily unavailable";
    default:
      return "Comparable value unavailable";
  }
}
