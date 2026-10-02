"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MeasureRecord } from "@/app/lib/measureCatalog";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import ObservationTable from "@/app/components/charts/ObservationTable";
import { buildExportPackage, clipPoints, segmentPoints, type DateWindow } from "@/app/lib/chartModel";
import { workspaceUrl, type Workspace } from "@/app/lib/comparisonWorkspace";

const COLORS = ["#08766c", "#a72d24", "#4d43a5", "#a45700"];
const format = (value: number, unit: string) => `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)}${unit === "%" ? "%" : ` ${unit}`}`;

function Overlay({ measures, window }: { measures: MeasureRecord[]; window: DateWindow }) {
  const visible = measures.map((measure) => ({ measure, points: clipPoints(measure.points, window) }));
  const values = visible.flatMap(({ points }) => points.flatMap((point) => point.value === null ? [] : [point.value]));
  const min = Math.min(...values, 0); const max = Math.max(...values, 0);
  const span = max - min || 1;
  const dates = [...new Set(visible.flatMap(({ points }) => points.map((point) => point.observedAt)))].sort();
  const x = (date: string) => 60 + (dates.length < 2 ? 340 : (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / (Date.parse(`${dates.at(-1)}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`))) * 680;
  const y = (value: number) => 280 - (value - min) / span * 240;
  const ref = useMemo(() => ({ current: null as SVGSVGElement | null }), []);
  const pkg = buildExportPackage({ title: "Comparable public measures", measures, dateWindow: window });
  return <figure className="my-8 border-y-2 border-foreground bg-white p-4 md:p-6">
    <figcaption><h2 className="text-2xl font-black">Comparable measures on one scale</h2><p className="mt-2 text-sm text-gray-700">Shared unit: {measures[0]?.unit}. Shared definition family, geography, cadence and evidence class are validated.</p></figcaption>
    <div className="mt-4 overflow-x-auto">
      <svg ref={ref} viewBox="0 0 800 340" role="img" aria-label={`Comparable measures from ${window.start} to ${window.end}; fitted vertical scale ${format(min, measures[0]?.unit ?? "")} to ${format(max, measures[0]?.unit ?? "")}.`} className="h-auto min-w-[36rem] w-full">
        {[0, .25, .5, .75, 1].map((step) => <g key={step}><line x1="60" x2="740" y1={40 + step * 240} y2={40 + step * 240} stroke="#d8d0c5" strokeDasharray="3 4"/><text x="52" y={44 + step * 240} textAnchor="end" fontSize="11" fill="#51596a">{format(max - step * span, measures[0]?.unit ?? "")}</text></g>)}
        {visible.map(({ measure, points }, index) => {
          const series = segmentPoints(points, measure.cadence);
          return series.map((segment, segmentIndex) => <g key={`${measure.id}-${segmentIndex}`}>
            <path d={segment.map((point, pointIndex) => `${pointIndex ? "L" : "M"} ${x(point.observedAt)} ${y(point.value!)}`).join(" ")} fill="none" stroke={COLORS[index]} strokeWidth="3"/>
            {segment.length === 1 ? <circle cx={x(segment[0].observedAt)} cy={y(segment[0].value!)} r="5" fill={COLORS[index]} stroke="white" strokeWidth="2"/> : null}
          </g>);
        })}
        <text x="60" y="316" fontSize="11" fill="#51596a">{dates[0] ?? window.start}</text><text x="740" y="316" textAnchor="end" fontSize="11" fill="#51596a">{dates.at(-1) ?? window.end}</text>
      </svg>
    </div>
    <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">{measures.map((measure, index) => <span key={measure.id} className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-1 w-6" style={{ backgroundColor: COLORS[index] }}/>{measure.label}</span>)}</div>
    <p className="mt-3 text-xs leading-5 text-gray-600">Fitted axis: {format(min, measures[0]?.unit ?? "")} to {format(max, measures[0]?.unit ?? "")}. Source editions: {measures.map(({ sourceEditionId }) => sourceEditionId).join(", ")}.</p>
    <div className="mt-3 flex justify-end"><ChartExportButtons containerRef={ref} exportPackage={pkg}/></div>
    {measures.map((measure) => <ObservationTable key={measure.id} measure={measure} points={clipPoints(measure.points, window)} window={window}/>)}
  </figure>;
}

