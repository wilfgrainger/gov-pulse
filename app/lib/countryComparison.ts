import { COMPARISON_COUNTRY_NAMES, type ComparisonMeasure, type ComparisonCountryId, type ComparisonValueType } from "@/app/lib/internationalComparison";
import type { ChartMetadata } from "@/app/lib/chartExport";

export function canShareCountryAxis(left: ComparisonMeasure, right: ComparisonMeasure): boolean {
  return left.observationYear === right.observationYear && left.unit === right.unit && left.definition === right.definition;
}

export function selectCountryFigure(measure: ComparisonMeasure, countryIds: ComparisonCountryId[], valueTypes: ComparisonValueType[]) {
  const selected = new Set(countryIds);
  const typeFilter = new Set(valueTypes);
  const included = measure.countries.filter((item) => selected.has(item.country) && item.value !== null && typeFilter.has(item.valueType));
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
  const excluded = measure.countries.filter((item) => !includedIds.has(item.country)).map((item) => ({ ...item, reason: !selected.has(item.country) ? "Excluded by country filter" : item.value === null ? item.exclusionReason ?? "No comparable value published" : !typeFilter.has(item.valueType) ? `Excluded by ${item.valueType} status filter` : "Not comparable" }));
  return { rows, excluded, denominator: rows.length, sourceCountryCount: measure.countries.length, commonYear: years.size === 1 ? [...years][0] : null, commonValueType: types.size === 1 ? [...types][0] : null, ranked: rankComparable };
}

export function buildCountryChartMetadata(
  measure: ComparisonMeasure,
  result: ReturnType<typeof selectCountryFigure>,
): ChartMetadata {
  const years = result.rows.map(({ observationYear }) => observationYear).sort((left, right) => left - right);
  const sources = [...new Map(result.rows.flatMap(({ source }) => source ? [[source.url, source] as const] : [])).values()];
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
    schemaVersion: 1,
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
    caveats,
  };
}
