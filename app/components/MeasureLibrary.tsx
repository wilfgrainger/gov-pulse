"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MeasureRecord } from "@/app/lib/measureCatalog";

export default function MeasureLibrary({ measures }: { measures: MeasureRecord[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-GB");
    return measures.filter((measure) =>
      !term || `${measure.label} ${measure.unit} ${measure.basis} ${measure.geography.label} ${measure.sourceId}`
        .toLocaleLowerCase("en-GB").includes(term)
    );
  }, [measures, query]);

  return (
    <section aria-labelledby="measure-library-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-4">
        <div>
          <p className="eyebrow">Evidence catalog</p>
          <h2 id="measure-library-heading" className="mt-1 text-3xl font-black tracking-tight">{measures.length} registered measures</h2>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          <span>Filter measures</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" className="min-h-11 w-full border border-foreground bg-white px-3 sm:w-80" placeholder="Name, unit, geography or source" />
        </label>
      </div>
      {filtered.length ? <ul className="grid list-none gap-px border border-line-strong bg-line-strong p-0 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((measure) => <li key={measure.id} className="min-w-0 bg-white">
          <Link href={`/measure/${encodeURIComponent(measure.id)}/`} className="group block h-full min-h-48 p-5 transition-colors hover:bg-surface-warm focus-visible:relative">
            <p className="eyebrow">{measure.evidenceClass.replaceAll("-", " ")} · {measure.availability}</p>
            <h3 className="mt-3 text-xl font-extrabold leading-tight group-hover:text-accent">{measure.label}</h3>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-700">{measure.basis}</p>
            <p className="mt-4 text-xs font-semibold text-gray-600">{measure.geography.label} · {measure.unit} · {measure.cadence}</p>
            <p className="mt-2 font-mono text-xs text-gray-600">{measure.observationPeriod.label}</p>
            <span className="mt-3 inline-block text-xs text-gray-600">Source record: {measure.sourceId}</span>
            <span className="mt-4 inline-block text-sm font-bold underline decoration-accent/40 underline-offset-4">Inspect evidence →</span>
          </Link>
        </li>)}
      </ul> : <p role="status" className="border border-line p-6 text-sm">No registered measure matches “{query}”.</p>}
    </section>
  );
}
