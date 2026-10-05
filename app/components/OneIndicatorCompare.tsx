"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { MeasureCatalog, MeasureRecord } from "@/app/lib/measureCatalog";
import { availableMeasures } from "@/app/lib/measureCatalog";
import { resolveOneIndicator } from "@/app/lib/oneIndicatorCompare";

function formatValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return "Current value unavailable";
  const absolute = Math.abs(value);
  const digits = absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2;
  return `${value.toLocaleString("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}

export default function OneIndicatorCompare({
  catalog,
}: {
  catalog: MeasureCatalog | null;
}) {
  const choices = useMemo(() => {
    if (!catalog) return [] as MeasureRecord[];
    return availableMeasures(catalog).filter((measure) => measure.availability === "current");
  }, [catalog]);

  const [selectedId, setSelectedId] = useState(choices[0]?.id ?? "");
  const [submittedId, setSubmittedId] = useState(choices[0]?.id ?? "");
  const result = useMemo(() => resolveOneIndicator(catalog, submittedId || null), [catalog, submittedId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedId(selectedId.trim());
  }

  return (
    <section
      aria-labelledby="one-indicator-heading"
      className="mb-8 border-y-2 border-foreground bg-white p-5 md:p-7"
    >
      <p className="eyebrow">Compare · one indicator</p>
      <h2 id="one-indicator-heading" className="mt-2 text-3xl font-black tracking-[-0.02em] md:text-4xl">
        Compare one indicator
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700 md:text-base">
        Start with a single published measure. Overlay a second series only when the definition, unit, cadence and geography match. Country peers stay unavailable while UK-in-context is offline.
      </p>

      {choices.length === 0 ? (
        <p role="status" className="mt-5 border border-black/20 bg-[#fff8ef] p-4 text-sm leading-6 text-gray-700">
          No current catalog measures are available to compare. This door will not invent a figure.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-bold">
            Indicator
            <select
              name="indicator"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="min-h-11 border border-foreground bg-white px-3 text-sm font-normal"
            >
              {choices.map((measure) => (
                <option key={measure.id} value={measure.id}>
                  {measure.label} ({measure.geography.label})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center border border-foreground bg-[#14243b] px-5 text-sm font-bold text-white"
          >
            Compare
          </button>
        </form>
      )}

      {result.status === "no-catalog" || result.status === "no-current-measure" ? (
        <p role="status" className="mt-5 border border-black/20 bg-white p-4 text-sm leading-6 text-gray-700">
          {result.status === "no-catalog"
            ? "No validated measure catalog is available for comparison."
            : `Current value unavailable${result.query ? ` for “${result.query}”` : ""}.`}
        </p>
      ) : null}

      {result.status === "ready" ? (
        <div className="mt-5 space-y-4">
          <article className="border border-black/20 bg-[#fff8ef] p-4 md:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Selected indicator</p>
            <h3 className="mt-1 text-2xl font-extrabold">{result.primary.label}</h3>
            <p className="mt-2 text-4xl font-black tabular-nums tracking-[-0.03em]">
              {formatValue(result.primary.value, result.primary.unit)}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              {result.primary.geographyLabel} · {result.primary.periodLabel}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-600">
              Source:{" "}
              <a
                href={result.primary.sourceUrl}
                className="font-semibold underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                open publisher page
              </a>
            </p>
            <Link
              href={result.studioUrl}
              prefetch={false}
              className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              Open this indicator in the comparison studio →
            </Link>
          </article>

          <div className="border border-black/20 bg-white p-4 md:p-5">
            <h3 className="text-lg font-extrabold">Compatible overlay peers</h3>
            {result.overlayPeers.length === 0 ? (
              <p role="status" className="mt-2 text-sm leading-6 text-gray-700">
                No other current series shares this validated definition. Keep the indicator in its own panel; do not overlay incompatible measures.
              </p>
            ) : (
              <ul className="mt-3 list-none space-y-2 p-0">
                {result.overlayPeers.map((peer) => (
                  <li key={peer.id}>
                    <Link
                      href={`/compare/?version=1&measure=${encodeURIComponent(`${result.primary.id},${peer.id}`)}&mode=overlay`}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                    >
                      Overlay with {peer.label}
                    </Link>
                    <span className="mt-1 block text-xs text-gray-600">
                      {peer.geographyLabel} · {peer.periodLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div role="status" className="border border-amber-700 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">Country peers</p>
            <p className="mt-2">{result.countryPeersReason}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