export default function ComparisonStudio({ measures, initial, initialError }: { measures: MeasureRecord[]; initial: Workspace | null; initialError: string | null }) {
  const [ids, setIds] = useState(initial?.measureIds ?? []);
  const [window, setWindow] = useState<DateWindow>(initial?.window ?? { start: "2020-01-01", end: new Date().toISOString().slice(0, 10) });
  const [mode, setMode] = useState<"panels" | "overlay">(initial?.mode ?? "panels");
  const [error, setError] = useState(initialError);
  const selected = ids.flatMap((id) => measures.filter((measure) => measure.id === id));
  const compatible = selected.length > 1 && selected.every((measure, index) => index === 0 || (selected[0].unit === measure.unit && selected[0].basis === measure.basis && selected[0].geography.code === measure.geography.code && selected[0].evidenceClass === measure.evidenceClass && selected[0].cadence === measure.cadence && selected[0].comparisonKey === measure.comparisonKey));
  const activeMode: "panels" | "overlay" = mode === "overlay" && compatible ? "overlay" : "panels";
  useEffect(() => {
    const workspace = { version: 1 as const, measureIds: ids, window, mode: activeMode };
    const url = workspaceUrl(workspace);
    if (`${location.pathname}${location.search}` !== url) history.replaceState(null, "", url);
  }, [activeMode, ids, window]);
  const toggle = (id: string) => {
    setError(null);
    setIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 4 ? current : [...current, id]);
  };
  const safeWindow = useMemo(() => window.start <= window.end ? window : { start: window.end, end: window.start }, [window]);
  return <>
    <section aria-label="Comparison controls" className="border border-line-strong bg-white p-4 md:p-6">
      {error ? <p role="alert" className="mb-4 border-l-4 border-accent bg-accent-soft p-3 text-sm">{error}</p> : null}
      <fieldset><legend className="text-lg font-extrabold">Select measures (up to four)</legend><ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">{measures.map((measure) => <li key={measure.id}><label className="flex min-h-12 items-start gap-3 border border-line p-3 text-sm hover:bg-surface-warm"><input type="checkbox" checked={ids.includes(measure.id)} disabled={!ids.includes(measure.id) && ids.length >= 4} onChange={() => toggle(measure.id)} className="mt-1 size-4 accent-[var(--accent)]"/><span><span className="font-bold">{measure.label}</span><span className="block text-xs text-gray-600">{measure.geography.label} · {measure.unit} · {measure.observationPeriod.label}</span></span></label></li>)}</ul></fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">From<input type="date" value={safeWindow.start} max={safeWindow.end} onChange={(event) => setWindow((value) => ({ ...value, start: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3"/></label><label className="grid gap-1 text-sm font-semibold">To<input type="date" value={safeWindow.end} min={safeWindow.start} onChange={(event) => setWindow((value) => ({ ...value, end: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3"/></label></div>
      <fieldset className="mt-5"><legend className="text-sm font-bold">Display mode</legend><div className="mt-2 flex flex-wrap gap-3"><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" checked={activeMode === "panels"} onChange={() => setMode("panels")} name="comparison-mode"/>Separate panels</label><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" checked={activeMode === "overlay"} disabled={!compatible} onChange={() => setMode("overlay")} name="comparison-mode"/>Overlay comparable series</label></div><p className="mt-2 text-xs text-gray-600">{compatible ? "All selected records meet the overlay contract." : "Overlay disabled: selected measures do not share a validated definition."}</p></fieldset>
      <p className="mt-4 text-sm">Share this state: <Link className="font-bold underline" href={workspaceUrl({ version: 1, measureIds: ids, window: safeWindow, mode: activeMode })}>open or copy comparison URL</Link></p>
      {ids.length >= 4 ? <p role="status" className="mt-2 text-sm text-gray-600">Four measures selected; remove one before adding another.</p> : null}
    </section>
    {activeMode === "overlay" ? <Overlay measures={selected} window={safeWindow}/> : <section aria-label="Comparison figures" className="mt-8 space-y-8">{selected.length ? selected.map((measure) => <EvidenceFigure key={measure.id} measure={measure} title={`${measure.label}: comparison panel`} description={`${measure.basis}. ${measure.geography.label}. Separate source-specific scale.`} window={safeWindow} variant="line"/>) : <p className="border-l-4 border-accent bg-white p-5 text-sm">Select one or more measures to see published observations.</p>}</section>}
  </>;
}
