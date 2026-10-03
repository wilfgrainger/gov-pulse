"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { compareEligibility, type MeasureRecord } from "@/app/lib/measureCatalog";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import ObservationTable from "@/app/components/charts/ObservationTable";
import { buildExportPackage, clipPoints, segmentPoints, serializeMeasureExportCsv, serializeMeasureExportJson, timePosition, type DateWindow, type ExportPackage } from "@/app/lib/chartModel";
import { MAX_COMPARISON_MEASURES, parseWorkspace, workspaceUrl, type Workspace } from "@/app/lib/comparisonWorkspace";
import { parseNamedComparisonWorkspaces, type NamedComparisonWorkspace } from "@/app/lib/comparisonSavedWorkspaces";

const STORAGE_KEY = "public-data.org:comparison-workspaces:v1";

const COLORS = ["#08766c", "#a72d24", "#4d43a5", "#a45700", "#135f94", "#7b3e76", "#4d6531", "#273b4a"];
const format = (value: number, unit: string) => `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value)}${unit === "%" ? "%" : ` ${unit}`}`;

function Overlay({ measures, window }: { measures: MeasureRecord[]; window: DateWindow }) {
  const visible = measures.map((measure) => ({ measure, points: clipPoints(measure.points, window) }));
  const values = visible.flatMap(({ points }) => points.flatMap((point) => point.value === null ? [] : [point.value]));
  const min = Math.min(...values, 0); const max = Math.max(...values, 0);
  const span = max - min || 1;
  const dates = [...new Set(visible.flatMap(({ points }) => points.map((point) => point.observedAt)))].sort();
  const firstDate = dates.length ? Date.parse(`${dates[0]}T00:00:00Z`) : 0;
  const lastDate = dates.length ? Date.parse(`${dates.at(-1)}T00:00:00Z`) : 0;
  const x = (date: string) => timePosition(Date.parse(`${date}T00:00:00Z`), firstDate, lastDate, 220, 520);
  const y = (value: number) => 280 - (value - min) / span * 240;
  const ref = useMemo(() => ({ current: null as SVGSVGElement | null }), []);
  const pkg = buildExportPackage({
    title: "Comparable public measures",
    measures,
    dateWindow: window,
    comparison: {
      displayMode: "overlay",
      transformations: ["Shared observed-date axis and shared vertical scale including zero and fitted to selected observations.", "Source values retain their published units; no rebasing or rescaling is applied."],
    },
  });
  return <figure className="my-8 border-y-2 border-foreground bg-white p-4 md:p-6">
    <figcaption><h2 className="text-2xl font-black">Comparable measures on one scale</h2><p className="mt-2 text-sm text-gray-700">Shared unit: {measures[0]?.unit}. Shared definition family, geography, cadence and evidence class are validated.</p></figcaption>
    <p className="mt-4 text-xs text-gray-600 sm:hidden">Swipe to inspect the full chart; exact observations are listed in the tables below.</p>
    <div className="mt-2 overflow-x-auto">
      <svg ref={ref} viewBox="0 0 800 340" role="img" aria-label={`Comparable measures from ${window.start} to ${window.end}; fitted vertical scale ${format(min, measures[0]?.unit ?? "")} to ${format(max, measures[0]?.unit ?? "")}.`} className="h-auto min-w-[36rem] w-full">
        {[0, .25, .5, .75, 1].map((step) => <g key={step}><line x1="220" x2="740" y1={40 + step * 240} y2={40 + step * 240} stroke="#d8d0c5" strokeDasharray="3 4"/><text x="212" y={44 + step * 240} textAnchor="end" fontSize="11" fill="#51596a">{format(max - step * span, measures[0]?.unit ?? "")}</text></g>)}
        {visible.map(({ measure, points }, index) => {
          const series = segmentPoints(points, measure.cadence);
        return series.map((segment, segmentIndex) => <g key={`${measure.id}-${segmentIndex}`}>
            <path d={segment.map((point, pointIndex) => `${pointIndex ? "L" : "M"} ${x(point.observedAt)} ${y(point.value!)}`).join(" ")} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="3"/>
            {segment.length === 1 ? <circle cx={x(segment[0].observedAt)} cy={y(segment[0].value!)} r="5" fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth="2"/> : null}
          </g>);
        })}
        <text x="220" y="316" fontSize="11" fill="#51596a">{dates[0] ?? window.start}</text><text x="740" y="316" textAnchor="end" fontSize="11" fill="#51596a">{dates.at(-1) ?? window.end}</text>
      </svg>
    </div>
    {values.length === 0 ? <p role="status" className="mt-3 border-l-4 border-accent bg-accent-soft p-3 text-sm">No numeric observations fall within this date window. Widen the date window to see published values.</p> : null}
    {visible.some(({ points }) => points.length === 0 || points.every((point) => point.value === null)) && values.length ? <p className="mt-3 text-sm text-gray-700">Some selected measures have no numeric observations in this date window; see their tables below.</p> : null}
    <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">{measures.map((measure, index) => <span key={measure.id} className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-1 w-6" style={{ backgroundColor: COLORS[index] }}/>{measure.label}</span>)}</div>
    <p className="mt-3 text-xs leading-5 text-gray-600">Fitted axis: {format(min, measures[0]?.unit ?? "")} to {format(max, measures[0]?.unit ?? "")}. Source editions: {measures.map(({ sourceEditionId }) => sourceEditionId).join(", ")}.</p>
    <div className="mt-3 flex justify-end"><ChartExportButtons containerRef={ref} exportPackage={pkg}/></div>
    {measures.map((measure) => <ObservationTable key={measure.id} measure={measure} points={clipPoints(measure.points, window)} window={window}/>)}
  </figure>;
}

