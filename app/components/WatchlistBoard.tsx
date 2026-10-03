"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MeasureCatalog, MeasureRecord } from "@/app/lib/measureCatalog";
import { selectMeasure } from "@/app/lib/measureCatalog";
import { buildWatchEvidenceReference, compareWatchEvidence, parseWatchEvidenceBaselines, parseWatchlist, type WatchEvidenceBaselines, type WatchEvidenceState, type Watchlist } from "@/app/lib/watchlist";

const STORAGE_KEY = "public-data.org:watchlist:v1";
const EVIDENCE_KEY = "public-data.org:watchlist-evidence:v1";

const evidenceStateLabels: Record<WatchEvidenceState, string> = {
  "first-visit": "Tracking starts with this visit.",
  changed: "Evidence changed since your last visit.",
  "edition-only": "New source edition; tracked evidence unchanged.",
  unchanged: "No tracked evidence change since your last visit.",
  unavailable: "Current evidence is unavailable; no comparison was made.",
};

export default function WatchlistBoard({ catalog, measures }: { catalog: MeasureCatalog; measures: MeasureRecord[] }) {
  const [watchlist, setWatchlist] = useState<Watchlist>({ version: 1, measureIds: [] });
  const [evidenceBaselines, setEvidenceBaselines] = useState<WatchEvidenceBaselines>({ version: 1, measures: {} });
  const [evidenceStates, setEvidenceStates] = useState<Record<string, WatchEvidenceState>>({});
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const activeIds = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => { void initialize(); });
    async function initialize() {
      try {
        let stored: string | null = null;
        try { stored = localStorage.getItem(STORAGE_KEY); }
        catch { setError("Browser storage is blocked. Changes will stay in memory until you leave this page."); }
        let next = stored ? parseWatchlist(JSON.parse(stored), catalog) : { version: 1 as const, measureIds: [] };
        let previousBaselines: WatchEvidenceBaselines = { version: 1, measures: {} };
        try {
          const rawBaselines = localStorage.getItem(EVIDENCE_KEY);
          if (rawBaselines) previousBaselines = parseWatchEvidenceBaselines(JSON.parse(rawBaselines), catalog);
        } catch { /* A damaged local change ledger does not invalidate the ID-only watchlist. */ }
        const requestedId = new URLSearchParams(window.location.search).get("follow");
        if (requestedId) {
          const requested = catalog.measures[requestedId];
          if (!requested) {
            setError("This measure is no longer present in the validated catalog, so it was not added.");
          } else if (next.measureIds.includes(requestedId)) {
            setNotice(`${requested.label} is already on your watchlist.`);
          } else {
            next = { version: 1, measureIds: [...next.measureIds, requestedId] };
            setNotice(`${requested.label} was added to your watchlist on this device.`);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
            catch { setError("Browser storage is blocked. This measure will remain followed in memory until you leave this page."); }
          }
          const url = new URL(window.location.href);
          url.searchParams.delete("follow");
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        }
        const nextBaselines: WatchEvidenceBaselines = { version: 1, measures: {} };
        const nextStates: Record<string, WatchEvidenceState> = {};
        for (const id of next.measureIds) {
          let current = null;
          try { current = await buildWatchEvidenceReference(selectMeasure(catalog, id, new Date())); }
          catch { current = null; }
          nextStates[id] = compareWatchEvidence(previousBaselines.measures[id], current);
          if (current) nextBaselines.measures[id] = current;
          else if (previousBaselines.measures[id]) nextBaselines.measures[id] = previousBaselines.measures[id];
        }
        if (!active) return;
        activeIds.current = new Set(next.measureIds);
        setWatchlist(next);
        setEvidenceBaselines(nextBaselines);
        setEvidenceStates(nextStates);
        setNow(Date.now());
        setReady(true);
        try { localStorage.setItem(EVIDENCE_KEY, JSON.stringify(nextBaselines)); }
        catch { setError("Browser storage is blocked. Change tracking will stay in memory until you leave this page."); }
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? `Saved list unavailable: ${caught.message}` : "Saved list is unavailable.");
      }
    }
    return () => { active = false; window.cancelAnimationFrame(frame); };
  }, [catalog]);

  useEffect(() => {
    const deadlines = watchlist.measureIds.flatMap((id) => {
      const measure = catalog.measures[id];
      return measure?.availability === "current" && measure.validUntil ? [Date.parse(measure.validUntil)] : [];
    }).filter((deadline) => Number.isFinite(deadline) && deadline > Date.now());
    const nextDeadline = deadlines.length ? Math.min(...deadlines) : null;
    const timeout = nextDeadline === null ? null : window.setTimeout(() => setNow(Date.now()), Math.min(2_147_000_000, Math.max(0, nextDeadline - Date.now())));
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { if (timeout !== null) window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [catalog, now, watchlist.measureIds]);

  const save = (next: Watchlist) => {
    setWatchlist(next);
    setError("");
    const nextIds = new Set(next.measureIds);
    activeIds.current = nextIds;
    const nextBaselines: WatchEvidenceBaselines = {
      version: 1,
      measures: Object.fromEntries(Object.entries(evidenceBaselines.measures).filter(([id]) => nextIds.has(id))),
    };
    const nextStates = Object.fromEntries(Object.entries(evidenceStates).filter(([id]) => nextIds.has(id))) as Record<string, WatchEvidenceState>;
    for (const id of next.measureIds) {
      if (nextBaselines.measures[id]) continue;
      nextStates[id] = "first-visit";
      void buildWatchEvidenceReference(selectMeasure(catalog, id, new Date())).then((reference) => {
        if (!reference) {
          setEvidenceStates((current) => ({ ...current, [id]: "unavailable" }));
          return;
        }
        setEvidenceBaselines((current) => {
          if (!activeIds.current.has(id)) return current;
          const updated = { version: 1 as const, measures: { ...current.measures, [id]: reference } };
          try { localStorage.setItem(EVIDENCE_KEY, JSON.stringify(updated)); }
          catch { setError("Browser storage is blocked. Change tracking will stay in memory until you leave this page."); }
          return updated;
        });
      }).catch(() => setEvidenceStates((current) => ({ ...current, [id]: "unavailable" })));
    }
    setEvidenceBaselines(nextBaselines);
    setEvidenceStates(nextStates);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setError("Browser storage is blocked. This list will remain in memory until you leave this page."); }
    try { localStorage.setItem(EVIDENCE_KEY, JSON.stringify(nextBaselines)); }
    catch { setError("Browser storage is blocked. Change tracking will stay in memory until you leave this page."); }
  };
  const toggle = (id: string) => {
    const nextIds = watchlist.measureIds.includes(id)
      ? watchlist.measureIds.filter((measureId) => measureId !== id)
      : [...watchlist.measureIds, id];
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
      <p className="mt-3 text-sm leading-6 text-gray-700">Your selections and compact change fingerprints stay in this browser. The saved file contains measure IDs only, never current values or personal details.</p>
      {notice ? <p role="status" className="mt-3 border-l-2 border-[#08766c] pl-3 text-sm">{notice}</p> : null}
      <label className="mt-5 grid gap-1 text-sm font-semibold">Find a measure<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search measures" className="min-h-11 border border-foreground bg-white px-3"/></label>
      <ul className="mt-4 max-h-[34rem] list-none divide-y divide-line overflow-y-auto p-0">{visibleMeasures.map((measure) => <li key={measure.id}><label className="flex min-h-12 items-start gap-3 py-3 text-sm"><input type="checkbox" checked={watchlist.measureIds.includes(measure.id)} onChange={() => toggle(measure.id)} className="mt-1 size-4 accent-[var(--accent)]"/><span><span className="font-bold">{measure.label}</span><span className="block text-xs text-gray-600">{measure.geography.label} · {measure.unit} · {measure.observationPeriod.label}</span></span></label></li>)}</ul>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={exportFile} className="v3-secondary-action">Export IDs</button><label className="v3-secondary-action cursor-pointer">Import IDs<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }}/></label><button type="button" onClick={() => save({ version: 1, measureIds: [] })} className="min-h-11 px-3 text-sm font-semibold underline">Clear list</button></div>
      {!ready ? <p className="mt-3 text-xs text-gray-600">Loading this device&apos;s saved list…</p> : null}
      {error ? <p role="status" className="mt-3 text-sm text-accent">{error}</p> : null}
    </section>
    <section aria-labelledby="followed-heading" className="border-y-2 border-foreground bg-surface-warm p-5 md:p-8"><p className="eyebrow">Deadline checked in this browser</p><h2 id="followed-heading" className="mt-2 text-3xl font-black">Your measures</h2>
      {followed.length ? <ul className="mt-4 list-none divide-y divide-line p-0">{followed.map(({ id, record }) => <li key={id} className="py-4">{record ? <><p className="font-bold">{record.label}</p><p className="mt-1 text-2xl font-black tabular-nums">{record.availability === "current" ? `${record.value} ${record.unit}` : "Historical edition"}</p><p className="mt-1 text-xs text-gray-600">{record.observationPeriod.label} · source edition {record.sourceEditionId}</p></> : <><p className="font-bold">{catalog.measures[id]?.label ?? id}</p><p className="mt-1 text-sm text-accent">Current value expired or unavailable</p></>}<p className="mt-2 text-xs text-gray-700">{ready ? evidenceStateLabels[evidenceStates[id] ?? "unavailable"] : "Checking for a previous visit…"}</p></li>)}</ul> : <p className="mt-4 text-sm text-gray-700">Choose measures to build your on-device board.</p>}
    </section>
  </div>;
}
