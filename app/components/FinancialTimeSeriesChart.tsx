"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import ClientOnlyChart from "@/app/components/ClientOnlyChart";
import ObservationTable from "@/app/components/charts/ObservationTable";
import { METRICS_SNAPSHOT_PATH } from "@/app/lib/config";
import { visibleChartEvents } from "@/app/lib/chartEvents";
import type { ChartMetadata } from "@/app/lib/chartExport";

export type FinancialChartPoint = {
  observedAt: number;
  period: string;
  [key: string]: string | number | null;
};

export type FinancialChartSeries = {
  key: string;
  label: string;
  color: string;
  lineType?: "linear" | "stepAfter";
  dashed?: boolean;
};

export function addCadenceBreaks(data: FinancialChartPoint[]): FinancialChartPoint[] {
  if (data.length < 3) return data;
  const intervals = data.slice(1).map((point, index) => point.observedAt - data[index].observedAt)
    .filter((interval) => Number.isFinite(interval) && interval > 0)
    .sort((a, b) => a - b);
  const typical = intervals[Math.floor(intervals.length / 2)];
  if (!typical) return data;
  const result: FinancialChartPoint[] = [];
  for (const [index, point] of data.entries()) {
    const previous = data[index - 1];
    if (previous && point.observedAt - previous.observedAt > typical * 1.7) {
      result.push({ observedAt: previous.observedAt + 1, period: "Gap in published observations" });
    }
    result.push(point);
  }
  return result;
}

type Props = {
  title: string;
  description: string;
  data: FinancialChartPoint[];
  series: FinancialChartSeries[];
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  referenceValue?: number;
  referenceLabel?: string;
  downloadLabel?: string;
  /** Publisher, source URL, publication date, period and caveat for exported images. */
  citation?: string;
  heightClass?: string;
  /**
   * Show curated event markers (vertical reference lines) for known UK
   * events that fall within this chart's visible date range. Defaults to
   * true; set false for a chart where a date marker would not be meaningful.
   * Markers are descriptive date labels only -- never a causal claim about
   * this series.
   */
  showEvents?: boolean;
};

function formatAxisDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatTooltipDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function FinancialTimeSeriesChart({
  title,
  description,
  data,
  series,
  valueFormatter,
  axisFormatter = valueFormatter,
  referenceValue,
  referenceLabel,
  downloadLabel = "Download published data (JSON)",
  citation,
  heightClass = "h-[300px]",
  showEvents = true,
}: Props) {
  const first = data.at(0);
  const latest = data.at(-1);
  const chartValues = data.flatMap((point) => series.flatMap((entry) => {
    const value = point[entry.key];
    return typeof value === "number" && Number.isFinite(value) ? [value] : [];
  }));
  const domainMin = Math.min(...chartValues, referenceValue ?? Number.POSITIVE_INFINITY);
  const domainMax = Math.max(...chartValues, referenceValue ?? Number.NEGATIVE_INFINITY);
  const domainSpan = domainMax - domainMin || Math.max(Math.abs(domainMax) * 0.02, 1);
  const axisMin = chartValues.length ? domainMin - domainSpan * 0.08 : 0;
  const axisMax = chartValues.length ? domainMax + domainSpan * 0.08 : 1;
  const range =
    first && latest ? `${first.period} to ${latest.period}` : "Published history unavailable";
  const chartMetadata: ChartMetadata = {
    schemaVersion: 1,
    title,
    sourceCitation: citation ?? "Source details unavailable in this publication.",
    observationWindow: {
      start: first ? { period: first.period, observedAt: Number.isFinite(first.observedAt) ? new Date(first.observedAt).toISOString() : null } : null,
      end: latest ? { period: latest.period, observedAt: Number.isFinite(latest.observedAt) ? new Date(latest.observedAt).toISOString() : null } : null,
    },
    series: series.map(({ key, label }) => ({ key, label })),
    caveats: [description],
  };
  const events =
    showEvents && first && latest
      ? visibleChartEvents(first.observedAt, latest.observedAt)
      : [];
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartData = addCadenceBreaks(data);

  // Keyboard-navigable scrubber: ArrowLeft/ArrowRight move a "current index"
  // through the published data points, driving a vertical reference line, a
  // visible period/value readout, and an aria-live announcement for screen
  // reader users. This is purely additive -- mouse hover keeps using
  // Recharts' own Tooltip, and the scrubber state defaults to "nothing
  // selected" so it never changes what a non-keyboard reader sees.
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const liveRegionId = useId();
  const scrubPoint = scrubIndex !== null ? data[scrubIndex] : undefined;

  const moveScrub = (delta: number) => {
    if (data.length === 0) return;
    setScrubIndex((current) => {
      const base = current === null ? (delta > 0 ? -1 : data.length) : current;
      const next = base + delta;
      return Math.min(Math.max(next, 0), data.length - 1);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveScrub(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveScrub(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setScrubIndex(data.length ? 0 : null);
    } else if (event.key === "End") {
      event.preventDefault();
      setScrubIndex(data.length ? data.length - 1 : null);
    } else if (event.key === "Escape") {
      setScrubIndex(null);
    }
  };

  const scrubAnnouncement = scrubPoint
    ? `${formatTooltipDate(scrubPoint.observedAt)}: ${series
        .map((entry) => {
          const value = scrubPoint[entry.key];
          return `${entry.label} ${typeof value === "number" ? valueFormatter(value) : "not available"}`;
        })
        .join(", ")}`
    : "";

  return (
    <figure className="border-y border-black/20 bg-[#f7f9fb] py-5">
      <figcaption className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h4 className="text-xl font-semibold tracking-[-0.015em]">{title}</h4>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">{description}</p>
        </div>
        <p className="font-mono text-xs tabular-nums text-gray-500">{range}</p>
      </figcaption>
      <div
        ref={chartContainerRef}
        role="group"
        aria-roledescription="interactive chart"
        tabIndex={0}
        aria-label={`${title}. ${description}. Period shown: ${range}.${
          events.length
            ? ` Marked reference dates: ${events.map((e) => e.label).join("; ")}.`
            : ""
        } Focus and use the left and right arrow keys to scrub through each published point; Home and End jump to the first and last point.`}
        aria-describedby={scrubPoint ? liveRegionId : undefined}
        onKeyDown={handleKeyDown}
        className="border-t border-black/10 pt-3 focus:outline-2 focus:outline-offset-2 focus:outline-[#14243b]"
      >
        <p
          id={liveRegionId}
          aria-live="polite"
          className="sr-only"
        >
          {scrubAnnouncement}
        </p>
        {scrubPoint ? (
          <p
            aria-hidden="true"
            className="mb-2 px-1 font-mono text-xs tabular-nums text-[#14243b]"
          >
            {formatTooltipDate(scrubPoint.observedAt)} &mdash;{" "}
            {series
              .map((entry) => {
                const value = scrubPoint[entry.key];
                return `${entry.label}: ${typeof value === "number" ? valueFormatter(value) : "not available"}`;
              })
              .join(" · ")}
          </p>
        ) : null}
        <ClientOnlyChart heightClass={heightClass}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 640, height: 300 }}
          >
            <LineChart data={chartData} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#d3dae1" strokeDasharray="2 4" />
              <XAxis
                dataKey="observedAt"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatAxisDate}
                tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: "#586170" }}
                axisLine={{ stroke: "#111827", strokeWidth: 1 }}
                tickLine={false}
                tickCount={6}
                minTickGap={44}
              />
              <YAxis
                tickFormatter={axisFormatter}
                tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: "#586170" }}
                axisLine={false}
                tickLine={false}
                width={62}
                domain={[axisMin, axisMax]}
              />
              {referenceValue !== undefined ? (
                <ReferenceLine
                  y={referenceValue}
                  stroke="#8892a0"
                  strokeDasharray="4 4"
                  label={
                    referenceLabel
                      ? { value: referenceLabel, position: "insideTopRight", fontSize: 10, fill: "#586170" }
                      : undefined
                  }
                />
              ) : null}
              {events.map((event) => (
                <ReferenceLine
                  key={event.id}
                  x={event.timestamp}
                  stroke="#b8bfc8"
                  strokeDasharray="3 3"
                  ifOverflow="visible"
                  label={{
                    value: event.label,
                    position: "insideTopLeft",
                    angle: -90,
                    fontSize: 9,
                    fill: "#8892a0",
                    offset: 6,
                  }}
                >
                  <title>{event.label}</title>
                </ReferenceLine>
              ))}
              {scrubPoint ? (
                <ReferenceLine
                  x={scrubPoint.observedAt}
                  stroke="#14243b"
                  strokeWidth={1.5}
                  ifOverflow="visible"
                  zIndex={500}
                />
              ) : null}
              <Tooltip
                cursor={{ stroke: "#8892a0", strokeWidth: 1 }}
                contentStyle={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  border: "1px solid rgba(20, 36, 59, 0.15)",
                  borderRadius: "4px",
                  background: "rgba(255, 255, 255, 0.85)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
                }}
                labelFormatter={(value) => formatTooltipDate(Number(value))}
                formatter={(value, name) => [
                  typeof value === "number" ? valueFormatter(value) : "Not available",
                  String(name),
                ]}
              />
              {series.map((entry) => (
                <Line
                  key={entry.key}
                  type={entry.lineType ?? "linear"}
                  dataKey={entry.key}
                  name={entry.label}
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeDasharray={entry.dashed ? "5 4" : undefined}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 1, fill: "#fff" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ClientOnlyChart>
      </div>
      {latest ? (
        <p className="sr-only">
          Latest published values for {latest.period}:{" "}
          {series
            .map((entry) => {
              const value = latest[entry.key];
              return `${entry.label}: ${typeof value === "number" ? valueFormatter(value) : "not available"}`;
            })
            .join("; ")}
        </p>
      ) : null}
      <p className="mt-2 px-1 text-xs leading-5 text-gray-600">
        Vertical axis: {axisFormatter(axisMin)} to {axisFormatter(axisMax)}; bounds fitted to these observations, not zero-based.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-gray-600">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {series.map((entry) => (
            <span key={entry.key} className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-5"
                style={entry.dashed
                  ? { borderTop: `2px dashed ${entry.color}` }
                  : { backgroundColor: entry.color }}
              />
              {entry.label}
            </span>
          ))}
          {events.length ? (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-5 border-t border-dashed border-[#8892a0]"
              />
              Marked dates: known UK events, for reference only
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={METRICS_SNAPSHOT_PATH}
            download
            className="font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black"
          >
            {downloadLabel}
          </a>
          <ChartExportButtons
            containerRef={chartContainerRef}
            title={title}
            chartMetadata={chartMetadata}
            citation={[
              citation,
              `Observation period: ${range}`,
              description,
            ].filter(Boolean).join(" · ")}
          />
        </div>
      </div>
      <ObservationTable
        caption={`${title}. ${description} Published observations from ${range}.`}
        rows={data}
        series={series}
        valueFormatter={valueFormatter}
      />
    </figure>
  );
}
