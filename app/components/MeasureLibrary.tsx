"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { formatMeasure } from "@/app/lib/dataExplorer";
import type { MeasureDefinition } from "@/app/lib/measureDefinitions";
import type { MeasureRecord } from "@/app/lib/measureCatalog";

export type MeasureLibraryItem = MeasureDefinition & {
  publisher: string;
  availability: "current" | "historical" | "unavailable";
  observationPeriod: string | null;
  record: MeasureRecord | null;
  availabilityReason: string | null;
};

type Filters = {
  q: string;
  topic: string;
  publisher: string;
  geography: string;
  cadence: string;
  unit: string;
  availability: string;
};

const FILTER_KEYS: (keyof Filters)[] = ["q", "topic", "publisher", "geography", "cadence", "unit", "availability"];
const FILTER_PLURALS: Record<Exclude<keyof Filters, "q">, string> = {
  topic: "topics",
  publisher: "publishers",
  geography: "geographies",
  cadence: "frequencies",
  unit: "units",
  availability: "availability states",
};
const AVAILABILITY_LABEL: Record<MeasureLibraryItem["availability"], string> = {
  current: "Current",
  historical: "Historical",
  unavailable: "Unavailable",
};
const SEARCH_CHANGE_EVENT = "public-data:measure-library-search-change";

function subscribeToSearch(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(SEARCH_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(SEARCH_CHANGE_EVENT, onChange);
  };
}

function currentSearch() { return window.location.search.slice(1); }

function filtersFrom(search: string): Filters {
  const params = new URLSearchParams(search);
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key)?.slice(0, 120) ?? ""])) as Filters;
}

function filterOptions(items: MeasureLibraryItem[], key: Exclude<keyof Filters, "q">) {
  if (key === "availability") return Object.entries(AVAILABILITY_LABEL).map(([value, label]) => ({ value, label }));
  const values = items.map((item) => key === "publisher" ? item.publisher
    : key === "geography" ? item.geography
      : key === "cadence" ? item.cadence
        : key === "unit" ? item.unit : item.topic);
  return [...new Set(values)].toSorted((a, b) => a.localeCompare(b, "en-GB"))
    .map((value) => ({ value, label: value }));
}

