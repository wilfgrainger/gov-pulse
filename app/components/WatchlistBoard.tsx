"use client";

import { useEffect, useMemo, useState } from "react";
import type { MeasureCatalog, MeasureRecord } from "@/app/lib/measureCatalog";
import { selectMeasure } from "@/app/lib/measureCatalog";
import { parseWatchlist, type Watchlist } from "@/app/lib/watchlist";

const STORAGE_KEY = "public-data.org:watchlist:v1";

export default function WatchlistBoard({ catalog, measures }: { catalog: MeasureCatalog; measures: MeasureRecord[] }) {
  const [watchlist, setWatchlist] = useState<Watchlist>({ version: 1, measureIds: [] });
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setNow(Date.now());
      setReady(true);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setWatchlist(parseWatchlist(JSON.parse(stored), catalog));
      } catch (caught) {
        setError(caught instanceof Error ? `Saved list unavailable: ${caught.message}` : "Saved list is unavailable.");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [catalog]);

  useEffect(() => {
    const deadlines = watchlist.measureIds.flatMap((id) => {
      const measure = catalog.measures[id];
      return measure?.availability === "current" && measure.validUntil ? [Date.parse(measure.validUntil)] : [];
    }).filter((deadline) => Number.isFinite(deadline) && deadline > Date.now());
    const nextDeadline = deadlines.length ? Math.min(...deadlines) : null;
    const timeout = nextDeadline === null ? null : window.setTimeout(() => setNow(Date.now()), Math.max(0, nextDeadline - Date.now()));
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { if (timeout !== null) window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [catalog, now, watchlist.measureIds]);

  const save = (next: Watchlist) => {
    setWatchlist(next);
    setError("");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setError("Browser storage is blocked. This list will remain in memory until you leave this page."); }
  };
  const toggle = (id: string) => {
    const nextIds = watchlist.measureIds.includes(id)
      ? watchlist.measureIds.filter((measureId) => measureId !== id)
      : watchlist.measureIds.length < 50 ? [...watchlist.measureIds, id] : watchlist.measureIds;
    if (nextIds.length === watchlist.measureIds.length && !watchlist.measureIds.includes(id)) {
      setError("A watchlist can contain at most 50 measures.");
      return;
    }
    save({ version: 1, measureIds: nextIds });
  };
  const visibleMeasures = measures.filter((measure) => `${measure.label} ${measure.geography.label} ${measure.unit}`.toLowerCase().includes(filter.toLowerCase().trim()));
  const followed = useMemo(() => watchlist.measureIds.map((id) => ({ id, record: selectMeasure(catalog, id, new Date(now || 0)) })), [catalog, now, watchlist.measureIds]);

  async function importFile(file: File | undefined) {
    if (!file) return;
    try { save(parseWatchlist(JSON.parse(await file.text()), catalog)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read this watchlist file."); }
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(watchlist, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "public-data-watchlist.json"; anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
    <section aria-labelledby="watchlist-heading" className="border-y-2 border-foreground bg-white p-5 md:p-8">
      <p className="eyebrow">This device only</p><h2 id="watchlist-heading" className="mt-2 text-3xl font-black">Follow measures</h2>
      <p className="mt-3 text-sm leading-6 text-gray-700">Your selections stay in this browser. The saved file contains measure IDs only, never current values or personal details.</p>
      <label className="mt-5 grid gap-1 text-sm font-semibold">Find a measure<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search measures" className="min-h-11 border border-foreground bg-white px-3"/></label>
      <ul className="mt-4 max-h-[34rem] list-none divide-y divide-line overflow-y-auto p-0">{visibleMeasures.map((measure) => <li key={measure.id}><label className="flex min-h-12 items-start gap-3 py-3 text-sm"><input type="checkbox" checked={watchlist.measureIds.includes(measure.id)} onChange={() => toggle(measure.id)} className="mt-1 size-4 accent-[var(--accent)]"/><span><span className="font-bold">{measure.label}</span><span className="block text-xs text-gray-600">{measure.geography.label} · {measure.unit} · {measure.observationPeriod.label}</span></span></label></li>)}</ul>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={exportFile} className="v3-secondary-action">Export IDs</button><label className="v3-secondary-action cursor-pointer">Import IDs<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }}/></label><button type="button" onClick={() => save({ version: 1, measureIds: [] })} className="min-h-11 px-3 text-sm font-semibold underline">Clear list</button></div>
      {!ready ? <p className="mt-3 text-xs text-gray-600">Loading this device&apos;s saved list…</p> : null}
      {error ? <p role="status" className="mt-3 text-sm text-accent">{error}</p> : null}
    </section>
    <section aria-labelledby="followed-heading" className="border-y-2 border-foreground bg-surface-warm p-5 md:p-8"><p className="eyebrow">Deadline checked in this browser</p><h2 id="followed-heading" className="mt-2 text-3xl font-black">Your measures</h2>
      {followed.length ? <ul className="mt-4 list-none divide-y divide-line p-0">{followed.map(({ id, record }) => <li key={id} className="py-4">{record ? <><p className="font-bold">{record.label}</p><p className="mt-1 text-2xl font-black tabular-nums">{record.availability === "current" ? `${record.value} ${record.unit}` : "Historical edition"}</p><p className="mt-1 text-xs text-gray-600">{record.observationPeriod.label} · source edition {record.sourceEditionId}</p></> : <><p className="font-bold">{catalog.measures[id]?.label ?? id}</p><p className="mt-1 text-sm text-accent">Current value expired or unavailable</p></>}</li>)}</ul> : <p className="mt-4 text-sm text-gray-700">Choose measures to build your on-device board.</p>}
    </section>
  </div>;
}
