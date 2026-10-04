"use client";

import { useId, useMemo, useState } from "react";

export type PipelineAward = {
  rank: number;
  key: string;
  title: string;
  buyer: string;
  suppliers: string[];
  awardDate: string;
  amount: number;
  currency: "GBP";
  mainProcurementCategory: string | null;
  framework: boolean;
};

interface MonthlyPipelineProps {
  awards: PipelineAward[];
  totalValue: number;
  valueBasisLabel: string;
}

interface MonthBucket {
  key: string;
  label: string;
  shortLabel: string;
  year: number;
  monthIndex: number;
  totalAmount: number;
  awardCount: number;
  frameworkCount: number;
  largestAward: PipelineAward | null;
  awards: PipelineAward[];
}

function formatCurrency(amount: number, compact = false) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(amount);
}

export default function ContractsMonthlyPipeline({ awards, totalValue, valueBasisLabel }: MonthlyPipelineProps) {
  const chartId = useId();
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const monthlyBuckets = useMemo<MonthBucket[]>(() => {
    if (!Array.isArray(awards) || awards.length === 0) return [];

    const bucketsMap = new Map<string, MonthBucket>();

    for (const award of awards) {
      const date = new Date(award.awardDate);
      if (!Number.isFinite(date.getTime())) continue;

      const year = date.getUTCFullYear();
      const monthIndex = date.getUTCMonth();
      const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

      const formatterLong = new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      const formatterShort = new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      });

      const existing = bucketsMap.get(key) ?? {
        key,
        label: formatterLong.format(date),
        shortLabel: formatterShort.format(date),
        year,
        monthIndex,
        totalAmount: 0,
        awardCount: 0,
        frameworkCount: 0,
        largestAward: null,
        awards: [],
      };

      existing.totalAmount += award.amount;
      existing.awardCount += 1;
      if (award.framework) existing.frameworkCount += 1;
      existing.awards.push(award);

      if (!existing.largestAward || award.amount > existing.largestAward.amount) {
        existing.largestAward = award;
      }

      bucketsMap.set(key, existing);
    }

    return [...bucketsMap.values()].sort((left, right) =>
      left.key.localeCompare(right.key, "en-GB")
    );
  }, [awards]);

  const maxMonthValue = useMemo(() => {
    if (monthlyBuckets.length === 0) return 1;
    return Math.max(...monthlyBuckets.map((bucket) => bucket.totalAmount), 1);
  }, [monthlyBuckets]);

  const selectedBucket = useMemo(() => {
    if (!selectedMonthKey) return monthlyBuckets[monthlyBuckets.length - 1] ?? null;
    return monthlyBuckets.find((bucket) => bucket.key === selectedMonthKey) ?? null;
  }, [monthlyBuckets, selectedMonthKey]);

  const peakMonth = useMemo(() => {
    if (monthlyBuckets.length === 0) return null;
    return [...monthlyBuckets].sort((left, right) => right.totalAmount - left.totalAmount)[0];
  }, [monthlyBuckets]);

  const averageMonthlyValue = useMemo(() => {
    if (monthlyBuckets.length === 0) return 0;
    return totalValue / monthlyBuckets.length;
  }, [monthlyBuckets.length, totalValue]);

  if (monthlyBuckets.length === 0) {
    return null;
  }

  return (
    <div className="border border-black/20 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-baseline md:justify-between">
        <div>
          <span className="inline-block rounded-xs bg-[#0f172a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            Visual 1 · Procurement Timeline
          </span>
          <h4 id={`${chartId}-title`} className="mt-2 text-xl font-bold tracking-tight text-gray-950 md:text-2xl">
            Recorded contract values by month
          </h4>
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            {valueBasisLabel} across {awards.length} UK public contracts, grouped by official notice award month.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setShowTable((prev) => !prev)}
            className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-expanded={showTable}
          >
            {showTable ? "Hide data table" : "View screen-reader table"}
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-b border-black/10 pb-4 sm:grid-cols-4">
        <div className="rounded-xs bg-slate-50 p-3">
          <p className="font-mono text-[11px] font-medium uppercase text-slate-500">Total Ranked</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {formatCurrency(totalValue, true)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">{awards.length} central awards</p>
        </div>
        <div className="rounded-xs bg-slate-50 p-3">
          <p className="font-mono text-[11px] font-medium uppercase text-slate-500">Peak Month</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {peakMonth ? formatCurrency(peakMonth.totalAmount, true) : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">{peakMonth?.shortLabel ?? "N/A"}</p>
        </div>
        <div className="rounded-xs bg-slate-50 p-3">
          <p className="font-mono text-[11px] font-medium uppercase text-slate-500">Monthly Mean</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {formatCurrency(averageMonthlyValue, true)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">Across {monthlyBuckets.length} months</p>
        </div>
        <div className="rounded-xs bg-slate-50 p-3">
          <p className="font-mono text-[11px] font-medium uppercase text-slate-500">Time Span</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {monthlyBuckets.length} mo
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {monthlyBuckets[0]?.shortLabel} – {monthlyBuckets[monthlyBuckets.length - 1]?.shortLabel}
          </p>
        </div>
      </div>

      {/* SVG Bar Chart Visualization */}
      <div className="mt-5" aria-hidden={showTable ? "true" : "false"}>
        <div className="flex items-end justify-between gap-1 sm:gap-2">
          {monthlyBuckets.map((bucket) => {
            const isSelected = selectedBucket?.key === bucket.key;
            const isPeak = peakMonth?.key === bucket.key;
            const heightPercentage = Math.max(8, Math.round((bucket.totalAmount / maxMonthValue) * 100));

            return (
              <button
                key={bucket.key}
                type="button"
                onClick={() => setSelectedMonthKey(bucket.key)}
                className={`group flex flex-1 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded-xs transition-colors p-1 ${
                  isSelected ? "bg-slate-100 ring-1 ring-slate-300" : "hover:bg-slate-50"
                }`}
                aria-pressed={isSelected}
                aria-label={`${bucket.label}: ${formatCurrency(bucket.totalAmount, true)} across ${bucket.awardCount} awards`}
              >
                {/* Bar Value Header */}
                <span className="font-mono text-[10px] font-bold tabular-nums text-slate-700 opacity-90 group-hover:opacity-100">
                  {formatCurrency(bucket.totalAmount, true).replace("£", "£")}
                </span>

                {/* Vertical Bar Container */}
                <div className="relative mt-2 flex h-36 w-full max-w-[42px] items-end rounded-xs bg-slate-100">
                  <div
                    className={`w-full rounded-xs transition-all duration-300 ${
                      isPeak
                        ? "bg-red-600 group-hover:bg-red-700"
                        : isSelected
                          ? "bg-blue-700"
                          : "bg-[#1e293b] group-hover:bg-blue-600"
                    }`}
                    style={{ height: `${heightPercentage}%` }}
                  />
                </div>

                {/* X-Axis Month Label */}
                <span
                  className={`mt-2 font-mono text-[11px] font-semibold ${
                    isSelected ? "text-blue-900 underline decoration-2 underline-offset-2" : "text-slate-600"
                  }`}
                >
                  {bucket.shortLabel}
                </span>

                {/* Small Award Count Badge */}
                <span className="mt-0.5 rounded-full bg-slate-200 px-1.5 py-0.2 font-mono text-[9px] font-medium text-slate-700">
                  {bucket.awardCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Month Detail Card */}
      {selectedBucket && (
        <div className="mt-5 rounded-xs border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h5 className="font-bold text-blue-950">
              {selectedBucket.label} Breakdown
            </h5>
            <span className="font-mono text-xs font-semibold text-blue-800">
              {selectedBucket.awardCount} awards · {formatCurrency(selectedBucket.totalAmount)}
            </span>
          </div>

          {selectedBucket.largestAward && (
            <div className="mt-3 rounded-xs border border-blue-100 bg-white p-3 text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-500">
                Largest Award in {selectedBucket.shortLabel}:
              </span>
              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="font-bold text-slate-900">
                  {selectedBucket.largestAward.title}
                </span>
                <span className="font-mono font-bold text-slate-950">
                  {formatCurrency(selectedBucket.largestAward.amount)}
                </span>
              </div>
              <p className="mt-1 text-slate-600">
                Buyer: <strong className="text-slate-800">{selectedBucket.largestAward.buyer}</strong> ·
                Suppliers: <span className="text-slate-800">{selectedBucket.largestAward.suppliers.join(", ")}</span>
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-900">
            <span>Framework Call-offs: <strong>{selectedBucket.frameworkCount}</strong></span>
            <span>Direct / Discrete Awards: <strong>{selectedBucket.awardCount - selectedBucket.frameworkCount}</strong></span>
            <span>Monthly Share: <strong>{((selectedBucket.totalAmount / totalValue) * 100).toFixed(1)}% of total ranked</strong></span>
          </div>
        </div>
      )}

      {/* Accessible Screen-Reader & Full Data Table */}
      {showTable && (
        <div className="mt-5 overflow-x-auto border-t border-black/15 pt-4">
          <table className="min-w-full divide-y divide-black/10 text-left text-xs">
            <caption className="sr-only">Monthly government contracts breakdown</caption>
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <th scope="col" className="px-3 py-2">Month</th>
                <th scope="col" className="px-3 py-2 text-right">Disclosed Value</th>
                <th scope="col" className="px-3 py-2 text-right">Awards Count</th>
                <th scope="col" className="px-3 py-2 text-right">Framework Share</th>
                <th scope="col" className="px-3 py-2">Lead Buyer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {monthlyBuckets.map((bucket) => (
                <tr key={bucket.key} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{bucket.label}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-slate-950">
                    {formatCurrency(bucket.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {bucket.awardCount}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {((bucket.frameworkCount / bucket.awardCount) * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-slate-600">{bucket.largestAward?.buyer ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Unit: Disclosed GBP (excluding VAT)</span>
        <span>Source: Cabinet Office Find a Tender OCDS Releases</span>
      </div>
    </div>
  );
}
