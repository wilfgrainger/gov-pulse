"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { searchEvidence } from "@/app/lib/evidenceSearch";

export default function EvidenceSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const results = useMemo(() => searchEvidence(query), [query]);
  const hasQuery = query.trim().length > 0;
  const showResults = hasQuery && !dismissed;

  function openResults() {
    if (hasQuery) setDismissed(false);
  }

  function focusResult(index: number) {
    resultRefs.current[index]?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (results[0]) resultRefs.current[0]?.click();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setDismissed(false);
      focusResult(0);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
    }
  }

  function handleResultKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      window.location.assign(event.currentTarget.href);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusResult(Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else focusResult(index - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusResult(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusResult(results.length - 1);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
      inputRef.current?.focus();
    }
  }

  return (
    <form role="search" aria-label="Search UK public evidence" onSubmit={submit} className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="global-evidence-search" className="text-sm font-semibold text-black">
          Search UK public evidence
        </label>
        <div className="flex border-2 border-black bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-black">
          <input
            ref={inputRef}
            id="global-evidence-search"
            name="global-evidence-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setDismissed(false);
            }}
            onFocus={openResults}
            onKeyDown={handleInputKeyDown}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-describedby="global-evidence-search-hint global-evidence-search-status"
            aria-controls="global-evidence-search-results"
            className="min-h-12 min-w-0 flex-1 appearance-none px-4 py-3 text-base outline-none"
            placeholder="Try inflation, NHS waiting list, migration or sources"
          />
          <button type="submit" className="min-h-12 shrink-0 border-l-2 border-black bg-black px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white">
            Search
          </button>
        </div>
        <p id="global-evidence-search-hint" className="text-xs leading-5 text-gray-600">
          Search metric titles, public questions, topics and evidence classes. Withdrawn evidence is not presented as a current result.
        </p>
      </div>

      <p id="global-evidence-search-status" aria-live="polite" className="mt-4 text-xs font-semibold text-gray-700">
        {hasQuery ? `${results.length} ${results.length === 1 ? "result" : "results"}` : ""}
      </p>

      <div id="global-evidence-search-results" aria-label="Evidence search results" className="mt-2">
        {showResults && results.length > 0 && (
          <ul className="grid max-h-[min(56vh,30rem)] gap-px overflow-y-auto border border-black/20 bg-black/20 sm:grid-cols-2">
            {results.map((result, index) => (
              <li key={result.id} className="flex bg-white">
                <Link
                  prefetch={false}
                  ref={(element) => {
                    resultRefs.current[index] = element;
                  }}
                  href={result.href}
                  onClick={onNavigate}
                  onKeyDown={(event) => handleResultKeyDown(event, index)}
                  className="group flex min-h-28 w-full flex-col p-4 transition-colors hover:bg-gray-50 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{result.category}</span>
                  <span className="mt-2 text-lg font-semibold tracking-[-0.02em] text-black">{result.title}</span>
                  <span className="mt-1 text-xs leading-5 text-gray-600">{result.description}</span>
                  <span className="mt-auto pt-3 text-[11px] font-semibold text-gray-500">{result.evidenceClass}</span>
                  <span className="mt-2 text-sm font-semibold text-black underline decoration-black/30 underline-offset-4 group-hover:decoration-black">Open evidence →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {showResults && results.length === 0 && (
          <div className="border border-black/20 bg-gray-50 p-4 text-sm leading-6 text-gray-700">
            No supported current evidence matches that search. Try a broader topic or open the source register to see unavailable and withdrawn sections.
          </div>
        )}
      </div>
    </form>
  );
}