function WorkspaceDataDownloads({ exportPackage }: { exportPackage: ExportPackage }) {
  const [error, setError] = useState("");
  const download = (extension: "csv" | "json") => {
    try {
      const content = extension === "csv" ? serializeMeasureExportCsv(exportPackage) : serializeMeasureExportJson(exportPackage);
      const url = URL.createObjectURL(new Blob([content], { type: extension === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `public-data-comparison.${extension}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError("");
    } catch {
      setError("Could not create the comparison data download. The charts and source tables remain available.");
    }
  };
  return <section aria-label="Download comparison data" className="my-5 border border-line bg-surface-warm p-4">
    <h2 className="font-bold">Download this workspace’s data</h2>
    <p className="mt-1 text-sm text-gray-700">Includes every selected measure, the date window, source editions, display mode and axis treatment.</p>
    <div className="mt-2 flex gap-4 text-sm font-semibold"><button type="button" onClick={() => download("csv")} className="underline">CSV</button><button type="button" onClick={() => download("json")} className="underline">JSON</button></div>
    {error ? <p role="status" className="mt-2 text-sm text-accent">{error}</p> : null}
  </section>;
}

export default function ComparisonStudio({ catalog, measures, initial, initialError }: { catalog: MeasureCatalog; measures: MeasureRecord[]; initial: Workspace | null; initialError: string | null }) {
  const [ids, setIds] = useState(initial?.measureIds ?? []);
  const [window, setWindow] = useState<DateWindow>(initial?.window ?? { start: "2020-01-01", end: new Date().toISOString().slice(0, 10) });
  const [mode, setMode] = useState<"panels" | "overlay">(initial?.mode ?? "panels");
  const [error, setError] = useState(initialError);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<NamedComparisonWorkspace[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [savedError, setSavedError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const lastWorkspaceUrl = useRef<string | null>(null);
  const selected = ids.flatMap((id) => measures.filter((measure) => measure.id === id));
  const workspaceCatalog = catalog;
  const compatible = selected.length > 1 && selected.every((measure, index) => index === 0 || compareEligibility(selected[0], measure) === "overlay");
  const activeMode: "panels" | "overlay" = mode === "overlay" && compatible ? "overlay" : "panels";
  const safeWindow = useMemo(() => window.start <= window.end ? window : { start: window.end, end: window.start }, [window]);
  const workspaceExport = useMemo(() => selected.length ? buildExportPackage({
    title: "Selected public measures",
    measures: selected,
    dateWindow: safeWindow,
    comparison: {
      displayMode: activeMode,
      transformations: activeMode === "overlay"
        ? ["Shared observed-date axis and shared vertical scale including zero and fitted to selected observations.", "Source values retain their published units; no rebasing or rescaling is applied."]
        : ["Separate measure panels use independent vertical scales.", "Source values retain their published units; no rebasing or rescaling is applied."],
    },
  }) : null, [activeMode, safeWindow, selected]);
  const visibleMeasures = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-GB");
    return measures.filter((measure) => !query || `${measure.label} ${measure.basis} ${measure.publisher ?? ""} ${measure.geography.label} ${measure.unit} ${measure.cadence}`.toLocaleLowerCase("en-GB").includes(query));
  }, [measures, search]);
  useEffect(() => {
    if (lastWorkspaceUrl.current === null && initial === null) {
      const current = `${globalThis.window.location.pathname}${globalThis.window.location.search}`;
      try {
        const restored = parseWorkspace(globalThis.window.location.search, catalog);
        setIds(restored.measureIds);
        setWindow(restored.window);
        setMode(restored.mode);
        setError(null);
        const canonical = workspaceUrl(restored);
        if (current !== canonical) globalThis.window.history.replaceState(globalThis.window.history.state, "", canonical);
        lastWorkspaceUrl.current = canonical;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The comparison URL is invalid.");
        lastWorkspaceUrl.current = current;
      }
      return;
    }
    const workspace = { version: 1 as const, measureIds: ids, window, mode: activeMode };
    const url = workspaceUrl(workspace);
    const current = `${globalThis.window.location.pathname}${globalThis.window.location.search}`;
    if (current !== url) {
      if (lastWorkspaceUrl.current === null) globalThis.window.history.replaceState(globalThis.window.history.state, "", url);
      else globalThis.window.history.pushState(globalThis.window.history.state, "", url);
    }
    lastWorkspaceUrl.current = url;
  }, [activeMode, ids, window, catalog, initial]);
  useEffect(() => {
    function restoreFromHistory() {
      try {
        const restored = parseWorkspace(globalThis.window.location.search, catalog);
        setIds(restored.measureIds);
        setWindow(restored.window);
        setMode(restored.mode);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The comparison URL is invalid.");
      }
    }
    globalThis.window.addEventListener("popstate", restoreFromHistory);
    return () => globalThis.window.removeEventListener("popstate", restoreFromHistory);
  }, [catalog]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(parseNamedComparisonWorkspaces(JSON.parse(raw), workspaceCatalog).workspaces);
    } catch (caught) {
      setSavedError(caught instanceof Error ? `Saved workspaces unavailable: ${caught.message}` : "Saved workspaces are unavailable.");
    } finally {
      setSavedReady(true);
    }
  }, [workspaceCatalog]);
  const toggle = (id: string) => {
    setError(null);
    if (ids.includes(id)) {
      setIds(ids.filter((value) => value !== id));
      return;
    }
    if (ids.length >= MAX_COMPARISON_MEASURES) {
      setError(`This comparison has reached the ${MAX_COMPARISON_MEASURES}-measure share-link limit.`);
      return;
    }
    setIds([...ids, id]);
  };
  const saveNamed = () => {
    const name = workspaceName.trim();
    if (!name) {
      setSavedError("Enter a name for this comparison.");
      return;
    }
    const entry: NamedComparisonWorkspace = {
      id: crypto.randomUUID(),
      name,
      workspace: { version: 1, measureIds: ids, window: safeWindow, mode: activeMode },
      unavailableMeasureIds: [],
    };
    const next = [...saved, entry];
    setSaved(next);
    setWorkspaceName("");
    setSavedError("");
    setSavedNotice(`Saved “${name}” on this device.`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workspaces: next })); }
    catch { setSavedError("Browser storage is blocked or full. This comparison remains available until you leave this page."); }
  };
  const persistSaved = (next: NamedComparisonWorkspace[]) => {
    setSaved(next);
    setSavedError("");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workspaces: next })); }
    catch { setSavedError("Browser storage is blocked or full. This change remains available until you leave this page."); }
  };
  const loadNamed = (entry: NamedComparisonWorkspace) => {
    if (entry.unavailableMeasureIds.length) {
      setSavedError(`“${entry.name}” includes unavailable measures (${entry.unavailableMeasureIds.join(", ")}). Its saved state is preserved; choose available measures before loading it.`);
      return;
    }
    setIds(entry.workspace.measureIds);
    setWindow(entry.workspace.window);
    setMode(entry.workspace.mode);
    setSavedError("");
    setSavedNotice(`Loaded “${entry.name}”.`);
  };
  const exportSaved = () => {
    const blob = new Blob([JSON.stringify({ version: 1, workspaces: saved }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "public-data-comparisons.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  async function importSaved(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Workspace file exceeds the 2 MB import limit.");
      const parsed = parseNamedComparisonWorkspaces(JSON.parse(await file.text()), workspaceCatalog);
      const existingIds = new Set(saved.map(({ id }) => id));
      const incoming = parsed.workspaces.map((entry) => existingIds.has(entry.id) ? { ...entry, id: crypto.randomUUID() } : entry);
      persistSaved([...saved, ...incoming]);
      setSavedNotice(`Imported ${incoming.length} comparison${incoming.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setSavedError(caught instanceof Error ? caught.message : "Could not read this comparison file.");
    }
  }
  return <>
    {activeMode === "overlay" ? <Overlay measures={selected} window={safeWindow}/> : <section aria-label="Comparison figures" className="mb-8 space-y-8">{selected.length ? selected.map((measure) => <EvidenceFigure key={measure.id} measure={measure} title={`${measure.label}: comparison panel`} description={`${measure.basis}. ${measure.geography.label}. Separate source-specific scale.`} window={safeWindow} variant="line" comparison={{ displayMode: "panels", transformations: ["One measure from a multi-measure workspace, shown on its own vertical scale.", "Source values retain their published units; no rebasing or rescaling is applied."] }}/>) : <p className="border-l-4 border-accent bg-white p-5 text-sm">Select one or more measures to see published observations.</p>}</section>}
    {workspaceExport ? <WorkspaceDataDownloads exportPackage={workspaceExport}/> : null}
    <section id="comparison-controls" aria-label="Comparison controls" className="border-y-2 border-foreground bg-white p-4 md:p-6">
      {error ? <p role="alert" className="mb-4 border-l-4 border-accent bg-accent-soft p-3 text-sm">{error}</p> : null}
      <div>
        <p className="text-sm font-extrabold">Selected measures · {ids.length}/{MAX_COMPARISON_MEASURES}</p>
        {selected.length ? <ul aria-label="Selected measures" className="mt-2 flex flex-wrap gap-2">
          {selected.map((measure) => <li key={measure.id}><button type="button" onClick={() => toggle(measure.id)} aria-label={`Remove ${measure.label}`} className="inline-flex min-h-10 items-center gap-2 border border-line-strong bg-surface-warm px-3 text-sm font-semibold hover:bg-accent-soft">{measure.label}<span aria-hidden="true">×</span></button></li>)}
        </ul> : <p className="mt-2 text-sm text-gray-600">Choose a measure from the full catalog below.</p>}
      </div>
      <details className="mt-4 border-t border-line pt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold underline underline-offset-4">Browse {measures.length} available measures</summary>
        <label className="mt-3 grid max-w-xl gap-1 text-sm font-semibold">Find a measure
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, definition, source, unit" className="min-h-11 border border-foreground bg-white px-3" />
        </label>
        <fieldset className="mt-3">
          <legend className="text-sm font-semibold">Choose measures from the current catalog</legend>
          {visibleMeasures.length ? <ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">{visibleMeasures.map((measure) => <li key={measure.id}><label className="flex min-h-12 items-start gap-3 border border-line p-3 text-sm hover:bg-surface-warm"><input type="checkbox" checked={ids.includes(measure.id)} onChange={() => toggle(measure.id)} className="mt-1 size-4 accent-[var(--accent)]"/><span><span className="font-bold">{measure.label}</span><span className="block text-xs text-gray-600">{measure.geography.label} · {measure.unit} · {measure.observationPeriod.label}</span></span></label></li>)}</ul> : <p role="status" className="mt-3 text-sm text-gray-600">No measure matches the search.</p>}
          <p className="mt-3 text-xs text-gray-600">Showing {visibleMeasures.length} of {measures.length} available measures.</p>
        </fieldset>
      </details>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">From<input type="date" value={safeWindow.start} max={safeWindow.end} onChange={(event) => setWindow((value) => ({ ...value, start: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3"/></label><label className="grid gap-1 text-sm font-semibold">To<input type="date" value={safeWindow.end} min={safeWindow.start} onChange={(event) => setWindow((value) => ({ ...value, end: event.target.value }))} className="min-h-11 border border-foreground bg-white px-3"/></label></div>
      <fieldset className="mt-5"><legend className="text-sm font-bold">Display mode</legend><div className="mt-2 flex flex-wrap gap-3"><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" checked={activeMode === "panels"} onChange={() => setMode("panels")} name="comparison-mode"/>Separate panels</label><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" checked={activeMode === "overlay"} disabled={!compatible} onChange={() => setMode("overlay")} name="comparison-mode"/>Overlay comparable series</label></div><p className="mt-2 text-xs text-gray-600">{compatible ? "Selected records share a validated definition and observation basis." : "Overlay disabled: selected measures do not share a validated definition and observation basis. Keep them in separate panels with their own units and scales."}</p></fieldset>
      <p className="mt-4 text-sm">Share this state: <Link className="font-bold underline" href={workspaceUrl({ version: 1, measureIds: ids, window: safeWindow, mode: activeMode })}>open or copy comparison URL</Link></p>
      {ids.length >= MAX_COMPARISON_MEASURES ? <p role="status" className="mt-2 text-sm text-gray-600">Remove a measure to add another.</p> : null}
      <section aria-labelledby="saved-comparisons-heading" className="mt-6 border-t border-line pt-5">
        <p className="eyebrow">Stored in this browser only</p>
        <h2 id="saved-comparisons-heading" className="mt-1 text-xl font-black">Saved comparisons</h2>
        <p className="mt-2 text-sm text-gray-700">Names and measure IDs stay on this device. No values or personal details are saved.</p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); saveNamed(); }}>
          <label className="grid flex-1 gap-1 text-sm font-semibold">Name this comparison
            <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={80} className="min-h-11 min-w-56 border border-foreground bg-white px-3" placeholder="e.g. Regional employment" />
          </label>
          <button type="submit" className="v3-primary-action">Save current state</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={exportSaved} disabled={!saved.length} className="v3-secondary-action disabled:cursor-not-allowed disabled:opacity-50">Export saved comparisons</button>
          <label className="v3-secondary-action cursor-pointer">Import comparisons<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void importSaved(event.target.files?.[0]); event.target.value = ""; }} /></label>
        </div>
        {savedError ? <p role="alert" className="mt-3 text-sm text-accent">{savedError}</p> : null}
        {savedNotice ? <p role="status" className="mt-3 text-sm text-[#08766c]">{savedNotice}</p> : null}
        {!savedReady ? <p role="status" className="mt-3 text-sm text-gray-600">Loading saved comparisons…</p> : null}
        {saved.length ? <ul aria-label="Saved comparisons" className="mt-4 list-none divide-y divide-line border-y border-line p-0">{saved.map((entry) => <li key={entry.id} className="py-4">
          {renameId === entry.id ? <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const name = renameValue.trim(); if (!name) { setSavedError("A saved comparison needs a name."); return; } persistSaved(saved.map((item) => item.id === entry.id ? { ...item, name } : item)); setRenameId(null); setRenameValue(""); setSavedNotice(`Renamed comparison to “${name}”.`); }}>
            <label className="grid flex-1 gap-1 text-sm font-semibold">New name<input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={80} className="min-h-11 min-w-56 border border-foreground bg-white px-3" /></label>
            <button type="submit" className="v3-secondary-action">Save name</button><button type="button" onClick={() => setRenameId(null)} className="min-h-11 px-3 text-sm underline">Cancel</button>
          </form> : <>
            <h3 className="font-bold">{entry.name}</h3>
            <p className="mt-1 text-xs text-gray-600">{entry.workspace.measureIds.length} measures · {entry.workspace.window.start} to {entry.workspace.window.end} · {entry.workspace.mode === "overlay" ? "overlay" : "separate panels"}</p>
            {entry.unavailableMeasureIds.length ? <p className="mt-2 text-sm text-accent">Unavailable in this catalog: {entry.unavailableMeasureIds.join(", ")}. Saved state is preserved.</p> : null}
            <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => loadNamed(entry)} className="v3-secondary-action">Load</button><button type="button" onClick={() => { setRenameId(entry.id); setRenameValue(entry.name); setSavedError(""); }} className="min-h-11 px-3 text-sm font-semibold underline">Rename</button><button type="button" onClick={() => { persistSaved(saved.filter((item) => item.id !== entry.id)); setSavedNotice(`Deleted “${entry.name}”.`); }} className="min-h-11 px-3 text-sm font-semibold underline">Delete</button></div>
          </>}
        </li>)}</ul> : <p className="mt-4 text-sm text-gray-600">No comparisons saved on this device yet.</p>}
      </section>
    </section>
  </>;
}
