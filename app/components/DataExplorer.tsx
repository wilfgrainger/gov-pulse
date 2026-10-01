"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import { fetchMetricsSnapshot } from "@/app/lib/metricsSnapshot";
import {
  comparePoints,
  exploreMeasures,
  formatMeasure,
  measuresCsv,
  type Measure,
} from "@/app/lib/dataExplorer";
import { visibleChartEvents } from "@/app/lib/chartEvents";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));

const WINDOW_VALUES = ["1", "5", "10", "all"] as const;
type WindowValue = (typeof WINDOW_VALUES)[number];
const DEFAULT_WINDOW: WindowValue = "5";
const isWindowValue = (value: string | null): value is WindowValue =>
  value !== null && (WINDOW_VALUES as readonly string[]).includes(value);

function MeasureDetail({
  measure,
  allMeasures,
  years,
  onYearsChange,
  compareId,
  onCompareIdChange,
}: {
  measure: Measure;
  allMeasures: Measure[];
  years: WindowValue;
  onYearsChange: (years: WindowValue) => void;
  compareId: string;
  onCompareIdChange: (compareId: string) => void;
}) {
  const end = measure.history.at(-1)?.date ?? 0;
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - Number(years));
  const points = measure.history.filter(
    (p) => years === "all" || p.date >= start.getTime(),
  );
  const compareMeasure = allMeasures.find((m) => m.id === compareId) ?? null;
  const comparePointsForWindow = compareMeasure
    ? compareMeasure.history.filter(
        (p) => years === "all" || p.date >= start.getTime(),
      )
    : [];
  const comparison = comparePoints(points, measure.unit);
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  const compareMin = comparePointsForWindow.length
    ? Math.min(...comparePointsForWindow.map((p) => p.value))
    : 0;
  const compareMax = comparePointsForWindow.length
    ? Math.max(...comparePointsForWindow.map((p) => p.value))
    : 1;
  const compareSpan = compareMax - compareMin || 1;
  const intervals = points.slice(1).map((point, index) => point.date - points[index].date).sort((a, b) => a - b);
  const typicalInterval = intervals[Math.floor(intervals.length / 2)] || 1;
  const segments: typeof points[] = [];
  points.forEach((point, index) => {
    if (index === 0 || point.date - points[index - 1].date > typicalInterval * 1.7) segments.push([]);
    segments.at(-1)!.push(point);
  });
  const compareIntervals = comparePointsForWindow
    .slice(1)
    .map((point, index) => point.date - comparePointsForWindow[index].date)
    .sort((a, b) => a - b);
  const compareTypicalInterval = compareIntervals[Math.floor(compareIntervals.length / 2)] || 1;
  const compareSegments: typeof comparePointsForWindow[] = [];
  comparePointsForWindow.forEach((point, index) => {
    if (
      index === 0 ||
      point.date - comparePointsForWindow[index - 1].date > compareTypicalInterval * 1.7
    )
      compareSegments.push([]);
    compareSegments.at(-1)!.push(point);
  });
  const windowStart = points[0]?.date ?? 0;
  const windowEnd = end;
  const x = (date: number) =>
    105 +
    ((date - windowStart) / (windowEnd - windowStart || 1)) *
      605;
  const y = (value: number) => 165 - ((value - min) / span) * 120;
  const yCompare = (value: number) => 165 - ((value - compareMin) / compareSpan) * 120;
  const events = visibleChartEvents(windowStart, windowEnd);
  const svgRef = useRef<SVGSVGElement>(null);
  const compareCitation = compareMeasure?.sourceUrl ? `Comparison source: ${compareMeasure.label}` : undefined;

  // Keyboard-navigable scrubber across the plotted points of the currently
  // selected measure (and the compared measure, when present, at the same
  // x-position). Purely additive: mouse users still get the per-point
  // <title> tooltips and the full data table below; nothing here changes
  // comparison, export or URL-sync behaviour.
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const liveRegionId = useId();
  // `years`/`compareId` changes don't remount MeasureDetail (only a measure
  // change does, via the parent's `key={detail.id}`), so clamp defensively
  // rather than let a stale index read past the current window's points.
  const clampedScrubIndex =
    scrubIndex !== null && points.length
      ? Math.min(scrubIndex, points.length - 1)
      : null;
  const scrubPoint = clampedScrubIndex !== null ? points[clampedScrubIndex] : undefined;
  // The compared measure may be sampled on a different cadence, so pick the
  // compare point whose date is closest to the primary scrub point rather
  // than assuming matching indices.
  const scrubComparePoint =
    scrubPoint && comparePointsForWindow.length
      ? comparePointsForWindow.reduce((closest, candidate) =>
          Math.abs(candidate.date - scrubPoint.date) < Math.abs(closest.date - scrubPoint.date)
            ? candidate
            : closest,
        )
      : undefined;

  const moveScrub = (delta: number) => {
    if (points.length === 0) return;
    setScrubIndex((current) => {
      const base = current === null ? (delta > 0 ? -1 : points.length) : current;
      const next = base + delta;
      return Math.min(Math.max(next, 0), points.length - 1);
    });
  };

  const handleChartKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveScrub(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveScrub(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setScrubIndex(points.length ? 0 : null);
    } else if (event.key === "End") {
      event.preventDefault();
      setScrubIndex(points.length ? points.length - 1 : null);
    } else if (event.key === "Escape") {
      setScrubIndex(null);
    }
  };

  const scrubAnnouncement = scrubPoint
    ? `${scrubPoint.period}: ${measure.label} ${formatMeasure(scrubPoint.value, measure.unit)}${
        compareMeasure && scrubComparePoint
          ? `; ${compareMeasure.label} ${scrubComparePoint.period}: ${formatMeasure(scrubComparePoint.value, compareMeasure.unit)}`
          : ""
      }`
    : "";
  return (
    <section
      aria-labelledby="measure-detail-title"
      className="border-t-4 border-[#14243b] bg-white p-5 md:p-8"
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
        <div className="flex flex-wrap items-start gap-4">
          <label className="text-sm font-semibold">
            History window
            <select
              value={years}
              onChange={(event) =>
                onYearsChange(
                  isWindowValue(event.target.value)
                    ? event.target.value
                    : DEFAULT_WINDOW,
                )
              }
              className="mt-2 block min-h-11 border border-slate-400 bg-white px-3 py-2"
            >
              <option value="1">1 year</option>
              <option value="5">5 years</option>
              <option value="10">10 years</option>
              <option value="all">All available</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Compare with&hellip;
            <select
              value={compareId}
              onChange={(event) => onCompareIdChange(event.target.value)}
              className="mt-2 block min-h-11 max-w-[14rem] border border-slate-400 bg-white px-3 py-2"
            >
              <option value="">None</option>
              {allMeasures
                .filter((m) => m.id !== measure.id && m.history.length > 1)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </div>
      {compareMeasure && comparePointsForWindow.length === 0 && (
        <p className="mt-4 border-l-2 border-amber-700 bg-amber-50 py-2 pl-4 text-sm leading-6 text-amber-900">
          {compareMeasure.label} has no published history for this window, so it cannot be
          overlaid here. Its own current value, if any, remains available on its own measure page.
        </p>
      )}
      {points.length > 1 ? (
        <figure className="mt-8 border-y border-slate-200 py-5">
          <svg
            ref={svgRef}
            viewBox="0 0 740 225"
            role="img"
            tabIndex={0}
            onKeyDown={handleChartKeyDown}
            aria-describedby={scrubPoint ? liveRegionId : undefined}
            aria-label={`${measure.label}: ${points.length} published observations, in ${measure.unit}, from ${points[0].period} to ${points.at(-1)?.period}. Vertical scale does not start at zero. Exact values in the table below.${
              compareMeasure && comparePointsForWindow.length > 1
                ? ` Overlaid for comparison: ${compareMeasure.label}, in ${compareMeasure.unit}, independently scaled on its own axis, source cited separately below. Not combined into one value with ${measure.label}.`
                : ""
            }${
              events.length
                ? ` Marked reference dates: ${events.map((e) => e.label).join("; ")}.`
                : ""
            } Focus and use the left and right arrow keys to scrub through each observation; Home and End jump to the first and last point.`}
            className="w-full focus:outline-2 focus:outline-offset-2 focus:outline-[#14243b]"
          >
            {events.map((event) => {
              const ex = x(event.timestamp);
              return (
                <g key={event.id}>
                  <line x1={ex} x2={ex} y1="40" y2="175" stroke="#cbd5e1" strokeDasharray="3 3" />
                  <title>{event.label}</title>
                </g>
              );
            })}
            <text x="8" y="50" fontSize="14" fill="#475569">
              {formatMeasure(max, measure.unit)}
            </text>
            <text x="8" y="170" fontSize="14" fill="#475569">
              {formatMeasure(min, measure.unit)}
            </text>
            {compareMeasure && comparePointsForWindow.length > 1 && (
              <>
                <text x="735" y="50" textAnchor="end" fontSize="12" fill="#9333ea">
                  {formatMeasure(compareMax, compareMeasure.unit)}
                </text>
                <text x="735" y="170" textAnchor="end" fontSize="12" fill="#9333ea">
                  {formatMeasure(compareMin, compareMeasure.unit)}
                </text>
              </>
            )}
            {[45, 105, 165].map((tick) => (
              <line key={tick} x1="105" x2="710" y1={tick} y2={tick} stroke="#d7dfe6" />
            ))}
            {segments.map((segment, index) => segment.length > 1 ? (
              <polyline
                key={index}
                points={segment.map((point) => `${x(point.date)},${y(point.value)}`).join(" ")}
                fill="none"
                stroke="#0f6b63"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null)}
            {compareMeasure &&
              compareSegments.map((segment, index) =>
                segment.length > 1 ? (
                  <polyline
                    key={`compare-${index}`}
                    points={segment
                      .map((point) => `${x(point.date)},${yCompare(point.value)}`)
                      .join(" ")}
                    fill="none"
                    stroke="#9333ea"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null,
              )}
            {points.filter((_, index) => points.length < 20 || index === 0 || index === points.length - 1).map((point) => (
              <circle
                key={point.date}
                cx={x(point.date)}
                cy={y(point.value)}
                r={point.date === end ? "5" : "2.5"}
                fill={point.date === end ? "#1f5c8a" : "#0f6b63"}
              >
                <title>
                  {point.period}: {formatMeasure(point.value, measure.unit)}
                </title>
              </circle>
            ))}
            {compareMeasure &&
              comparePointsForWindow
                .filter(
                  (_, index) =>
                    comparePointsForWindow.length < 20 ||
                    index === 0 ||
                    index === comparePointsForWindow.length - 1,
                )
                .map((point) => (
                  <circle
                    key={`compare-${point.date}`}
                    cx={x(point.date)}
                    cy={yCompare(point.value)}
                    r="2.5"
                    fill="#9333ea"
                  >
                    <title>
                      {point.period}: {formatMeasure(point.value, compareMeasure.unit)}
                    </title>
                  </circle>
                ))}
            <text x="105" y="205" fontSize="14" fill="#475569">
              {points[0].period}
            </text>
            <text x="710" y="205" textAnchor="end" fontSize="14" fill="#475569">
              {points.at(-1)?.period}
            </text>
            {scrubPoint && (
              <g>
                <line
                  x1={x(scrubPoint.date)}
                  x2={x(scrubPoint.date)}
                  y1="40"
                  y2="175"
                  stroke="#14243b"
                  strokeWidth="1.5"
                />
                <circle
                  cx={x(scrubPoint.date)}
                  cy={y(scrubPoint.value)}
                  r="6"
                  fill="#14243b"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                {compareMeasure && scrubComparePoint && (
                  <circle
                    cx={x(scrubComparePoint.date)}
                    cy={yCompare(scrubComparePoint.value)}
                    r="5"
                    fill="#9333ea"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            )}
          </svg>
          <p id={liveRegionId} aria-live="polite" className="sr-only">
            {scrubAnnouncement}
          </p>
          {scrubPoint && (
            <p
              aria-hidden="true"
              className="mt-2 font-mono text-xs tabular-nums text-[#14243b]"
            >
              {scrubPoint.period} &mdash; {measure.label}: {formatMeasure(scrubPoint.value, measure.unit)}
              {compareMeasure && scrubComparePoint
                ? ` · ${compareMeasure.label} (${scrubComparePoint.period}): ${formatMeasure(scrubComparePoint.value, compareMeasure.unit)}`
                : ""}
            </p>
          )}
          <figcaption className="text-sm leading-6 text-slate-600">
            Line joins consecutive published observations; gaps are left open. The vertical scale spans{" "}
            {formatMeasure(min, measure.unit)} to{" "}
            {formatMeasure(max, measure.unit)} and does not start at zero. The coral dot marks the latest observation.
            {events.length ? " Dashed vertical lines mark known UK dates, for reference only." : ""}
          </figcaption>
          <div className="mt-2">
            <ChartExportButtons containerRef={svgRef} title={measure.label} citation={compareCitation} />
          </div>
          {compareMeasure && (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4 border-t border-slate-200 pt-3 text-sm">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-5 border-t-2 border-dashed border-[#9333ea]"
                />
                <span>
                  <strong>{compareMeasure.label}</strong> ({compareMeasure.unit}) — right axis, own scale.
                  {comparePointsForWindow.length === 0 && " No published history in this window."}
                </span>
              </div>
              {compareMeasure.value === null ? (
                <p className="border-l-2 border-amber-700 bg-amber-50 px-3 py-1 text-amber-900">
                  {compareMeasure.label} has no current verified value — shown as unavailable, not hidden.
                </p>
              ) : compareMeasure.sourceUrl ? (
                <p className="text-slate-600">
                  Source for {compareMeasure.label}:{" "}
                  <a
                    href={compareMeasure.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    original publication ↗
                  </a>
                  {compareMeasure.publishedAt
                    ? ` · published ${dateLabel(compareMeasure.publishedAt)}`
                    : ""}
                </p>
              ) : null}
            </div>
          )}
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

function DataExplorerInner({
  initialSnapshot,
}: {
  initialSnapshot: unknown;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All topics");
  const [showUnavailable, setShowUnavailable] = useState(false);

  const rawMeasureParam = searchParams.get("measure");
  const rawCompareParam = searchParams.get("compare");
  const rawWindowParam = searchParams.get("window");

  const [selected, setSelected] = useState<string | null>(
    () => rawMeasureParam,
  );
  const [years, setYears] = useState<WindowValue>(() =>
    isWindowValue(rawWindowParam) ? rawWindowParam : DEFAULT_WINDOW,
  );
  const [compareId, setCompareId] = useState<string>(
    () => rawCompareParam ?? "",
  );

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

  // A compare target only makes sense if it exists, differs from the
  // selected measure, and has comparable history -- the same constraints the
  // "Compare with..." dropdown already enforces. An unknown/stale id (e.g. a
  // bookmarked URL from before a measure was renamed or removed) falls back
  // to "no comparison" rather than breaking the view.
  const validCompareId =
    compareId &&
    detail &&
    compareId !== detail.id &&
    measures.some((m) => m.id === compareId && m.history.length > 1)
      ? compareId
      : "";

  // validCompareId (above) already derives the effective compare target on
  // every render, filtering out ids that don't exist, that match the
  // selected measure, or that have no comparable history -- so a stale raw
  // compareId (e.g. a leftover value after switching measures) never reaches
  // rendering or the URL; it is simply never treated as valid.

  // Reflect selection, compare target and history window in the URL so a
  // specific chart state is shareable/bookmarkable. Uses replace + shallow
  // routing (no scroll reset) so dropdown changes don't flood browser
  // history or trigger a full page refetch.
  useEffect(() => {
    if (!detail) return;
    const params = new URLSearchParams();
    params.set("measure", detail.id);
    if (validCompareId) params.set("compare", validCompareId);
    if (years !== DEFAULT_WINDOW) params.set("window", years);
    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;
    router.replace(next ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  }, [detail, validCompareId, years, pathname, router, searchParams]);

  const selectMeasure = useCallback((id: string) => {
    setSelected(id);
    setCompareId("");
    setYears(DEFAULT_WINDOW);
  }, []);

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
          className="min-h-12 border border-[#14243b] bg-[#14243b] px-5 py-2 font-semibold text-white"
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
                  onClick={() => selectMeasure(m.id)}
                  aria-pressed={detail?.id === m.id}
                  className={`w-full border-l-4 p-4 text-left hover:bg-slate-50 ${detail?.id === m.id ? "border-[#14243b] bg-slate-100" : "border-transparent"}`}
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
          {detail && (
            <MeasureDetail
              key={detail.id}
              measure={detail}
              allMeasures={measures}
              years={years}
              onYearsChange={setYears}
              compareId={validCompareId}
              onCompareIdChange={setCompareId}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function DataExplorer(props: { initialSnapshot: unknown }) {
  return (
    <Suspense fallback={null}>
      <DataExplorerInner {...props} />
    </Suspense>
  );
}
