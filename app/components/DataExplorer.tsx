"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMetricsSnapshot } from "@/app/lib/metricsSnapshot";
import {
  comparePoints,
  exploreMeasures,
  formatMeasure,
  measuresCsv,
  type Measure,
} from "@/app/lib/dataExplorer";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));

function MeasureDetail({ measure }: { measure: Measure }) {
  const [years, setYears] = useState("5");
  const end = measure.history.at(-1)?.date ?? 0;
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - Number(years));
  const points = measure.history.filter(
    (p) => years === "all" || p.date >= start.getTime(),
  );
  const comparison = comparePoints(points, measure.unit);
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  const intervals = points.slice(1).map((point, index) => point.date - points[index].date).sort((a, b) => a - b);
  const typicalInterval = intervals[Math.floor(intervals.length / 2)] || 1;
  const segments: typeof points[] = [];
  points.forEach((point, index) => {
    if (index === 0 || point.date - points[index - 1].date > typicalInterval * 1.7) segments.push([]);
    segments.at(-1)!.push(point);
  });
  const x = (date: number) =>
    105 +
    ((date - (points[0]?.date ?? 0)) / (end - (points[0]?.date ?? 0) || 1)) *
      605;
  const y = (value: number) => 165 - ((value - min) / span) * 120;
  return (
    <section
      aria-labelledby="measure-detail-title"
      className="border-t-4 border-[#172234] bg-white p-5 md:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm text-slate-600">
            {measure.topic} · {measure.geography}
          </p>
          <h2
            id="measure-detail-title"
            className="mt-2 text-2xl font-semibold md:text-3xl"
          >
            {measure.label}
          </h2>
          <p className="mt-4 text-4xl font-semibold tabular-nums">
            {measure.value === null
              ? "Unavailable"
              : formatMeasure(measure.value, measure.unit)}
          </p>
          <p className="mt-2 text-base text-slate-600">
            {measure.period ?? "No verified current value"}
          </p>
          {measure.updateDue && (
            <p className="mt-3 inline-flex border border-amber-700 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
              Newer publication detected · update due
            </p>
          )}
        </div>
        <label className="text-sm font-semibold">
          History window
          <select
            value={years}
            onChange={(event) => setYears(event.target.value)}
            className="mt-2 block min-h-11 border border-slate-400 bg-white px-3 py-2"
          >
            <option value="1">1 year</option>
            <option value="5">5 years</option>
            <option value="10">10 years</option>
            <option value="all">All available</option>
          </select>
        </label>
      </div>
      {points.length > 1 ? (
        <figure className="mt-8 border-y border-slate-200 py-5">
          <svg
            viewBox="0 0 740 225"
            role="img"
            aria-label={`${measure.label}: ${points.length} published observations, in ${measure.unit}, from ${points[0].period} to ${points.at(-1)?.period}. Vertical scale does not start at zero. Exact values in the table below.`}
            className="w-full"
          >
            <text x="8" y="50" fontSize="14" fill="#475569">
              {formatMeasure(max, measure.unit)}
            </text>
            <text x="8" y="170" fontSize="14" fill="#475569">
              {formatMeasure(min, measure.unit)}
            </text>
            {[45, 105, 165].map((tick) => (
              <line key={tick} x1="105" x2="710" y1={tick} y2={tick} stroke="#d8e2dd" />
            ))}
            {segments.map((segment, index) => segment.length > 1 ? (
              <polyline
                key={index}
                points={segment.map((point) => `${x(point.date)},${y(point.value)}`).join(" ")}
                fill="none"
                stroke="#0b6b69"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null)}
            {points.filter((_, index) => points.length < 20 || index === 0 || index === points.length - 1).map((point) => (
              <circle
                key={point.date}
                cx={x(point.date)}
                cy={y(point.value)}
                r={point.date === end ? "5" : "2.5"}
                fill={point.date === end ? "#8a3540" : "#0b6b69"}
              >
                <title>
                  {point.period}: {formatMeasure(point.value, measure.unit)}
                </title>
              </circle>
            ))}
            <text x="105" y="205" fontSize="14" fill="#475569">
              {points[0].period}
            </text>
            <text x="710" y="205" textAnchor="end" fontSize="14" fill="#475569">
              {points.at(-1)?.period}
            </text>
          </svg>
          <figcaption className="text-sm leading-6 text-slate-600">
            Line joins consecutive published observations; gaps are left open. The vertical scale spans{" "}
            {formatMeasure(min, measure.unit)} to{" "}
            {formatMeasure(max, measure.unit)} and does not start at zero. The coral dot marks the latest observation.
          </figcaption>
        </figure>
      ) : (
        <p className="mt-6 border-l-2 border-slate-300 pl-4 text-base text-slate-600">
          {measure.value === null
            ? "This measure will appear when a current, source-linked publication passes validation."
            : "No comparable history is available for this window."}
        </p>
      )}
      {comparison && (
        <div className="mt-6 grid gap-4 border-y border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold">What changed over this window?</h3>
            <p className="mt-2 text-lg tabular-nums">
              {comparison.delta === 0
                ? "No change"
                : `${comparison.delta > 0 ? "+" : "−"}${formatMeasure(Math.abs(comparison.delta), comparison.unit)}`}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {comparison.first.period} to {comparison.last.period}. This is an
              endpoint comparison, not proof of a continuous trend.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">How to read it</h3>
            <p className="mt-2 text-base leading-7 text-slate-700">
              {measure.note}
            </p>
          </div>
        </div>
      )}
      {!comparison && (
        <p className="mt-5 text-base leading-7 text-slate-700">
          {measure.note}
        </p>
      )}
      {measure.publishedAt && (
        <p className="mt-5 text-sm text-slate-600">
          Published {dateLabel(measure.publishedAt)} · {measure.geography}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-5 text-base font-semibold">
        <Link
          href={measure.route}
          prefetch={false}
          className="underline underline-offset-4"
        >
          Full topic and methodology
        </Link>
        {measure.sourceUrl && (
          <a
            href={measure.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Original publication ↗
          </a>
        )}
      </div>
      {points.length > 0 && (
        <details className="mt-6 border-t border-slate-200 pt-4">
          <summary className="cursor-pointer py-2 font-semibold">
            Published observations ({points.length})
          </summary>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="p-2">
                    Period
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Value ({measure.unit})
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.date} className="border-t border-slate-100">
                    <td className="p-2">{p.period}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatMeasure(p.value, measure.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export default function DataExplorer({
  initialSnapshot,
}: {
  initialSnapshot: unknown;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All topics");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      setNow(Date.now());
      fetchMetricsSnapshot()
        .then(({ payload }) => {
          if (active) setSnapshot(payload);
        })
        .catch(() => {
          /* Currentness still re-evaluates retained data. */
        });
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const measures = useMemo(
    () => exploreMeasures(snapshot, new Date(now)),
    [snapshot, now],
  );
  const available = measures.filter((m) => m.value !== null).length;
  const topics = [...new Set(measures.map((m) => m.topic))];
  const filtered = measures
    .filter(
      (m) =>
        (topic === "All topics" || m.topic === topic) &&
        (available === 0 || showUnavailable || m.value !== null) &&
        `${m.label} ${m.topic} ${m.geography} ${m.note}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
    )
    .sort((a, b) => Number(b.value !== null) - Number(a.value !== null));
  const detail = filtered.find((m) => m.id === selected) ?? filtered[0];
  function download() {
    const url = URL.createObjectURL(
      new Blob([measuresCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "public-data-measures.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div>
      <div className="grid gap-4 border-y border-slate-300 bg-white py-5 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="text-sm font-semibold">
          Find a measure
          <input
            type="search"
            placeholder="Try inflation, unemployment or waiting times"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2 block min-h-12 w-full border border-slate-400 px-3 py-2 text-base font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Topic
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-2 block min-h-12 w-full border border-slate-400 bg-white px-3 py-2 text-base font-normal"
          >
            <option>All topics</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button
          onClick={download}
          className="min-h-12 border border-[#172234] bg-[#172234] px-5 py-2 font-semibold text-white"
        >
          Download results CSV
        </button>
      </div>
      {available === 0 && (
        <p className="mt-5 border-l-2 border-amber-700 pl-4 text-sm leading-6 text-slate-700">
          No core measure has a current verified value. The gaps below show what we are checking.
        </p>
      )}
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-slate-600">
          {filtered.length} measures shown · {available} of {measures.length}{" "}
          currently available
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showUnavailable || available === 0}
            disabled={available === 0}
            onChange={(e) => setShowUnavailable(e.target.checked)}
            className="h-4 w-4"
          />
          Show unavailable measures
        </label>
      </div>
      {filtered.length === 0 ? (
        <div className="border border-slate-300 bg-white p-8">
          <h2 className="text-xl font-semibold">No matching measures</h2>
          <p className="mt-3">Try a broader search or another topic.</p>
          <button
            onClick={() => {
              setQuery("");
              setTopic("All topics");
              setShowUnavailable(false);
            }}
            className="mt-4 min-h-11 font-semibold underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.7fr)]">
          <ul
            aria-label="Measures"
            className="max-h-[32rem] overflow-y-auto border border-slate-300 bg-white lg:max-h-[50rem]"
          >
            {filtered.map((m) => (
              <li
                key={m.id}
                className="border-b border-slate-200 last:border-0"
              >
                <button
                  onClick={() => setSelected(m.id)}
                  aria-pressed={detail?.id === m.id}
                  className={`w-full border-l-4 p-4 text-left hover:bg-slate-50 ${detail?.id === m.id ? "border-[#172234] bg-slate-100" : "border-transparent"}`}
                >
                  <span className="block text-sm text-slate-600">
                    {m.topic} · {m.geography}
                  </span>
                  <span className="mt-1 block text-base font-semibold">
                    {m.label}
                  </span>
                  <span
                    className={`mt-2 block text-xl tabular-nums ${m.value === null ? "text-slate-500" : "font-semibold"}`}
                  >
                    {m.value === null
                      ? "Unavailable"
                      : formatMeasure(m.value, m.unit)}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {m.period ?? "Awaiting verified evidence"}
                  </span>
                  {m.updateDue && <span className="mt-2 block text-xs font-semibold text-amber-800">Newer publication detected</span>}
                </button>
              </li>
            ))}
          </ul>
          {detail && <MeasureDetail key={detail.id} measure={detail} />}
        </div>
      )}
    </div>
  );
}
