"use client";

import { useRef } from "react";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import { barWidthPercent } from "@/app/lib/chartModel";
import { buildSupplierConcentrationMetadata } from "@/app/lib/governmentContractsChart";
import {
  formatCurrency,
  type ContractsPayload,
  type SupplierConcentrationEntry,
} from "@/app/components/GovernmentContractsShared";
import { valueBasisDescription } from "@/app/lib/publicMoney";

export function GovernmentContractsSupplierBars({
  data,
  supplierConcentration,
  nationFilter,
  setNationFilter,
  availableNations,
}: {
  data: ContractsPayload;
  supplierConcentration: SupplierConcentrationEntry[];
  nationFilter: string;
  setNationFilter: (value: string) => void;
  availableNations: string[];
}) {
  const visibleSupplierCount = Math.min(20, supplierConcentration.length);
  const supplierChartRows = supplierConcentration.slice(0, visibleSupplierCount);
  const fullSupplierCount = Array.isArray(data.supplierConcentration) ? data.supplierConcentration.length : 0;
  const supplierChartRef = useRef<SVGSVGElement | null>(null);
  const supplierChartMetadata = buildSupplierConcentrationMetadata({
    title: `Supplier equal-share ${valueBasisDescription(data.summary?.valueBasis ?? "award-value")} scenario`,
    suppliers: supplierChartRows,
    filteredSupplierCount: supplierConcentration.length,
    fullSupplierCount,
    updateWindow: { updatedFrom: data.window?.updatedFrom ?? "", updatedTo: data.window?.updatedTo ?? "" },
    sourceUrl: data.source?.apiUrl ?? "",
    sourceLabel: "Cabinet Office Find a Tender OCDS API",
    valueBasisLabel: valueBasisDescription(data.summary?.valueBasis ?? "award-value"),
    caveats: data.caveats ?? [],
  });
  const supplierChartMax = data.supplierConcentration?.[0]?.disclosedValue ?? 0;
  const supplierPlotWidth = 600;
  const supplierChartHeight = Math.max(126, supplierChartRows.length * 32 + 74);

  return (
    <section aria-labelledby="supplier-concentration-title">
      <div className="border-b border-black/20 pb-5">
        <p className="text-sm font-semibold text-accent">Supplier value scenario</p>
        <h3 id="supplier-concentration-title" className="mt-1 text-2xl font-semibold md:text-3xl">
          {valueBasisDescription(data.summary.valueBasis)} under an equal-share scenario
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Groups by publisher supplier ID where available, then exact name as a fallback. Multi-supplier awards are
          divided equally for this scenario; the resulting values are not supplier revenue or proof of payments.
        </p>
      </div>

      <label className="mt-5 block max-w-xs text-sm font-semibold">
        Filter by supplier nation
        <select
          value={nationFilter}
          onChange={(event) => setNationFilter(event.target.value)}
          className="mt-2 min-h-11 w-full border border-black/30 bg-white px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <option value="all">All suppliers</option>
          {availableNations.map((nation) => (
            <option key={nation} value={nation}>
              {nation}
            </option>
          ))}
        </select>
      </label>

      <p role="status" className="mt-4 text-sm text-gray-600">
        Showing the first {visibleSupplierCount} of {supplierConcentration.length} filtered supplier groups ({data.supplierConcentration.length} in the full publication).
      </p>

      <figure className="mt-4">
        <div className="overflow-x-auto">
          <svg
            ref={supplierChartRef}
            viewBox={`0 0 940 ${supplierChartHeight}`}
            role="img"
            aria-label={`Equal-share supplier ${valueBasisDescription(data.summary.valueBasis)} scenario in pounds. First ${visibleSupplierCount} of ${supplierConcentration.length} filtered supplier groups; scale begins at zero and ends at ${formatCurrency(supplierChartMax)}.`}
            className="h-auto min-w-[52rem] w-full"
          >
            <rect x="0" y="0" width="940" height={supplierChartHeight} fill="#ffffff" />
            {[0, .25, .5, .75, 1].map((ratio) => {
              const x = 220 + supplierPlotWidth * ratio;
              return <g key={ratio}>
                <line x1={x} x2={x} y1="14" y2={supplierChartHeight - 30} stroke="#ded8cf" strokeDasharray="3 4" />
                <text x={x} y={supplierChartHeight - 9} textAnchor="middle" fontSize="11" fill="#51596a">{formatCurrency(supplierChartMax * ratio, true)}</text>
              </g>;
            })}
            {supplierChartRows.map((entry, index) => {
              const y = 25 + index * 32;
              const width = supplierPlotWidth * barWidthPercent(entry.disclosedValue, supplierChartMax) / 100;
              const identity = entry.entityId ? ` · ID ${entry.entityId}` : " · exact-name match";
              return <g key={entry.entityId ?? `name:${entry.name}`}>
                <text x="210" y={y + 11} textAnchor="end" fontSize="12" fontWeight="600" fill="#192139">{entry.name}{identity} · {entry.nation}</text>
                <rect x="220" y={y} width={width} height="16" fill="#08766c"><title>{`${entry.name}${identity}: ${formatCurrency(entry.disclosedValue)} under an equal-share scenario across ${entry.awardCount} awards; ${entry.nation}`}</title></rect>
                <text x="832" y={y + 12} fontSize="12" fontWeight="600" fill="#192139">{formatCurrency(entry.disclosedValue, true)}</text>
              </g>;
            })}
          </svg>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="text-left text-xs font-bold uppercase tracking-wide">Supplier equal-share scenario rows shown in the chart</caption>
            <thead><tr className="border-b border-line-strong text-left text-xs"><th scope="col" className="py-2 pr-3">Displayed order</th><th scope="col" className="py-2 pr-3">Supplier</th><th scope="col" className="py-2 pr-3">Publisher ID</th><th scope="col" className="py-2 pr-3">Scenario value</th><th scope="col" className="py-2 pr-3">Awards</th><th scope="col" className="py-2">Supplier nation</th></tr></thead>
            <tbody>{supplierChartRows.map((entry, index) => <tr key={entry.entityId ?? `name:${entry.name}`} className="border-b border-line"><td className="py-2 pr-3 tabular-nums">{index + 1}</td><th scope="row" className="py-2 pr-3 text-left">{entry.name}{entry.identityBasis === "exact-name" ? <span className="block text-xs font-normal text-gray-600">Exact-name match</span> : null}</th><td className="py-2 pr-3 font-mono text-xs">{entry.entityId ?? "Not disclosed"}</td><td className="py-2 pr-3 font-mono tabular-nums">{formatCurrency(entry.disclosedValue)}</td><td className="py-2 pr-3 tabular-nums">{entry.awardCount}</td><td className="py-2">{entry.nation}</td></tr>)}</tbody>
          </table>
        </div>
        <figcaption className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-xs leading-5 text-gray-600">Zero-based axis uses the largest supplier scenario value in the full publication as its maximum. Multi-supplier values are split equally for comparison; these scenario values are not supplier revenue or confirmed expenditure.</p>
          <ChartExportButtons containerRef={supplierChartRef} chartMetadata={supplierChartMetadata} />
        </figcaption>
      </figure>
      {data.supplierConcentration.every((entry) => entry.nation === "Other/Unknown") && (
        <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600">
          Supplier nation is currently Other/Unknown for every ranked supplier: the collected Find a Tender
          releases in this window did not carry an explicit nation name. Postcode areas can cross national
          borders, so they are not used to classify a supplier&apos;s nation.
        </p>
      )}
    </section>
  );
}
