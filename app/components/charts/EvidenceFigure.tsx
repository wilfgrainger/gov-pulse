"use client";

import { useId, useRef } from "react";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import ObservationTable from "./ObservationTable";
import { buildExportPackage, clipPoints, segmentPoints, timePosition, type DateWindow } from "@/app/lib/chartModel";
import { validateMeasureRecord, type MeasureRecord } from "@/app/lib/measureCatalog";
import { sourceHistoryHref } from "@/app/lib/sourceHistory";
import Link from "next/link";

type Variant = "line" | "step" | "bar" | "dot";

function formatValue(value: number, unit: string) {
  const formatted = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}

function niceBound(value: number, unit: string) {
  return formatValue(value, unit);
}

function axisPeriod(point: MeasureRecord["points"][number]) {
  return point.period.length > 24 ? `${point.period.slice(0, 23)}…` : point.period;
}

export default function EvidenceFigure({
  measure: input,
  title,
  description,
  window,
  variant,
  comparison,
}: {
  measure: MeasureRecord;
  title: string;
  description: string;
  window: DateWindow;
  variant: Variant;
  comparison?: ReturnType<typeof buildExportPackage>["comparison"];
}) {
  const measure = validateMeasureRecord(input);
  const points = clipPoints(measure.points, window);
  const segments = segmentPoints(points, measure.cadence);
  const values = points.flatMap((point) => point.value === null ? [] : [point.value]);
  const includeZero = variant === "bar";
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 1;
  const span = dataMax - dataMin || Math.max(Math.abs(dataMax) * 0.1, 1);
  const padding = span * 0.08;
  const minValue = includeZero ? Math.min(0, dataMin) : dataMin - padding;
  const maxValue = includeZero ? Math.max(0, dataMax) : dataMax + padding;
  const plot = { left: 220, top: 22, width: 542, height: 246 };
  const dates = points.map((point) => Date.parse(`${point.observedAt}T00:00:00.000Z`));
  const dateMin = dates.length ? Math.min(...dates) : 0;
  const dateMax = dates.length ? Math.max(...dates) : 0;
  const xFor = (point: MeasureRecord["points"][number]) =>
    timePosition(Date.parse(`${point.observedAt}T00:00:00.000Z`), dateMin, dateMax, plot.left, plot.width);
  const yFor = (value: number) => plot.top + (maxValue - value) / (maxValue - minValue || 1) * plot.height;
  const zeroY = minValue <= 0 && maxValue >= 0 ? yFor(0) : plot.top + plot.height;
  const pointPositions = new Map(points.map((point) => [`${point.observedAt}:${point.revisionId}`, xFor(point)]));
  const figureId = useId();
  const chartRef = useRef<SVGSVGElement>(null);
  const exportPackage = buildExportPackage({ title, measures: [measure], dateWindow: window, ...(comparison ? { comparison } : {}) });
  const latest = [...points].reverse().find((point) => point.value !== null) ?? null;
  const tickValues = Array.from({ length: 5 }, (_, index) => minValue + (maxValue - minValue) * (4 - index) / 4);
  const intervals = dates.slice(1).map((date, index) => date - dates[index]).filter((interval) => interval > 0).sort((left, right) => left - right);
  const typicalInterval = intervals[Math.floor(intervals.length / 2)];
  const barSpacing = typicalInterval
    ? typicalInterval / Math.max(1, dateMax - dateMin) * plot.width
    : plot.width / Math.max(1, points.length);
  const barWidth = Math.max(2, Math.min(42, barSpacing * 0.62));

  return (
    <figure className="evidence-figure" data-chart-language="public-data" data-chart-variant={variant} aria-labelledby={`${figureId}-title`}>
      <figcaption className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h3 id={`${figureId}-title`} className="text-xl font-semibold tracking-[-0.015em]">{title}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">{description}</p>
        </div>
        <p className="font-mono text-xs tabular-nums text-gray-600">{window.start} to {window.end}</p>
      </figcaption>
      <p className="mb-2 px-1 text-xs text-gray-600">
        {latest ? `Latest observation: ${latest.period}, ${formatValue(latest.value!, measure.unit)}.` : "No numeric observation falls within this window."}
        {measure.availability === "historical" ? " Historical edition." : ""}
      </p>
      <p className="mb-2 px-1 text-xs text-gray-600 sm:hidden">Swipe to inspect the full chart; exact observations are listed in the table below.</p>
      <div className="overflow-x-auto">
        <svg
          ref={chartRef}
          className="h-auto min-w-[38rem] w-full"
          viewBox="0 0 800 360"
          role="img"
          aria-labelledby={`${figureId}-svg-title ${figureId}-svg-description`}
        >
          <title id={`${figureId}-svg-title`}>{title}</title>
          <desc id={`${figureId}-svg-description`}>{description} Vertical axis: {niceBound(minValue, measure.unit)} to {niceBound(maxValue, measure.unit)}.</desc>
          {tickValues.map((value, index) => (
            <g key={index}>
              <line x1={plot.left} x2={plot.left + plot.width} y1={yFor(value)} y2={yFor(value)} stroke="var(--chart-grid, #d7d0c4)" strokeDasharray="2 4" />
              <text x={plot.left - 8} y={yFor(value) + 4} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="11" fill="var(--chart-muted, #5f6771)">{formatValue(value, measure.unit)}</text>
            </g>
          ))}
          {includeZero ? <line x1={plot.left} x2={plot.left + plot.width} y1={zeroY} y2={zeroY} stroke="var(--chart-axis, #202832)" strokeWidth="1.5" /> : null}
          {variant === "bar" ? points.map((point) => point.value === null ? null : (
            <rect key={`${point.observedAt}-${point.revisionId}`} x={xFor(point) - barWidth / 2} y={Math.min(yFor(point.value), zeroY)} width={barWidth} height={Math.max(1, Math.abs(zeroY - yFor(point.value)))} fill="var(--chart-accent, #e8352e)">
              <title>{`${point.period}: ${formatValue(point.value, measure.unit)}`}</title>
            </rect>
          )) : null}
          {(variant === "line" || variant === "step") ? segments.map((segment, index) => {
            const coordinates = segment.flatMap((point) => {
              const x = pointPositions.get(`${point.observedAt}:${point.revisionId}`);
              return x === undefined ? [] : [[x, yFor(point.value!)] as const];
            });
            const path = coordinates.flatMap(([x, y], pointIndex) => {
              if (pointIndex === 0) return [`M ${x} ${y}`];
              const previousY = coordinates[pointIndex - 1][1];
              return variant === "step" ? [`L ${x} ${previousY}`, `L ${x} ${y}`] : [`L ${x} ${y}`];
            }).join(" ");
            return <path key={index} d={path} fill="none" stroke="var(--chart-series, #315f8f)" strokeWidth="3" strokeLinejoin="round" />;
          }) : null}
          {(variant === "dot" || variant === "line" || variant === "step") ? points.map((point) => point.value === null ? null : (
            <circle key={`${point.observedAt}-${point.revisionId}`} cx={xFor(point)} cy={yFor(point.value)} r="4.5" fill="var(--chart-series, #315f8f)" stroke="white" strokeWidth="1.5">
              <title>{`${point.period}: ${formatValue(point.value, measure.unit)}. Source revision identifier ${point.revisionId}.`}</title>
            </circle>
          )) : null}
          {points.length ? <>
            {points.length === 1
              ? <text x={xFor(points[0])} y="295" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fill="var(--chart-muted, #5f6771)"><title>{points[0].period}</title>{axisPeriod(points[0])}</text>
              : <>
                <text x={xFor(points[0])} y="295" textAnchor="start" fontFamily="ui-monospace, monospace" fontSize="11" fill="var(--chart-muted, #5f6771)"><title>{points[0].period}</title>{axisPeriod(points[0])}</text>
                <text x={xFor(points.at(-1)!)} y="295" textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="11" fill="var(--chart-muted, #5f6771)"><title>{points.at(-1)?.period}</title>{axisPeriod(points.at(-1)!)}</text>
              </>}
          </> : <text x="400" y="155" textAnchor="middle" fontSize="15" fill="var(--chart-muted, #5f6771)">No observations in this window</text>}
          <text x="400" y="336" textAnchor="middle" fontSize="12" fill="var(--chart-axis, #202832)">Observation period · {measure.geography.label}</text>
        </svg>
      </div>
      <p className="mt-2 px-1 text-xs leading-5 text-gray-600">
        Source: {description.replace(/[.]$/, "")} · <Link href={sourceHistoryHref(measure)} className="underline">{measure.publisher ?? measure.sourceId}</Link> · edition {measure.sourceEditionId} · published {measure.publishedAt.slice(0, 10)} · <a href={measure.sourceUrl} className="break-all underline">Primary publication</a>
      </p>
      <p className="mt-1 px-1 text-xs leading-5 text-gray-600">{measure.caveats.join(" ")}</p>
      <p className="mt-1 px-1 text-xs leading-5 text-gray-600">Vertical axis: {niceBound(minValue, measure.unit)} to {niceBound(maxValue, measure.unit)}{includeZero ? "; zero baseline shown" : "; bounds fitted to the selected observations"}.</p>
      <div className="mt-3 flex justify-end px-1">
        <ChartExportButtons containerRef={chartRef} exportPackage={exportPackage} />
      </div>
      <ObservationTable measure={measure} points={points} window={window} />
    </figure>
  );
}
