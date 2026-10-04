import { COMPARISON_COUNTRY_NAMES, COMPARISON_MEASURE_ORDER, sourceUpdateAttribution, type ComparisonMeasure, type ComparisonMeasureId, type ComparisonCountryId, type ComparisonValueType } from "@/app/lib/internationalComparison";
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

const EXCLUSION_REASON_LABELS: Record<string, string> = {
  "not-covered-by-comparable-donor-series": "Not covered by the comparable donor series",
  "not-covered-by-oecd-comparable-series": "Not covered by the OECD comparable series",
  "publisher-reported-no-value": "The publisher reports no value",
  "source-unavailable": "The source is unavailable",
  "source-validity-expired": "The source edition has expired",
};

export function countryComparisonExclusionLabel(reason: string): string {
  const knownLabel = EXCLUSION_REASON_LABELS[reason];
  if (knownLabel) return knownLabel;
  if (!reason.includes(" ") && reason.includes("-")) {
    return reason.replaceAll("-", " ").replace(/^./, (first) => first.toUpperCase());
  }
  return reason;
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
  const includedRecords = result.rows.map((row) => ({ row, included: true as const, exclusionReason: null }));
  const unavailableRecords = (result.rows.length ? [] : result.excluded.filter(({ reason }) => reason !== "Excluded by country filter"))
    .map((row) => ({ row, included: false as const, exclusionReason: countryComparisonExclusionLabel(row.reason) }));
  const records = [...includedRecords, ...unavailableRecords];
  const sourceReferences = (measure.sourceReferences ?? []).flatMap((source) => [source, ...(source.additionalSources ?? [])]);
  const observationSources = records.flatMap(({ row: { source } }) => source
    ? [source, ...(source.additionalSources ?? [])]
    : []);
  const sources = [...new Map([...sourceReferences, ...observationSources].map((source) => [source.url, source] as const)).values()];
  const unavailableReferenceUrls = new Set(measure.lifecycle?.status === "unavailable" && result.rows.length === 0
    ? sourceReferences.map(({ url }) => url)
    : []);
  const sourceCitation = [
    `${measure.label}: ${measure.definition}`,
    `Visible denominator: ${result.denominator} of ${result.sourceCountryCount}; ${result.rows.length === 0 ? "no values matched the selected filters; no ranking is available" : result.ranked ? `ranked within ${result.commonYear} ${result.commonValueType} observations` : "not ranked because year or evidence status differs"}`,
    ...sources.map((source) => unavailableReferenceUrls.has(source.url)
      ? `Primary source reference; values unavailable in this edition: ${source.publisher}, ${source.series}: ${source.url}`
      : `${source.publisher}${source.publicationDate ? `, published ${source.publicationDate}` : ""}${sourceUpdateAttribution(source) ? `, ${sourceUpdateAttribution(source)}` : ""}: ${source.url}`),
  ].join(" · ");
  const excludedCaveats = [...new Set(result.excluded.map(({ reason }) => countryComparisonExclusionLabel(reason)))];
  const caveats = [
    measure.caveat,
    measure.lifecycle?.status === "unavailable" ? "Primary source retrieval was unavailable for this edition; null values are not zero." : null,
    `Visible denominator is ${result.denominator} of ${result.sourceCountryCount} source-set countries; excluded or missing values are not zero.`,
    result.rows.length === 0 ? "No values matched the selected filters; no ranking is available." : result.ranked ? `Ranks apply only to the selected ${result.commonYear} ${result.commonValueType} observations.` : "No rank is shown because selected observations do not share one year and evidence status.",
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
    series: records.map(({ row, included, exclusionReason }) => ({
      key: row.country,
      label: `${COMPARISON_COUNTRY_NAMES[row.country]} · ${row.value === null ? "unavailable" : `${row.value} ${measure.unit}`} · ${row.observationYear} · ${row.valueType} · ${included ? row.rank === null ? "not ranked" : `rank ${row.rank}` : `excluded: ${exclusionReason}`}`,
    })),
    observations: records.map(({ row, included, exclusionReason }) => {
      const details: Record<string, string | number | null> = {
        country: row.country,
        evidenceStatus: row.valueType,
        rank: included ? row.rank : null,
        includedInDenominator: included ? "yes" : "no",
        exclusionReason,
      };
      for (const [name, input] of Object.entries(row.calculationInputs ?? {})) {
        details[`input_${name}`] = input;
      }
      return {
        period: String(row.observationYear),
        observedAt: row.value === null ? null : `${row.observationYear}-12-31`,
        values: { [row.country]: row.value },
        details,
      };
    }),
    caveats,
  };
}
