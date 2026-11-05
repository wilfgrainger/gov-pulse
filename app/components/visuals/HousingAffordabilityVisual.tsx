"use client";

import { useId, useMemo, useState } from "react";

export type HousingSeriesPoint = {
  /** Source period label exactly as published. */
  period: string;
  /** Period-end timestamp (ms) used to space points by date. */
  observedAt: number;
  /** Annual percentage change, in percent. */
  value: number;
};

interface HousingAffordabilityVisualProps {
  housePrice: HousingSeriesPoint[];
  realPay: HousingSeriesPoint[];
  hpiPeriod: string;
  wagesPeriod: string;
}

const WIDTH = 500;
const HEIGHT = 140;
const MAX_POINTS = 12;

const SERIES = {
  housePrice: {
    id: "house-price",
    label: "House price annual change",
    source: "ONS UK House Price Index",
    colour: "#6366f1",
  },
  realPay: {
    id: "real-pay",
    label: "Real regular pay growth",
    source: "ONS Average Weekly Earnings (CPIH-deflated)",
    colour: "#1d4ed8",
  },
} as const;

function cleanSeries(points: HousingSeriesPoint[] | undefined) {
  if (!Array.isArray(points)) return [];
  return points
    .filter(
      (p) =>
        p &&
        typeof p.period === "string" &&
        p.period !== "" &&
        Number.isFinite(p.observedAt) &&
        Number.isFinite(p.value)
    )
    .sort((a, b) => a.observedAt - b.observedAt)
    .slice(-MAX_POINTS);
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function periodRange(points: HousingSeriesPoint[]) {
  if (points.length === 0) return "Unavailable";
  const first = points[0].period;
  const last = points[points.length - 1].period;
  return first === last ? first : `${first} to ${last}`;
}

export default function HousingAffordabilityVisual({
  housePrice,
  realPay,
  hpiPeriod,
  wagesPeriod,
}: HousingAffordabilityVisualProps) {
  const chartId = useId();
  const [showTable, setShowTable] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const hpiPoints = useMemo(() => cleanSeries(housePrice), [housePrice]);
  const payPoints = useMemo(() => cleanSeries(realPay), [realPay]);
  const hasData = hpiPoints.length > 0 || payPoints.length > 0;

  const scale = useMemo(() => {
    const all = [...hpiPoints, ...payPoints];
    const values = all.map((p) => p.value);
    const times = all.map((p) => p.observedAt);
    const minVal = (values.length ? Math.min(...values, 0) : 0) - 1;
    const maxVal = (values.length ? Math.max(...values, 0) : 0) + 1;
    const minT = times.length ? Math.min(...times) : 0;
    const maxT = times.length ? Math.max(...times) : 0;
    const x = (t: number) => (maxT === minT ? WIDTH / 2 : ((t - minT) / (maxT - minT)) * WIDTH);
    const y = (v: number) => HEIGHT - ((v - minVal) / (maxVal - minVal)) * HEIGHT;
    return { minVal, maxVal, x, y };
  }, [hpiPoints, payPoints]);

  const path = (points: HousingSeriesPoint[]) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scale.x(p.observedAt).toFixed(1)} ${scale.y(p.value).toFixed(1)}`)
      .join(" ");

  const latestHpi = hpiPoints[hpiPoints.length - 1] ?? null;
  const latestPay = payPoints[payPoints.length - 1] ?? null;
  const active = activeKey
    ? [...hpiPoints.map((p) => ({ s: SERIES.housePrice, p })), ...payPoints.map((p) => ({ s: SERIES.realPay, p }))].find(
        ({ s, p }) => `${s.id}:${p.period}` === activeKey
      )
    : null;

  const renderSeries = (
    spec: typeof SERIES.housePrice | typeof SERIES.realPay,
    points: HousingSeriesPoint[],
    latest: HousingSeriesPoint | null,
    cardPeriod: string
  ) => (
    <div
      role="group"
      aria-label={spec.label}
      className="rounded-xs border border-slate-200 bg-slate-50/60 p-3.5"
    >
      <span className="font-mono text-[11px] font-semibold uppercase" style={{ color: spec.colour }}>
        {spec.label}
      </span>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
        {latest ? formatPercent(latest.value) : "Unavailable"}
      </p>
      <p className="mt-0.5 text-xs text-slate-700">
        Latest period: {latest ? latest.period : cardPeriod}
      </p>
      <p className="text-xs text-slate-700">Plotted periods: {periodRange(points)}</p>
      <p className="text-xs text-slate-700">Unit: percent, annual change</p>
      <p className="text-xs text-slate-700">Source: {spec.source}</p>
    </div>
  );

  const tableFor = (
    spec: typeof SERIES.housePrice | typeof SERIES.realPay,
    points: HousingSeriesPoint[]
  ) => (
    <table className="min-w-full divide-y divide-black/10 text-left text-xs">
      <caption className="py-2 text-left text-xs font-bold text-slate-800">
        {spec.label} (percent, annual change) · Source: {spec.source}
      </caption>
      <thead>
        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          <th scope="col" className="px-3 py-2">Period</th>
          <th scope="col" className="px-3 py-2 text-right">Annual change (%)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {points.length === 0 ? (
          <tr>
            <td className="px-3 py-2 text-slate-500">Unavailable</td>
            <td className="px-3 py-2 text-right text-slate-500">Unavailable</td>
          </tr>
        ) : (
          points.map((p) => (
            <tr key={p.period}>
              <th scope="row" className="px-3 py-2 font-medium text-slate-900">{p.period}</th>
              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{formatPercent(p.value)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  const zeroY = scale.minVal < 0 && scale.maxVal > 0 ? scale.y(0) : null;

  return (
    <div className="border border-black/20 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-baseline md:justify-between">
        <div>
          <span className="inline-block rounded-xs bg-[#0f172a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            Two separate ONS measures
          </span>
          <h4 id={`${chartId}-title`} className="mt-2 text-xl font-bold tracking-tight text-gray-950 md:text-2xl">
            House prices and real pay: separate annual changes
          </h4>
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            Each series is published on its own basis and period. They are shown side by side on a shared date axis and are not subtracted, indexed or combined. Latest house price period: {hpiPeriod}; latest pay period: {wagesPeriod}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          aria-expanded={showTable}
        >
          {showTable ? "Hide data tables" : "View screen-reader tables"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {renderSeries(SERIES.housePrice, hpiPoints, latestHpi, hpiPeriod)}
        {renderSeries(SERIES.realPay, payPoints, latestPay, wagesPeriod)}
      </div>

      {hasData && (
        <div className="mt-6" aria-hidden={showTable ? "true" : undefined}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: SERIES.realPay.colour }} />
                Real regular pay growth (% annual)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: SERIES.housePrice.colour }} />
                House price annual change (% annual, dashed)
              </span>
            </div>
            {active && (
              <span className="font-mono text-xs text-slate-600" aria-live="polite">
                {active.s.label}, {active.p.period}: {formatPercent(active.p.value)}
              </span>
            )}
          </div>

          <div className="relative h-44 w-full rounded-xs border border-slate-200 bg-slate-50 p-2">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
              {zeroY !== null && (
                <line x1="0" y1={zeroY} x2={WIDTH} y2={zeroY} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" />
              )}
              {payPoints.length > 1 && (
                <path fill="none" stroke={SERIES.realPay.colour} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d={path(payPoints)} />
              )}
              {hpiPoints.length > 1 && (
                <path fill="none" stroke={SERIES.housePrice.colour} strokeWidth="2.5" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" d={path(hpiPoints)} />
              )}
              {([
                [SERIES.realPay, payPoints],
                [SERIES.housePrice, hpiPoints],
              ] as const).flatMap(([spec, points]) =>
                points.map((p) => {
                  const key = `${spec.id}:${p.period}`;
                  const on = activeKey === key;
                  return (
                    <circle
                      key={key}
                      data-series={spec.id}
                      cx={scale.x(p.observedAt)}
                      cy={scale.y(p.value)}
                      r={on ? 5 : 3}
                      fill={spec.colour}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      tabIndex={0}
                      role="img"
                      aria-label={`${spec.label}, ${p.period}: ${formatPercent(p.value)}`}
                      onMouseEnter={() => setActiveKey(key)}
                      onMouseLeave={() => setActiveKey(null)}
                      onFocus={() => setActiveKey(key)}
                      onBlur={() => setActiveKey(null)}
                    />
                  );
                })
              )}
            </svg>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Horizontal position is proportional to period-end date. Scale includes 0%.
          </p>
        </div>
      )}

      {showTable && (
        <div className="mt-5 space-y-6 overflow-x-auto border-t border-black/15 pt-4">
          {tableFor(SERIES.housePrice, hpiPoints)}
          {tableFor(SERIES.realPay, payPoints)}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Unit: percent (annual change). No derived series.</span>
        <span>Sources: {SERIES.housePrice.source}; {SERIES.realPay.source}</span>
      </div>
    </div>
  );
}
