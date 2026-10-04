import { COMPARISON_COUNTRY_NAMES, COMPARISON_MEASURE_ORDER, type ComparisonMeasure, type ComparisonMeasureId, type ComparisonCountryId, type ComparisonValueType } from "@/app/lib/internationalComparison";
import type { ChartMetadata } from "@/app/lib/chartExport";

export type CountryComparisonUrlState = {
  measureId: (typeof COMPARISON_MEASURE_ORDER)[number];
  countries: ComparisonCountryId[];
  valueTypes: ComparisonValueType[];
  year: number | "latest";
};

const COUNTRY_IDS = Object.keys(COMPARISON_COUNTRY_NAMES) as ComparisonCountryId[];
const VALUE_TYPES: ComparisonValueType[] = ["historical", "estimate", "projection"];
const DEFAULT_COUNTRY_STATE: CountryComparisonUrlState = {
  measureId: COMPARISON_MEASURE_ORDER[0],
  countries: COUNTRY_IDS,
  valueTypes: VALUE_TYPES,
  year: "latest",
};

export function defaultCountryComparisonMeasureId(
  measures: Partial<Record<ComparisonMeasureId, ComparisonMeasure>>,
): ComparisonMeasureId {
  return [...COMPARISON_MEASURE_ORDER].sort((leftId, rightId) => {
    const left = measures[leftId];
    const right = measures[rightId];
    const currentCoverage = (measure: ComparisonMeasure | undefined) => measure?.comparableCountryCount ?? 0;
    const historyCoverage = (measure: ComparisonMeasure | undefined) =>
      measure?.countryHistory?.filter(({ value }) => value !== null).length ?? 0;
    return currentCoverage(right) - currentCoverage(left) || historyCoverage(right) - historyCoverage(left);
  })[0] ?? DEFAULT_COUNTRY_STATE.measureId;
}

const COUNTRY_PRESETS: Record<string, ComparisonCountryId[]> = {
  europe: ["GBR", "DEU", "FRA", "ITA", "ESP", "IRL", "NLD", "CHE", "POL"],
  "major-powers": ["GBR", "USA", "CHN", "RUS", "DEU", "FRA"],
};

export function countryComparisonPreset(id: string): ComparisonCountryId[] | null {
  if (id === "all") return [...COUNTRY_IDS];
  return COUNTRY_PRESETS[id] ? [...COUNTRY_PRESETS[id]] : null;
}

export function parseCountryComparisonUrlState(
  search: string,
  availableYears: number[] = [],
  defaultMeasureId: ComparisonMeasureId = DEFAULT_COUNTRY_STATE.measureId,
): CountryComparisonUrlState {
  const params = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  const rawMeasure = params.get("measure");
  const measureId = COMPARISON_MEASURE_ORDER.includes(rawMeasure as CountryComparisonUrlState["measureId"])
    ? rawMeasure as CountryComparisonUrlState["measureId"]
    : defaultMeasureId;
  const rawCountries = params.get("countries");
  const rawTypes = params.get("types");
  const hasCountries = params.has("countries");
  const hasTypes = params.has("types");
  const selectedCountries = new Set((rawCountries ?? "").split(","));
  const selectedTypes = new Set((rawTypes ?? "").split(","));
  const countries = COUNTRY_IDS.filter((id) => selectedCountries.has(id));
  const valueTypes = VALUE_TYPES.filter((type) => selectedTypes.has(type));
  const rawYear = params.get("year");
  const parsedYear = /^\d{4}$/.test(rawYear ?? "") ? Number(rawYear) : NaN;
  return {
    measureId,
    countries: hasCountries && (countries.length || rawCountries === "") ? countries : [...DEFAULT_COUNTRY_STATE.countries],
    valueTypes: hasTypes && (valueTypes.length || rawTypes === "") ? valueTypes : [...DEFAULT_COUNTRY_STATE.valueTypes],
    year: availableYears.includes(parsedYear) ? parsedYear : "latest",
  };
}

export function serializeCountryComparisonUrlState(
  state: CountryComparisonUrlState,
  defaultMeasureId: ComparisonMeasureId = DEFAULT_COUNTRY_STATE.measureId,
): string {
  const params = new URLSearchParams();
  if (COMPARISON_MEASURE_ORDER.includes(state.measureId) && state.measureId !== defaultMeasureId) {
    params.set("measure", state.measureId);
  }
  const selectedCountries = new Set(state.countries.filter((id) => COUNTRY_IDS.includes(id)));
  if (selectedCountries.size !== COUNTRY_IDS.length) params.set("countries", COUNTRY_IDS.filter((id) => selectedCountries.has(id)).join(","));
  const selectedTypes = new Set(state.valueTypes.filter((type) => VALUE_TYPES.includes(type)));
  if (selectedTypes.size !== VALUE_TYPES.length) params.set("types", VALUE_TYPES.filter((type) => selectedTypes.has(type)).join(","));
  if (typeof state.year === "number" && Number.isInteger(state.year)) params.set("year", String(state.year));
  return params.toString();
}

