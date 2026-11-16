"use client";

import { useId, useMemo, useState } from "react";
import type { DirectoryCategory, DirectoryCoverage, DirectoryEntry } from "@/app/lib/govDataDirectory";

const NATION_FILTERS = ["All", "England", "Scotland", "Wales", "Northern Ireland"] as const;
type NationFilter = (typeof NATION_FILTERS)[number];

// A UK-wide service also serves each nation; GB excludes Northern Ireland.
const COVERS: Record<DirectoryCoverage, readonly NationFilter[]> = {
  UK: ["England", "Scotland", "Wales", "Northern Ireland"],
  GB: ["England", "Scotland", "Wales"],
  England: ["England"],
  "England and Wales": ["England", "Wales"],
  Scotland: ["Scotland"],
  Wales: ["Wales"],
  "Northern Ireland": ["Northern Ireland"],
};

export function filterDirectory(categories: readonly DirectoryCategory[], query: string, nation: NationFilter): DirectoryCategory[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (entry: DirectoryEntry) => {
    if (nation !== "All" && !COVERS[entry.coverage].includes(nation)) return false;
    if (!terms.length) return true;
    const haystack = `${entry.name} ${entry.publisher} ${entry.description} ${entry.access.join(" ")}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };
  return categories
    .map((category) => {
      const categoryHit = terms.length > 0 && terms.every((term) => `${category.title} ${category.summary}`.toLowerCase().includes(term));
      return { ...category, entries: category.entries.filter((entry) => (categoryHit && (nation === "All" || COVERS[entry.coverage].includes(nation))) || matches(entry)) };
    })
    .filter((category) => category.entries.length > 0);
}

function EntryCard({ entry }: { entry: DirectoryEntry }) {
  return (
    <li className="flex flex-col bg-white p-5 text-[#14243b]" data-directory-entry={entry.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-lg font-semibold leading-tight tracking-[-0.01em]">
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="!text-[#14243b] underline decoration-black/25 underline-offset-4 hover:!text-[#b4232f] focus-visible:!text-[#b4232f]"
          >
            {entry.name}
            <span className="sr-only"> (opens the {entry.publisher} website)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        </h4>
        {entry.owner === "independent" ? (
          <span className="bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">Independent tool</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{entry.publisher}</p>
      <p className="mt-3 flex-1 text-sm leading-6 text-gray-700">{entry.description}</p>
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#d3dae1] pt-3 text-xs text-gray-600">
        <div className="flex gap-1">
          <dt className="font-semibold">Covers</dt>
          <dd>{entry.coverage}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-semibold">Access</dt>
          <dd>{entry.access.join(", ")}</dd>
        </div>
      </dl>
    </li>
  );
}

export default function GovDataDirectory({ categories }: { categories: readonly DirectoryCategory[] }) {
  const [query, setQuery] = useState("");
  const [nation, setNation] = useState<NationFilter>("All");
  const searchId = useId();
  const visible = useMemo(() => filterDirectory(categories, query, nation), [categories, query, nation]);
  const count = visible.reduce((sum, category) => sum + category.entries.length, 0);

  return (
    <div>
      <div className="border-y border-[#14243b] bg-[#f7f9fb] p-4 text-[#14243b] md:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label htmlFor={searchId} className="eyebrow mb-2 block">Search the directory</label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try ‘house prices’, ‘schools’, ‘crime’ or ‘API’"
              className="min-h-11 w-full border border-[#14243b] bg-white px-3 text-base text-[#14243b] placeholder:text-gray-500"
              autoComplete="off"
            />
          </div>
          <fieldset>
            <legend className="eyebrow mb-2">Where you live</legend>
            <div className="flex flex-wrap gap-1">
              {NATION_FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={nation === option}
                  onClick={() => setNation(option)}
                  className={`min-h-11 border px-3 text-sm font-semibold ${nation === option ? "border-[#14243b] bg-[#14243b] text-white" : "border-[#aab4bf] bg-white text-[#14243b] hover:border-[#14243b]"}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="mt-3 text-sm text-gray-600" role="status" aria-live="polite">
          {count} {count === 1 ? "place" : "places"} to find data{nation !== "All" ? ` covering ${nation}` : ""}{query ? ` matching ‘${query}’` : ""}.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 border border-[#d3dae1] bg-white p-6 text-sm leading-6 text-[#14243b]">
          Nothing matches. Try a broader word, or start with{" "}
          <a href="https://www.data.gov.uk/" target="_blank" rel="noreferrer" className="font-semibold !text-[#14243b] underline underline-offset-4">data.gov.uk</a>{" "}
          or a freedom of information request.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {visible.map((category) => (
            <section key={category.id} aria-labelledby={`directory-${category.id}`} data-directory-category={category.id}>
              <div className="mb-4 border-b border-[var(--line-strong)] pb-3">
                <h3 id={`directory-${category.id}`} className="font-display text-2xl leading-tight md:text-3xl">{category.title}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">{category.summary}</p>
              </div>
              <ul className="grid gap-px border border-[#d3dae1] bg-[#d3dae1] md:grid-cols-2 xl:grid-cols-3 [&>li:last-child:nth-child(3n+1)]:xl:col-span-3 [&>li:last-child:nth-child(3n+2)]:xl:col-span-2">
                {category.entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
