"use client";

import { useId, useMemo, useState } from "react";

export type SupplierConcentrationItem = {
  name: string;
  awardCount: number;
  disclosedValue: number;
  nation: string;
};

interface SupplierMarketConcentrationProps {
  suppliers: SupplierConcentrationItem[];
  totalDisclosedValue: number;
  top10Share: number;
}

function formatCurrency(amount: number, compact = false) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(amount);
}

const NATION_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  England: { bg: "bg-blue-100", text: "text-blue-800", bar: "bg-blue-600" },
  Scotland: { bg: "bg-indigo-100", text: "text-indigo-800", bar: "bg-indigo-600" },
  Wales: { bg: "bg-red-100", text: "text-red-800", bar: "bg-red-600" },
  "Northern Ireland": { bg: "bg-emerald-100", text: "text-emerald-800", bar: "bg-emerald-600" },
  "Other/Unknown": { bg: "bg-slate-100", text: "text-slate-700", bar: "bg-slate-500" },
};

export default function SupplierMarketConcentration({
  suppliers,
  totalDisclosedValue,
  top10Share,
}: SupplierMarketConcentrationProps) {
  const chartId = useId();
  const [selectedNation, setSelectedNation] = useState<string>("all");
  const [activeSupplier, setActiveSupplier] = useState<SupplierConcentrationItem | null>(null);

  const availableNations = useMemo(() => {
    return ["all", ...new Set(suppliers.map((s) => s.nation))].sort();
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (selectedNation === "all") return suppliers;
    return suppliers.filter((s) => s.nation === selectedNation);
  }, [selectedNation, suppliers]);

  const topValue = suppliers[0]?.disclosedValue ?? 1;

  // Compute market tiers
  const tiers = useMemo(() => {
    const top5 = suppliers.slice(0, 5).reduce((acc, s) => acc + s.disclosedValue, 0);
    const next5 = suppliers.slice(5, 10).reduce((acc, s) => acc + s.disclosedValue, 0);
    const rest = Math.max(0, totalDisclosedValue - top5 - next5);

    return {
      top5Pct: totalDisclosedValue > 0 ? (top5 / totalDisclosedValue) * 100 : 0,
      next5Pct: totalDisclosedValue > 0 ? (next5 / totalDisclosedValue) * 100 : 0,
      restPct: totalDisclosedValue > 0 ? (rest / totalDisclosedValue) * 100 : 0,
      top5Amount: top5,
      next5Amount: next5,
      restAmount: rest,
    };
  }, [suppliers, totalDisclosedValue]);

  return (
    <div className="border border-black/20 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-baseline md:justify-between">
        <div>
          <span className="inline-block rounded-xs bg-[#0f172a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            Visual 2 · Market Concentration
          </span>
          <h4 id={`${chartId}-title`} className="mt-2 text-xl font-bold tracking-tight text-gray-950 md:text-2xl">
            Supplier Concentration & Public Spend Allocation
          </h4>
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            Top 100 central contract value allocated across named corporate suppliers, with official UK nation attribution.
          </p>
        </div>

        {/* Nation Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto" role="group" aria-label="Filter suppliers by nation">
          {availableNations.map((nation) => {
            const isSelected = selectedNation === nation;
            return (
              <button
                key={nation}
                type="button"
                onClick={() => setSelectedNation(nation)}
                className={`rounded-xs px-2 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  isSelected
                    ? "bg-[#0f172a] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                aria-pressed={isSelected}
              >
                {nation === "all" ? "All Nations" : nation}
              </button>
            );
          })}
        </div>
      </div>

      {/* Segmented Share Distribution Bar */}
      <div className="mt-5 rounded-xs bg-slate-50 p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>Ranked Procurement Value Concentration</span>
          <span className="font-mono text-slate-900">Top 10: {top10Share.toFixed(1)}%</span>
        </div>

        {/* Stacked Segment Bar */}
        <div className="mt-2 flex h-5 w-full overflow-hidden rounded-xs bg-slate-200" role="img" aria-label={`Market concentration: Top 5 hold ${tiers.top5Pct.toFixed(1)}%, Ranks 6-10 hold ${tiers.next5Pct.toFixed(1)}%, Remaining hold ${tiers.restPct.toFixed(1)}%`}>
          <div
            className="bg-blue-800 transition-all duration-300"
            style={{ width: `${tiers.top5Pct}%` }}
            title={`Top 5: ${tiers.top5Pct.toFixed(1)}% (${formatCurrency(tiers.top5Amount, true)})`}
          />
          <div
            className="bg-blue-500 transition-all duration-300"
            style={{ width: `${tiers.next5Pct}%` }}
            title={`Ranks 6-10: ${tiers.next5Pct.toFixed(1)}% (${formatCurrency(tiers.next5Amount, true)})`}
          />
          <div
            className="bg-slate-300 transition-all duration-300"
            style={{ width: `${tiers.restPct}%` }}
            title={`Remaining 90: ${tiers.restPct.toFixed(1)}% (${formatCurrency(tiers.restAmount, true)})`}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-800" aria-hidden="true" />
            <span>Top 5 Suppliers: <strong>{tiers.top5Pct.toFixed(1)}%</strong> ({formatCurrency(tiers.top5Amount, true)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
            <span>Ranks 6–10: <strong>{tiers.next5Pct.toFixed(1)}%</strong> ({formatCurrency(tiers.next5Amount, true)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" aria-hidden="true" />
            <span>Remaining Ranked: <strong>{tiers.restPct.toFixed(1)}%</strong> ({formatCurrency(tiers.restAmount, true)})</span>
          </div>
        </div>
      </div>

      {/* Supplier Horizontal Bars List */}
      <div className="mt-5 space-y-2.5" role="list" aria-label="Suppliers ranked by total disclosed value">
        {filteredSuppliers.slice(0, 15).map((supplier, idx) => {
          const widthPercent = topValue > 0 ? Math.max(3, (supplier.disclosedValue / topValue) * 100) : 0;
          const shareOfTotal = totalDisclosedValue > 0 ? (supplier.disclosedValue / totalDisclosedValue) * 100 : 0;
          const nationStyle = NATION_COLORS[supplier.nation] ?? NATION_COLORS["Other/Unknown"];
          const isSelected = activeSupplier?.name === supplier.name;

          return (
            <div
              key={supplier.name}
              role="listitem"
              onMouseEnter={() => setActiveSupplier(supplier)}
              onMouseLeave={() => setActiveSupplier(null)}
              className={`rounded-xs border p-2.5 transition-all ${
                isSelected
                  ? "border-blue-400 bg-blue-50/40 shadow-xs"
                  : "border-slate-100 hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 font-mono text-[10px] font-bold text-slate-800">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-900 text-sm">
                    {supplier.name}
                  </span>
                  <span
                    className={`rounded-xs px-1.5 py-0.5 font-mono text-[10px] font-semibold ${nationStyle.bg} ${nationStyle.text}`}
                  >
                    {supplier.nation}
                  </span>
                </div>

                <div className="flex items-baseline gap-3 self-end sm:self-auto">
                  <span className="text-[11px] text-slate-500">
                    {supplier.awardCount} {supplier.awardCount === 1 ? "award" : "awards"} · {shareOfTotal.toFixed(1)}% share
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-950">
                    {formatCurrency(supplier.disclosedValue, true)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${nationStyle.bar}`}
                  style={{ width: `${widthPercent}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Showing top {Math.min(15, filteredSuppliers.length)} of {filteredSuppliers.length} named suppliers</span>
        <span>Equal allocation applied for multi-supplier awards</span>
      </div>
    </div>
  );
}
