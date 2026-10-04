"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COMPARISON_COUNTRY_NAMES, COMPARISON_MEASURE_ORDER, formatExactUsdPerResident, formatUsdPerResident, valueTypeLabel, type ComparisonCountryId, type ComparisonMeasure, type ComparisonValueType } from "@/app/lib/internationalComparison";
import { buildCountryChartMetadata, countryComparisonExclusionLabel, countryComparisonPreset, defaultCountryComparisonMeasureId, parseCountryComparisonUrlState, selectCountryFigure, serializeCountryComparisonUrlState } from "@/app/lib/countryComparison";
import ChartExportButtons from "@/app/components/ChartExportButtons";

const COUNTRY_IDS = Object.keys(COMPARISON_COUNTRY_NAMES) as ComparisonCountryId[];
const TYPES: ComparisonValueType[] = ["historical", "estimate", "projection"];
const LABELS: Record<(typeof COMPARISON_MEASURE_ORDER)[number], string> = {
  governmentDebt: "Government debt outstanding", officialDevelopmentAssistance: "Foreign / overseas aid", defenceSpending: "Defence spending", publicSocialExpenditure: "Public social spending", healthcareSpending: "Total healthcare spending", taxRevenue: "Tax collected", debtInterest: "Debt interest",
};

export default function CountryComparisonFigures({ measures }: { measures: Record<string, ComparisonMeasure> }) {
  const defaultMeasureId = defaultCountryComparisonMeasureId(measures);
  const [measureId, setMeasureId] = useState<(typeof COMPARISON_MEASURE_ORDER)[number]>(defaultMeasureId);
  const [countries, setCountries] = useState<ComparisonCountryId[]>(COUNTRY_IDS);
  const [types, setTypes] = useState<ComparisonValueType[]>(TYPES);
  const [year, setYear] = useState<number | "latest">("latest");
  const [urlReady, setUrlReady] = useState(false);
  const restoringUrl = useRef(false);
  useEffect(() => {
    const readUrl = () => {
      restoringUrl.current = true;
      const preliminary = parseCountryComparisonUrlState(window.location.search, [], defaultMeasureId);
      const availableYears = measures[preliminary.measureId]?.countryHistory?.map(({ observationYear }) => observationYear) ?? [];
      const state = parseCountryComparisonUrlState(window.location.search, [...new Set(availableYears)], defaultMeasureId);
      setMeasureId(state.measureId);
      setCountries(state.countries);
      setTypes(state.valueTypes);
      setYear(state.year);
      setUrlReady(true);
    };
    readUrl();
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, [defaultMeasureId, measures]);
  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    for (const key of ["measure", "countries", "types", "year"]) url.searchParams.delete(key);
    const encoded = new URLSearchParams(serializeCountryComparisonUrlState({ measureId, countries, valueTypes: types, year }, defaultMeasureId));
    encoded.forEach((value, key) => url.searchParams.set(key, value));
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const replaceCurrentEntry = restoringUrl.current;
    restoringUrl.current = false;
    if (next !== current) {
      if (replaceCurrentEntry) window.history.replaceState(window.history.state, "", next);
      else window.history.pushState(window.history.state, "", next);
    }
  }, [defaultMeasureId, measureId, countries, types, year, urlReady]);
  const measure = measures[measureId];
  const availableYears = [...new Set(measure.countryHistory?.map(({ observationYear }) => observationYear) ?? [])].sort((left, right) => right - left);
  const result = useMemo(() => selectCountryFigure(measure, countries, types, year), [measure, countries, types, year]);
  const chartRef = useRef<SVGSVGElement | null>(null);
  const chartMetadata = useMemo(() => buildCountryChartMetadata(measure, result), [measure, result]);
  const max = Math.max(0, ...result.rows.map((row) => row.value ?? 0));
  const plotWidth = 640;
  const rowHeight = 34;
  const height = Math.max(120, result.rows.length * rowHeight + 52);
  const toggleCountry = (country: ComparisonCountryId) => setCountries((current) => current.includes(country) ? current.filter((id) => id !== country) : [...current, country]);
  const toggleType = (valueType: ComparisonValueType) => setTypes((current) => current.includes(valueType) ? current.filter((type) => type !== valueType) : [...current, valueType]);
  const noRankReason = result.rows.length ? result.commonYear === null ? "The selected observations do not share one year; values are shown without a ranking." : result.commonValueType === null ? "The selected observations mix historical values, estimates or projections; values are shown without a ranking." : null : null;
  const plottedYear = result.commonYear === null ? "latest available by country" : String(result.commonYear);
  const yearStatus = year === "latest" ? "latest source years may differ" : `common year ${year}`;
  const evidenceStatus = result.commonValueType
    ? valueTypeLabel(result.commonValueType)
    : result.rows.length
      ? "mixed evidence status"
      : "no values match the selected filters";
  return <section aria-labelledby="country-figures-heading" className="mt-10 border-y-2 border-foreground bg-white p-5 md:p-8">
    <p className="eyebrow">Interactive country figures</p><h2 id="country-figures-heading" className="mt-2 text-3xl font-black">Compare one definition at a time</h2>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-700">Each figure uses one named measure, one unit and one definition. The selected year and evidence status stay visible. Countries with missing values are excluded from the visible denominator rather than set to zero.</p>
    <div className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Measure<select value={measureId} onChange={(event) => { setMeasureId(event.target.value as (typeof COMPARISON_MEASURE_ORDER)[number]); setYear("latest"); }} className="min-h-11 border border-foreground bg-white px-3">{COMPARISON_MEASURE_ORDER.map((id) => <option key={id} value={id}>{LABELS[id]}</option>)}</select></label><label className="grid gap-1 text-sm font-bold">Comparison year<select value={year} onChange={(event) => setYear(event.target.value === "latest" ? "latest" : Number(event.target.value))} className="min-h-11 border border-foreground bg-white px-3"><option value="latest">Latest available by country</option>{availableYears.map((availableYear) => { const statuses = [...new Set(measure.countryHistory?.filter((row) => row.observationYear === availableYear).map((row) => row.valueType) ?? [])]; return <option key={availableYear} value={availableYear}>{availableYear} · {statuses.length === 1 ? valueTypeLabel(statuses[0]) : "mixed evidence status"}</option>; })}</select></label></div>
    <fieldset className="mt-4"><legend className="text-sm font-bold">Peer sets</legend><div className="mt-2 flex flex-wrap gap-2">{([["europe", "UK + Europe"], ["major-powers", "UK + major powers"], ["all", "All countries"]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => { const preset = countryComparisonPreset(id); if (preset) setCountries(preset); }} className="min-h-10 border border-foreground bg-white px-3 text-sm font-semibold hover:bg-surface-warm">{label}</button>)}</div><p className="mt-2 text-xs text-gray-600">The URL records the selected measure, countries and evidence status for sharing.</p></fieldset>
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.45fr)]"><fieldset><legend className="text-sm font-bold">Include countries</legend><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 xl:grid-cols-4">{COUNTRY_IDS.map((id) => <label key={id} className="inline-flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={countries.includes(id)} onChange={() => toggleCountry(id)} className="size-4 accent-[var(--accent)]"/>{COMPARISON_COUNTRY_NAMES[id]}{id === "GBR" ? " · UK" : ""}</label>)}</div></fieldset><fieldset><legend className="text-sm font-bold">Evidence status</legend><div className="mt-2 space-y-1">{TYPES.map((valueType) => <label key={valueType} className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={types.includes(valueType)} onChange={() => toggleType(valueType)} className="size-4 accent-[var(--accent)]"/>{valueTypeLabel(valueType)}</label>)}</div></fieldset></div>
    <div className="mt-6 border-t border-line pt-4"><p className="font-bold">{measure.label} · {year === "latest" ? `latest available (${plottedYear})` : `common year ${year}`} · {measure.unit}</p><p className="mt-1 text-sm text-gray-700">{measure.definition}</p><p role="status" className="mt-2 text-sm font-semibold">Visible denominator: {result.denominator} of {result.sourceCountryCount} source-set countries · {yearStatus} · {evidenceStatus}.</p>{noRankReason ? <p className="mt-2 text-sm text-accent">{noRankReason}</p> : null}</div>
    {result.rows.length ? <div className="mt-4 overflow-x-auto"><svg ref={chartRef} viewBox={`0 0 760 ${height}`} role="img" aria-label={`${measure.label}, ${year === "latest" ? plottedYear : year}, USD per resident. ${result.denominator} countries included; missing values omitted. ${result.ranked ? "Ranks shown within the selected countries." : "No rank because year or evidence status differs."}`} className="h-auto min-w-[42rem] w-full">
      {[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1="112" x2="732" y1={24 + (result.rows.length + 1) * rowHeight} y2={24 + (result.rows.length + 1) * rowHeight} stroke="#192139"/><line x1={112 + plotWidth * ratio} x2={112 + plotWidth * ratio} y1="12" y2={24 + result.rows.length * rowHeight} stroke="#ddd2c3" strokeDasharray="3 4"/><text x={112 + plotWidth * ratio} y={height - 6} textAnchor="middle" fontSize="10" fill="#51596a">{formatUsdPerResident(max * ratio)}</text></g>)}
      {result.rows.map((row, index) => { const y = 23 + index * rowHeight; const cx = 112 + (max > 0 ? (row.value ?? 0) / max : 0) * plotWidth; const isUk = row.country === "GBR"; return <g key={row.country}><text x="102" y={y + 4} textAnchor="end" fontSize="11" fontWeight={isUk ? "700" : "400"} fill="#192139">{COMPARISON_COUNTRY_NAMES[row.country]}{isUk ? " · UK" : ""}</text><circle cx={cx} cy={y} r={isUk ? 6 : 4.5} fill={isUk ? "#a72d24" : "#08766c"} stroke="#fff" strokeWidth="1.5"><title>{`${COMPARISON_COUNTRY_NAMES[row.country]}: ${formatUsdPerResident(row.value)}; ${row.observationYear}; ${valueTypeLabel(row.valueType)}; ${row.rank === null ? "not ranked" : `rank ${row.rank}`}`}</title></circle><text x={Math.min(cx + 10, 720)} y={y + 4} fontSize="10" fill="#192139">{formatUsdPerResident(row.value)}{row.rank === null ? "" : ` · ${row.rank}`}</text></g>; })}
    </svg></div> : <p role="status" className="mt-4 border-l-4 border-accent bg-surface-warm p-5 text-sm">No numeric country values match these filters.</p>}
    <div className="mt-3 flex justify-end"><ChartExportButtons containerRef={chartRef} chartMetadata={chartMetadata} dataOnly={!result.rows.length}/></div>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[48rem] border-collapse text-sm"><caption className="text-left font-bold">Exact selected country observations and denominator</caption><thead><tr className="border-b border-foreground text-left text-xs uppercase"><th scope="col" className="py-2">Country</th><th scope="col" className="py-2">USD per resident</th><th scope="col" className="py-2">Year</th><th scope="col" className="py-2">Evidence type</th><th scope="col" className="py-2">Selected rank</th><th scope="col" className="py-2">Source</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.country} className={`border-b border-line ${row.country === "GBR" ? "bg-surface-warm font-bold" : ""}`}><th scope="row" className="py-2 text-left">{COMPARISON_COUNTRY_NAMES[row.country]}{row.country === "GBR" ? " · UK" : ""}</th><td className="py-2 tabular-nums">{formatExactUsdPerResident(row.value)}</td><td className="py-2">{row.observationYear}</td><td className="py-2">{valueTypeLabel(row.valueType)}</td><td className="py-2">{row.rank ?? "Not ranked"}</td><td className="py-2">{row.source ? [row.source, ...(row.source.additionalSources ?? [])].map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="mr-2 inline-block underline">{source.publisher}{source.publicationDate ? ` · ${source.publicationDate}` : ""}</a>) : "Unavailable"}</td></tr>)}</tbody></table></div>
    {result.excluded.length ? <details className="mt-4 border border-line p-4"><summary className="cursor-pointer text-sm font-bold">{result.excluded.length} excluded country records</summary><ul className="mt-3 grid list-disc gap-x-5 gap-y-2 pl-5 text-sm sm:grid-cols-2">{result.excluded.map((row) => <li key={row.country}><strong>{COMPARISON_COUNTRY_NAMES[row.country]}:</strong> {countryComparisonExclusionLabel(row.reason)}</li>)}</ul></details> : null}
    <p className="mt-5 text-xs leading-5 text-gray-600">Latest-available mode uses each country&apos;s latest source observation and suppresses ranking when years or evidence status differ. A year is offered only when the publication retains a source-backed series for it. Source year, unit and basis remain visible; ties share rank.</p>
  </section>;
}
