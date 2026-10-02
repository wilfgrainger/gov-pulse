"use client";

import { useId, useMemo, useState } from "react";

export type TrendComparisonPoint = {
  date: string;
  housePriceGrowthPct: number;
  realWageGrowthPct: number | null;
};

interface HousingAffordabilityVisualProps {
  points: TrendComparisonPoint[];
  currentHpiChange: number;
  currentRealWageGrowth: number | null;
  hpiPeriod: string;
  wagesPeriod: string;
}

export default function HousingAffordabilityVisual({
  points,
  currentHpiChange,
  currentRealWageGrowth,
  hpiPeriod,
  wagesPeriod,
}: HousingAffordabilityVisualProps) {
  const chartId = useId();
  const [showTable, setShowTable] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const gap = currentRealWageGrowth !== null && wagesPeriod === hpiPeriod
    ? currentRealWageGrowth - currentHpiChange
    : null;
  const payOutpacing = gap !== null && gap >= 0;

  const validPoints = useMemo(() => {
    return Array.isArray(points) ? points.slice(-12) : [];
  }, [points]);

  const { minVal, maxVal } = useMemo(() => {
    if (validPoints.length === 0) return { minVal: -2, maxVal: 6 };
    const allVals = validPoints.flatMap((p) => [
      p.housePriceGrowthPct,
      ...(p.realWageGrowthPct === null ? [] : [p.realWageGrowthPct]),
    ]);
    return {
      minVal: Math.min(...allVals, 0) - 1,
      maxVal: Math.max(...allVals, 0) + 1,
    };
  }, [validPoints]);

  const activePoint = hoverIndex !== null ? validPoints[hoverIndex] : validPoints[validPoints.length - 1];
  const linePath = (valueFor: (point: TrendComparisonPoint) => number | null) => {
    let connected = false;
    return validPoints.flatMap((point, index) => {
      const value = valueFor(point);
      if (value === null) {
        connected = false;
        return [];
      }
      const x = validPoints.length < 2 ? 250 : (index / (validPoints.length - 1)) * 500;
      const y = 140 - ((value - minVal) / (maxVal - minVal)) * 140;
      const command = `${connected ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      connected = true;
      return [command];
    }).join(" ");
  };

  return (
    <div className="border border-black/20 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-baseline md:justify-between">
        <div>
          <span className="inline-block rounded-xs bg-[#0f172a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            Visual 4 · Living Standards Index
          </span>
          <h4 id={`${chartId}-title`} className="mt-2 text-xl font-bold tracking-tight text-gray-950 md:text-2xl">
            Housing vs Real Pay Growth: The Affordability Gap
          </h4>
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            Official annual percentage changes: ONS UK House Price Index compared with ONS Real-Terms Pay (A3WW).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          aria-expanded={showTable}
        >
          {showTable ? "Hide data table" : "View screen-reader table"}
        </button>
      </div>

      {/* Real-time Gap Card */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xs border border-blue-200 bg-blue-50/40 p-3.5">
          <span className="font-mono text-[11px] font-semibold uppercase text-blue-700">Real Pay Growth (A3WW)</span>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-blue-950">
            {currentRealWageGrowth === null
              ? "Unavailable"
              : `${currentRealWageGrowth > 0 ? "+" : ""}${currentRealWageGrowth.toFixed(1)}%`}
          </p>
          <p className="mt-0.5 text-xs text-blue-800/80">{wagesPeriod} · ONS Earnings</p>
        </div>

        <div className="rounded-xs border border-indigo-200 bg-indigo-50/40 p-3.5">
          <span className="font-mono text-[11px] font-semibold uppercase text-indigo-700">House Price Change (HPI)</span>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-indigo-950">
            {currentHpiChange > 0 ? `+${currentHpiChange.toFixed(1)}%` : `${currentHpiChange.toFixed(1)}%`}
          </p>
          <p className="mt-0.5 text-xs text-indigo-800/80">{hpiPeriod} · ONS UK HPI</p>
        </div>

        <div className={`rounded-xs border p-3.5 ${payOutpacing ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
          <span className={`font-mono text-[11px] font-semibold uppercase ${payOutpacing ? "text-emerald-700" : "text-amber-700"}`}>
            Affordability Momentum
          </span>
          <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${payOutpacing ? "text-emerald-950" : "text-amber-950"}`}>
            {gap === null ? "Unavailable" : `${gap > 0 ? "+" : ""}${gap.toFixed(1)}%`}
          </p>
          <p className="mt-0.5 text-xs text-slate-700">
            {gap === null
              ? "No matching source observation periods"
              : payOutpacing ? "Pay growing faster than house prices" : "House prices growing faster than real pay"}
          </p>
        </div>
      </div>

      {/* Dual Series Chart */}
      {validPoints.length > 0 && (
        <div className="mt-6" aria-hidden={showTable ? "true" : "false"}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-700 inline-block" />
                <span>Real Wages (% annual)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-indigo-500 inline-block" />
                <span>House Price Index (% annual)</span>
              </span>
            </div>
            {activePoint && (
              <span className="font-mono text-xs text-slate-600">
                {activePoint.date}: Pay {activePoint.realWageGrowthPct === null ? "unavailable" : `${activePoint.realWageGrowthPct.toFixed(1)}%`} vs HPI {activePoint.housePriceGrowthPct.toFixed(1)}%
              </span>
            )}
          </div>

          {/* SVG Multi-Line Trend Chart */}
          <div className="relative h-44 w-full bg-slate-50 border border-slate-200 rounded-xs p-2">
            <svg viewBox="0 0 500 140" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              {/* Zero baseline */}
              {minVal < 0 && maxVal > 0 && (
                <line
                  x1="0"
                  y1={140 - ((0 - minVal) / (maxVal - minVal)) * 140}
                  x2="500"
                  y2={140 - ((0 - minVal) / (maxVal - minVal)) * 140}
                  stroke="#cbd5e1"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              )}

              {/* Real Wage line */}
              <path
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d={linePath((point) => point.realWageGrowthPct)}
              />

              {/* HPI line */}
              <path
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeDasharray="4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d={linePath((point) => point.housePriceGrowthPct)}
              />

              {/* Data points */}
              {validPoints.map((p, idx) => {
                const x = (idx / (validPoints.length - 1)) * 500;
                const yWage = p.realWageGrowthPct === null
                  ? null
                  : 140 - ((p.realWageGrowthPct - minVal) / (maxVal - minVal)) * 140;
                const yHpi = 140 - ((p.housePriceGrowthPct - minVal) / (maxVal - minVal)) * 140;
                const isHovered = hoverIndex === idx;

                return (
                  <g key={p.date} onMouseEnter={() => setHoverIndex(idx)} onMouseLeave={() => setHoverIndex(null)}>
                    {yWage !== null ? <circle cx={x} cy={yWage} r={isHovered ? 5 : 3} fill="#1d4ed8" stroke="#ffffff" strokeWidth="1.5" /> : null}
                    <circle cx={x} cy={yHpi} r={isHovered ? 5 : 3} fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between font-mono text-[10px] text-slate-500 mt-1">
            <span>{validPoints[0]?.date}</span>
            <span>{validPoints[validPoints.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Screen-Reader Table */}
      {showTable && (
        <div className="mt-5 overflow-x-auto border-t border-black/15 pt-4">
          <table className="min-w-full divide-y divide-black/10 text-left text-xs">
            <caption className="sr-only">Historical comparison table of real wages and house price index growth</caption>
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <th scope="col" className="px-3 py-2">Period</th>
                <th scope="col" className="px-3 py-2 text-right">Real Wages Growth</th>
                <th scope="col" className="px-3 py-2 text-right">House Price Inflation</th>
                <th scope="col" className="px-3 py-2 text-right">Affordability Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {validPoints.map((point) => {
                const diff = point.realWageGrowthPct === null
                  ? null
                  : point.realWageGrowthPct - point.housePriceGrowthPct;
                return (
                  <tr key={point.date} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{point.date}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-blue-900">
                      {point.realWageGrowthPct === null ? "Unavailable" : `${point.realWageGrowthPct.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-indigo-900">
                      {point.housePriceGrowthPct.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold tabular-nums ${diff === null ? "text-slate-500" : diff >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                      {diff === null ? "Unavailable" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Unit: Annual Percentage Change (%)</span>
        <span>Sources: ONS UK House Price Index + Average Weekly Earnings bulletin</span>
      </div>
    </div>
  );
}