export function canShareCountryAxis(left: ComparisonMeasure, right: ComparisonMeasure): boolean {
  return left.observationYear === right.observationYear && left.unit === right.unit && left.definition === right.definition;
}

export function selectCountryFigure(measure: ComparisonMeasure, countryIds: ComparisonCountryId[], valueTypes: ComparisonValueType[], selectedYear: number | "latest" = "latest") {
  const selected = new Set(countryIds);
  const typeFilter = new Set(valueTypes);
  const sourceRows = selectedYear === "latest"
    ? measure.countries
    : (measure.countryHistory ?? []).filter((item) => item.observationYear === selectedYear);
  const included = sourceRows.filter((item) => selected.has(item.country) && item.value !== null && typeFilter.has(item.valueType));
  const years = new Set(included.map((item) => item.observationYear));
  const types = new Set(included.map((item) => item.valueType));
  const rankComparable = included.length > 0 && years.size === 1 && types.size === 1;
  const sorted = [...included].sort((left, right) => right.value! - left.value! || COMPARISON_COUNTRY_NAMES[left.country].localeCompare(COMPARISON_COUNTRY_NAMES[right.country], "en-GB"));
  let priorValue: number | null = null;
  let priorRank = 0;
  const rows = sorted.map((item, index) => {
    const rank = rankComparable ? item.value === priorValue ? priorRank : index + 1 : null;
    priorValue = item.value;
    priorRank = rank ?? index + 1;
    return { ...item, rank };
  });
  const includedIds = new Set(rows.map((item) => item.country));
  const excluded = sourceRows.filter((item) => !includedIds.has(item.country)).map((item) => ({ ...item, reason: !selected.has(item.country) ? "Excluded by country filter" : item.value === null ? item.exclusionReason ?? "No comparable value published" : !typeFilter.has(item.valueType) ? `Excluded by ${item.valueType} status filter` : "Not comparable" }));
  return { rows, excluded, denominator: rows.length, sourceCountryCount: sourceRows.length || measure.countries.length, commonYear: years.size === 1 ? [...years][0] : null, commonValueType: types.size === 1 ? [...types][0] : null, ranked: rankComparable };
}

export function buildCountryChartMetadata(
  measure: ComparisonMeasure,
  result: ReturnType<typeof selectCountryFigure>,
): ChartMetadata {
  const years = result.rows.map(({ observationYear }) => observationYear).sort((left, right) => left - right);
  const sources = [...new Map(result.rows.flatMap(({ source }) => source
    ? [source, ...(source.additionalSources ?? [])].map((item) => [item.url, item] as const)
    : [])).values()];
  const sourceCitation = [
    `${measure.label}: ${measure.definition}`,
    `Visible denominator: ${result.denominator} of ${result.sourceCountryCount}; ${result.ranked ? `ranked within ${result.commonYear} ${result.commonValueType} observations` : "not ranked because year or evidence status differs"}`,
    ...sources.map((source) => `${source.publisher}${source.publicationDate ? `, published ${source.publicationDate}` : ""}: ${source.url}`),
  ].join(" · ");
  const excludedCaveats = [...new Set(result.excluded.map(({ reason }) => reason))];
  const caveats = [
    measure.caveat,
    `Visible denominator is ${result.denominator} of ${result.sourceCountryCount} source-set countries; excluded or missing values are not zero.`,
    result.ranked ? `Ranks apply only to the selected ${result.commonYear} ${result.commonValueType} observations.` : "No rank is shown because selected observations do not share one year and evidence status.",
    ...excludedCaveats,
  ].filter((value): value is string => Boolean(value));
  return {
    schemaVersion: 2,
    title: `${measure.label} by country`,
    sourceCitation,
    observationWindow: years.length ? {
      start: { period: String(years[0]), observedAt: `${years[0]}-01-01` },
      end: { period: String(years.at(-1)), observedAt: `${years.at(-1)}-12-31` },
    } : { start: null, end: null },
    series: result.rows.map((row) => ({
      key: row.country,
      label: `${COMPARISON_COUNTRY_NAMES[row.country]} · ${row.value} ${measure.unit} · ${row.observationYear} · ${row.valueType} · ${row.rank === null ? "not ranked" : `rank ${row.rank}`}`,
    })),
    observations: result.rows.map((row) => ({
      period: String(row.observationYear),
      observedAt: `${row.observationYear}-12-31`,
      values: { [row.country]: row.value },
      details: { country: row.country, evidenceStatus: row.valueType, rank: row.rank },
    })),
    caveats,
  };
}
