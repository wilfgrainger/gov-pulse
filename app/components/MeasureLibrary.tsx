"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
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

export default function MeasureLibrary({ measures, initialSearch = "" }: { measures: MeasureLibraryItem[]; initialSearch?: string }) {
  const pathname = usePathname();
  const search = useSyncExternalStore(subscribeToSearch, currentSearch, () => initialSearch);
  const filters = filtersFrom(search);

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
            <input value={filters.q} onChange={(event) => changeFilter("q", event.target.value)} type="search" className="min-h-11 w-full border border-foreground bg-white px-3 sm:w-80" placeholder="Name, definition, source or gap" />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {(["topic", "publisher", "geography", "cadence", "unit", "availability"] as const).map((key) => (
            <label key={key} className="grid gap-1 text-xs font-bold capitalize">
              <span>{key === "cadence" ? "Frequency" : key}</span>
              <select value={filters[key]} onChange={(event) => changeFilter(key, event.target.value)} className="min-h-10 border border-foreground bg-white px-2 text-sm font-normal">
                <option value="">All {FILTER_PLURALS[key]}</option>
                {filterOptions(measures, key).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
      <p className="mb-3 text-sm text-gray-600" role="status">Showing {filtered.length} of {measures.length} measures. Unavailable entries remain listed with their evidence status.</p>
      {filtered.length ? <ul className="grid list-none gap-px border border-line-strong bg-line-strong p-0 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const measure = item.record;
          const value = measure?.value === null || measure?.value === undefined ? null : formatMeasure(measure.value, item.unit);
          return <li key={item.id} className="min-w-0 bg-white">
            <Link href={`/measure/${encodeURIComponent(item.id)}/`} className="group flex h-full min-h-56 flex-col p-5 transition-colors hover:bg-surface-warm focus-visible:relative">
              <p className="eyebrow">{item.topic} · {AVAILABILITY_LABEL[item.availability]} · {item.publisher}</p>
              <h3 className="mt-3 text-xl font-extrabold leading-tight group-hover:text-accent">{item.label}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-700">{measure?.basis ?? item.basis}</p>
              {value ? <p className="mt-4 text-2xl font-black tabular-nums">{value}</p> : <p className="mt-4 text-sm font-semibold text-gray-700">{item.availabilityReason ?? "No value is available in this edition."}</p>}
              <p className="mt-3 text-xs font-semibold text-gray-600">{item.geography} · {item.unit} · {item.cadence}</p>
              <p className="mt-2 font-mono text-xs text-gray-600">{measure?.observationPeriod.label ?? "No verified observation period"}</p>
              <span className="mt-auto pt-4 text-sm font-bold underline decoration-accent/40 underline-offset-4">Inspect evidence →</span>
            </Link>
          </li>;
        })}
      </ul> : <p role="status" className="border border-line p-6 text-sm">No measure matches the selected filters.</p>}
    </section>
  );
}
