"use client";

import { useId, useMemo, useState } from "react";
import { formatCurrency, type Award } from "@/app/components/GovernmentContractsShared";

interface SupplierMarketConcentrationProps {
  awards: Award[];
  totalDisclosedValue: number;
  top10Share: number;
  valueBasisLabel: string;
}

const SHOWN_AWARDS = 15;

export default function SupplierMarketConcentration({
  awards,
  totalDisclosedValue,
  top10Share,
  valueBasisLabel,
}: SupplierMarketConcentrationProps) {
  const chartId = useId();
  const [selectedNation, setSelectedNation] = useState<string>("all");

  const ranked = useMemo(
    () => [...awards].filter((a) => Number.isFinite(a.amount)).sort((a, b) => b.amount - a.amount),
    [awards]
  );

  const nations = useMemo(
    () => ["all", ...[...new Set(ranked.flatMap((a) => a.supplierNations))].sort()],
    [ranked]
  );

  const filtered = useMemo(
    () => (selectedNation === "all" ? ranked : ranked.filter((a) => a.supplierNations.includes(selectedNation))),
    [ranked, selectedNation]
  );

  const top = ranked[0]?.amount ?? 0;
  const hasTotal = totalDisclosedValue > 0;
  const top5Share = hasTotal && ranked.length >= 5
    ? (ranked.slice(0, 5).reduce((sum, a) => sum + a.amount, 0) / totalDisclosedValue) * 100
    : null;
  const top10Available = Number.isFinite(top10Share) && hasTotal && ranked.length > 0;
  const shareBasis = `of total disclosed ${valueBasisLabel} across all ranked awards in the update window`;

  return (
    <section aria-labelledby={`${chartId}-title`} className="border border-black/20 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-baseline md:justify-between">
        <div>
          <span className="inline-block rounded-xs bg-[#0f172a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            Disclosed {valueBasisLabel}
          </span>
          <h4 id={`${chartId}-title`} className="mt-2 text-xl font-bold tracking-tight text-gray-950 md:text-2xl">
            Ranked awards with every named supplier
          </h4>
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            Each award appears once with its full disclosed value and every named supplier. Values are not divided between suppliers, so no per-supplier amount is shown. Disclosed value is not supplier revenue or confirmed spending.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto" role="group" aria-label="Filter awards by supplier nation">
          {nations.map((nation) => (
            <button
              key={nation}
              type="button"
              onClick={() => setSelectedNation(nation)}
              className={`rounded-xs px-2 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                selectedNation === nation ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              aria-pressed={selectedNation === nation}
            >
              {nation === "all" ? "All nations" : nation}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-5 grid gap-3 rounded-xs bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-slate-700">Top 10 awards</dt>
          <dd className="font-mono text-lg font-bold text-slate-900">
            {top10Available ? `${top10Share.toFixed(1)}%` : "Unavailable"}
          </dd>
          <dd className="text-[11px] text-slate-600">{shareBasis}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-700">Top 5 awards</dt>
          <dd className="font-mono text-lg font-bold text-slate-900">
            {top5Share === null ? "Unavailable" : `${top5Share.toFixed(1)}%`}
          </dd>
          <dd className="text-[11px] text-slate-600">{shareBasis}</dd>
        </div>
      </dl>

      {filtered.length === 0 ? (
        <p className="mt-5 text-sm text-slate-700">Award values unavailable for this selection.</p>
      ) : (
        <ol className="mt-5 space-y-2.5" aria-label="Awards ranked by disclosed value">
          {filtered.slice(0, SHOWN_AWARDS).map((award, idx) => {
            const width = top > 0 ? (award.amount / top) * 100 : 0;
            const shareOfTotal = hasTotal ? (award.amount / totalDisclosedValue) * 100 : null;
            return (
              <li key={award.key} className="rounded-xs border border-slate-100 p-2.5 hover:border-slate-300 hover:bg-slate-50/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="mr-2 font-mono text-[10px] text-slate-500">#{idx + 1}</span>
                      <a
                        href={award.noticeUrl}
                        className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        {award.title}
                      </a>
                    </p>
                    <p className="text-xs text-slate-600">Buyer: {award.buyer}</p>
                    <div className="text-xs text-slate-600">
                      {award.suppliers.length === 1 ? "Named supplier" : `Named suppliers (${award.suppliers.length})`}:{" "}
                      {award.suppliers.length === 0 ? "Unavailable" : (
                        <ul className="inline list-none p-0" aria-label={`Suppliers named on ${award.title}`}>
                          {award.suppliers.map((name, i) => (
                            <li key={`${name}-${i}`} className="inline">
                              <span>{name}</span>
                              {award.supplierNations[i] ? ` (${award.supplierNations[i]})` : ""}
                              {i < award.suppliers.length - 1 ? "; " : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="self-end text-right sm:self-auto">
                    <span className="block font-mono text-sm font-bold tabular-nums text-slate-950">
                      {formatCurrency(award.amount, true)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {shareOfTotal === null ? "Share unavailable" : `${shareOfTotal.toFixed(1)}% ${shareBasis}`}
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-blue-700" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Showing {Math.min(SHOWN_AWARDS, filtered.length)} of {filtered.length} ranked awards</span>
        <span>Bar length is proportional to award value; the largest shown award is full width.</span>
      </div>
    </section>
  );
}