function PrimaryFilterGroup({
  label,
  filterKey,
  options,
  value,
  onChange,
}: {
  label: string;
  filterKey: "topic" | "availability";
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (key: "topic" | "availability", value: string) => void;
}) {
  const allLabel = filterKey === "topic" ? "All topics" : "All availability";

  return (
    <fieldset className="measure-filter-group">
      <legend>{label}</legend>
      <div className="measure-filter-chips">
        <button
          type="button"
          className="measure-filter-chip"
          aria-pressed={!value}
          onClick={() => onChange(filterKey, "")}
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="measure-filter-chip"
            aria-pressed={value === option.value}
            onClick={() => onChange(filterKey, value === option.value ? "" : option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function MeasureMiniTrend({ record }: { record: MeasureRecord | null }) {
  const points = record?.points.slice(-12) ?? [];
  const numeric = points.filter((point) => point.value !== null);
  if (numeric.length < 2) return null;

  const values = numeric.map((point) => point.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const times = points.map((point) => Date.parse(point.observedAt));
  const finiteTimes = times.filter(Number.isFinite);
  const minTime = Math.min(...finiteTimes);
  const maxTime = Math.max(...finiteTimes);
  const timeSpan = maxTime - minTime;

  const coordinate = (point: MeasureRecord["points"][number], index: number) => {
    const time = Date.parse(point.observedAt);
    const x = Number.isFinite(time) && Number.isFinite(timeSpan) && timeSpan > 0
      ? ((time - minTime) / timeSpan) * 100
      : (index / Math.max(points.length - 1, 1)) * 100;
    const y = 34 - ((((point.value as number) - min) / span) * 28);
    return [x, y] as const;
  };

  const segments: Array<Array<readonly [number, number]>> = [];
  const dots: Array<readonly [number, number]> = [];
  let current: Array<readonly [number, number]> = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    const coords = coordinate(point, index);
    current.push(coords);
    dots.push(coords);
  });
  if (current.length) segments.push(current);

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="measure-atlas-card__sparkline" aria-hidden="true">
      <line x1="0" x2="100" y1="34" y2="34" stroke="currentColor" opacity="0.14" vectorEffect="non-scaling-stroke" />
      {segments.filter((segment) => segment.length > 1).map((segment, index) => (
        <polyline key={index} points={segment.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      ))}
      {dots.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="2.2" fill="currentColor" />)}
    </svg>
  );
}

function MeasureCard({ item, view }: { item: MeasureLibraryItem; view: "atlas" | "list" }) {
  const measure = item.record;
  const value = measure?.value === null || measure?.value === undefined ? null : formatMeasure(measure.value, item.unit);
  return (
    <li className="min-w-0 bg-white">
      <Link
        href={`/measure/${encodeURIComponent(item.id)}/`}
        data-availability={item.availability}
        className={`measure-atlas-card group flex h-full flex-col focus-visible:relative ${view === "list" ? "measure-atlas-card--list" : ""}`}
      >
        <div className="measure-atlas-card__topline">
          <span>{item.topic}</span>
          <span data-availability-label={item.availability}>{AVAILABILITY_LABEL[item.availability]}</span>
        </div>
        <h3 className="measure-atlas-card__title">{item.label}</h3>
        <p className="measure-atlas-card__publisher">{item.publisher}</p>
        {value ? (
          <>
            <div className="measure-atlas-card__value-row">
              <p className="headline-figure measure-atlas-card__value">{value}</p>
              <MeasureMiniTrend record={measure} />
            </div>
            <p className="measure-atlas-card__period">{measure?.observationPeriod.label}</p>
          </>
        ) : (
          <p className="measure-atlas-card__unavailable">{item.availabilityReason ?? "No value is available in this edition."}</p>
        )}
        <p className="measure-atlas-card__scope">{item.geography} · {item.unit} · {item.cadence}</p>
        <span className="measure-atlas-card__action">Inspect evidence →</span>
      </Link>
    </li>
  );
}

export default function MeasureLibrary({ measures, initialSearch = "" }: { measures: MeasureLibraryItem[]; initialSearch?: string }) {
  const pathname = usePathname();
  const search = useSyncExternalStore(subscribeToSearch, currentSearch, () => initialSearch);
  const filters = filtersFrom(search);
  const [view, setView] = useState<"atlas" | "list">("atlas");

  function changeFilter(key: keyof Filters, value: string) {
    const next = { ...filters, [key]: key === "q" ? value.slice(0, 120) : value };
    const params = new URLSearchParams();
    for (const filterKey of FILTER_KEYS) {
      const filterValue = next[filterKey].trim();
      if (filterValue) params.set(filterKey, filterValue);
    }
    const url = params.size ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(SEARCH_CHANGE_EVENT));
  }

  const filtered = useMemo(() => {
    const term = filters.q.trim().toLocaleLowerCase("en-GB");
    return measures.filter((item) => {
      const record = item.record;
      const matchesText = !term || `${item.label} ${item.topic} ${item.unit} ${record?.basis ?? item.basis} ${item.geography} ${item.publisher} ${item.availabilityReason ?? ""}`
        .toLocaleLowerCase("en-GB").includes(term);
      return matchesText && (!filters.topic || item.topic === filters.topic) &&
        (!filters.publisher || item.publisher === filters.publisher) &&
        (!filters.geography || item.geography === filters.geography) &&
        (!filters.cadence || item.cadence === filters.cadence) &&
        (!filters.unit || item.unit === filters.unit) &&
        (!filters.availability || item.availability === filters.availability);
    });
  }, [filters, measures]);

  return (
    <section aria-labelledby="measure-library-heading">
      <div className="mb-6 border-b-2 border-foreground pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Evidence catalog</p>
            <h2 id="measure-library-heading" className="mt-1 text-3xl font-black tracking-tight">{measures.length} registered measures</h2>
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            <span>Search measures</span>
            <input value={filters.q} onChange={(event) => changeFilter("q", event.target.value)} type="search" className="min-h-11 w-full border border-foreground bg-white px-3 text-[var(--ink)] sm:w-80" placeholder="Name, definition, source or gap" />
          </label>
        </div>
        <div className="measure-filter-primary">
          <PrimaryFilterGroup
            label="Topic"
            filterKey="topic"
            options={filterOptions(measures, "topic")}
            value={filters.topic}
            onChange={changeFilter}
          />
          <PrimaryFilterGroup
            label="Availability"
            filterKey="availability"
            options={filterOptions(measures, "availability")}
            value={filters.availability}
            onChange={changeFilter}
          />
        </div>
        <details
          className="measure-filter-disclosure"
          open={Boolean(filters.publisher || filters.geography || filters.cadence || filters.unit) || undefined}
        >
          <summary>
            <span>Advanced filters</span>
            <span aria-hidden="true">＋</span>
          </summary>
          <div className="measure-filter-advanced">
            {(["publisher", "geography", "cadence", "unit"] as const).map((key) => (
              <label key={key} className="grid min-w-0 gap-1 text-xs font-bold capitalize">
                <span>{key === "cadence" ? "Frequency" : key}</span>
                <select
                  value={filters[key]}
                  onChange={(event) => changeFilter(key, event.target.value)}
                  className="min-h-11 w-full min-w-0 border border-foreground bg-white px-2 text-sm font-normal text-[var(--ink)]"
                >
                  <option value="">All {FILTER_PLURALS[key]}</option>
                  {filterOptions(measures, key).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600" role="status">Showing {filtered.length} of {measures.length} measures. Unavailable definitions remain discoverable but are separated from published evidence.</p>
        <div className="inline-flex border border-foreground bg-white p-1" aria-label="Measure library view">
          <button type="button" aria-label="Atlas view" aria-pressed={view === "atlas"} onClick={() => setView("atlas")} className="measure-view-toggle">Atlas</button>
          <button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className="measure-view-toggle">List</button>
        </div>
      </div>
      {filtered.length ? (
        <div data-testid="measure-results" data-view={view} className="space-y-10">
          {filtered.some((item) => item.availability !== "unavailable") ? (
            <section aria-labelledby="available-measures-heading">
              <div className="measure-atlas-section-heading">
                <p className="eyebrow">Published evidence</p>
                <h3 id="available-measures-heading">Verified and retained measures</h3>
              </div>
              <ul className="measure-atlas-results" data-view={view}>
                {filtered.filter((item) => item.availability !== "unavailable").map((item) => <MeasureCard key={item.id} item={item} view={view} />)}
              </ul>
            </section>
          ) : null}
          {filtered.some((item) => item.availability === "unavailable") ? (
            <section aria-labelledby="unavailable-measures-heading">
              <div className="measure-atlas-section-heading measure-atlas-section-heading--muted">
                <p className="eyebrow">Publication gaps</p>
                <h3 id="unavailable-measures-heading">Unavailable in this edition</h3>
                <p>No older or synthetic value is substituted for missing current evidence.</p>
              </div>
              <ul className="measure-atlas-results measure-atlas-results--unavailable" data-view={view}>
                {filtered.filter((item) => item.availability === "unavailable").map((item) => <MeasureCard key={item.id} item={item} view={view} />)}
              </ul>
            </section>
          ) : null}
        </div>
      ) : <p role="status" className="border border-line p-6 text-sm">No measure matches the selected filters.</p>}
    </section>
  );
}
