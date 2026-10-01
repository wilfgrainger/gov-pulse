"use client";

import { useId, useMemo, useState } from "react";

export type IndicatorPoint = {
  date: string;
  value: number;
};

export type IndicatorSeries = {
  id: string;
  title: string;
  shortTitle: string;
  unit: string;
  currentValue: number;
  previousValue: number | null;
  annualDelta: number | null;
  observationPeriod: string;
  publisher: string;
  seriesCode: string;
  history: IndicatorPoint[];
  color: string;
};

interface EconomicPulseGridProps {
  series: IndicatorSeries[];
}

function Sparkline({ points, color, height = 48, width = 160 }: { points: IndicatorPoint[]; color: string; height?: number; width?: number }) {
  if (!points || points.length < 2) return null;

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const paddingY = 4;
  const usableHeight = height - paddingY * 2;

  const coordinates = points.map((p, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - paddingY - ((p.value - minVal) / range) * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${coordinates.join(" L ")}`;
  const lastCoord = coordinates[coordinates.length - 1].split(",");

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastCoord[0]}
        cy={lastCoord[1]}
        r="3.5"
        fill={color}
        stroke="#ffffff"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function EconomicPulseGrid({ series }: EconomicPulseGridProps) {
  const compId = useId();
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);

  const activeSeries = useMemo(() => {
    return series.find((s) => s.id === activeSeriesId) ?? null;
  }, [activeSeriesId, series]);

  if (!Array.isArray(series) || series.length === 0) return null;

  return (
    <div className="border border-black/20 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-baseline md:justify-between">
        <div>
          <span className="inline-block rounded-xs bg-[#0f172a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            Visual 3 · Macro Indicators Tracker
          </span>
          <h4 id={`${compId}-title`} className="mt-2 text-xl font-bold tracking-tight text-gray-950 md:text-2xl">
            UK Macro Economic Pulse: 4 Key Series
          </h4>
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            Official publication-point indicators tracked side-by-side with separate observation clocks and primary publisher provenance.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-500">
          Updated with latest primary releases
        </span>
      </div>

      {/* 4-Card Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {series.map((item) => {
          const delta = item.previousValue !== null ? item.currentValue - item.previousValue : null;
          const isSelected = activeSeriesId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => setActiveSeriesId(isSelected ? null : item.id)}
              className={`flex flex-col justify-between rounded-xs border p-4 transition-all cursor-pointer ${
                isSelected
                  ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-500"
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {item.seriesCode}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {item.observationPeriod}
                  </span>
                </div>

                <h5 className="mt-1 text-sm font-bold text-slate-900 line-clamp-1">
                  {item.shortTitle}
                </h5>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-extrabold tabular-nums text-slate-950">
                    {item.currentValue.toFixed(1)}%
                  </span>
                  {delta !== null && (
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        delta > 0
                          ? "text-red-700"
                          : delta < 0
                            ? "text-emerald-700"
                            : "text-slate-500"
                      }`}
                    >
                      {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}% MoM
                    </span>
                  )}
                </div>
              </div>

              {/* Sparkline & Publisher Footer */}
              <div className="mt-4 pt-3 border-t border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">
                    12-mo trend
                  </span>
                  <Sparkline points={item.history.slice(-12)} color={item.color} width={90} height={28} />
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                  {item.publisher}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded History Inspector */}
      {activeSeries && (
        <div className="mt-5 rounded-xs border border-blue-200 bg-blue-50/30 p-4">
          <div className="flex items-baseline justify-between">
            <h5 className="font-bold text-blue-950">
              {activeSeries.title} ({activeSeries.seriesCode}) Historical Publication Points
            </h5>
            <span className="font-mono text-xs font-semibold text-blue-800">
              Source: {activeSeries.publisher}
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-2">
              {activeSeries.history.slice(-12).map((point) => (
                <div key={point.date} className="rounded-xs bg-white border border-blue-100 p-2 text-center min-w-[70px]">
                  <span className="block font-mono text-[10px] text-slate-500">{point.date}</span>
                  <span className="block font-mono text-sm font-bold text-slate-900 mt-0.5">{point.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Units: Percentage (%) as officially published</span>
        <span>Independent time series: ONS CPI D7G7, BoE IUDBEDR, ONS MGSX, ONS A3WW</span>
      </div>
    </div>
  );
}
