"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  lookupPlace,
  publishedGeographies,
  type PlaceLookupResult,
} from "@/app/lib/placeLookup";

function ResultPanel({ result }: { result: PlaceLookupResult }) {
  if (result.status === "empty-query") {
    return (
      <p className="mt-4 text-sm leading-6 text-gray-700">
        Enter a UK nation or geography the publication already carries — for example United Kingdom, England, or Great Britain. Local-authority and postcode figures are not invented here.
      </p>
    );
  }

  if (result.status === "postcode-unclassified") {
    return (
      <div role="status" className="mt-4 border border-amber-700 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Postcode {result.query} cannot classify a place</p>
        <p className="mt-2">{result.reason}</p>
      </div>
    );
  }

  if (result.status === "no-match") {
    return (
      <div role="status" className="mt-4 border border-black/20 bg-white p-4 text-sm leading-6 text-gray-700">
        <p className="font-semibold">No published geography matched “{result.query}”</p>
        <p className="mt-2">
          This Look up only lists geographies that already appear on verified measures. It does not invent a local authority page or a synthetic place total.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {result.matches.map((match) => (
        <section
          key={match.geography.code}
          aria-labelledby={`place-geo-${match.geography.code}`}
          className="border border-black/20 bg-white p-4 md:p-5"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Published geography</p>
          <h3 id={`place-geo-${match.geography.code}`} className="mt-1 text-xl font-extrabold">
            {match.geography.label}
          </h3>
          <p className="mt-1 font-mono text-xs text-gray-600">Code {match.geography.code}</p>
          {match.measures.length === 0 ? (
            <p role="status" className="mt-3 text-sm text-gray-700">
              Current value unavailable for this geography in the measure library.
            </p>
          ) : (
            <ul className="mt-3 list-none space-y-2 p-0">
              {match.measures.map((measure) => (
                <li key={measure.id}>
                  <Link
                    href={`/measure/${measure.id}/`}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                  >
                    {measure.label}
                  </Link>
                  <span className="mt-1 block text-xs text-gray-600">
                    {measure.unit} · {measure.cadence} · {measure.evidenceClass.replace(/-/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default function PlaceLookup() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const geographies = useMemo(() => publishedGeographies(), []);
  const result = useMemo(() => lookupPlace(submitted), [submitted]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <section aria-labelledby="place-lookup-heading" className="mb-8 border-y-2 border-foreground bg-white p-5 md:p-7">
      <p className="eyebrow">Look up · published geographies only</p>
      <h2 id="place-lookup-heading" className="mt-2 text-3xl font-black tracking-[-0.02em] md:text-4xl">
        Look up a place
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700 md:text-base">
        Search the geographies already attached to verified measures. Buyer and supplier dossiers stay on{" "}
        <Link href="/money/" prefetch={false} className="font-semibold underline underline-offset-4">
          Public money
        </Link>
        ; the full measure library is below.
      </p>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" role="search">
        <label className="grid min-w-0 flex-1 gap-1 text-xs font-bold">
          Place, nation or geography code
          <input
            type="search"
            name="place"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="United Kingdom, England, GB…"
            autoComplete="off"
            className="min-h-11 border border-foreground bg-white px-3 text-sm font-normal"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center border border-foreground bg-[#14243b] px-5 text-sm font-bold text-white"
        >
          Look up
        </button>
      </form>

      <p className="mt-3 text-xs leading-5 text-gray-600">
        Published geographies in this edition:{" "}
        {geographies.map((geography) => geography.label).join(" · ")}
      </p>

      <ResultPanel result={result} />
    </section>
  );
}
