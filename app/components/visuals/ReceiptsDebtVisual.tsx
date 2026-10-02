"use client";

import { useId, useMemo, useState } from "react";

export type ReceiptsMonthPoint = {
  date: string;
  receiptsMillionGbp: number;
};

interface ReceiptsDebtVisualProps {
  receiptsHistory: ReceiptsMonthPoint[];
  currentReceiptsBillion: number;
  currentDebtBillion: number;
  debtToGdpRatio: number;
  receiptsPeriod: string;
  debtPeriod: string;
}

function formatBillion(val: number) {
  return `£${val.toFixed(1)}B`;
}

export default function ReceiptsDebtVisual({
  receiptsHistory,
  currentReceiptsBillion,
  currentDebtBillion,
  debtToGdpRatio,
  receiptsPeriod,
  debtPeriod,
}: ReceiptsDebtVisualProps) {
  const chartId = useId();
  const [showTable, setShowTable] = useState(false);

  const validHistory = useMemo(() => {
    return Array.isArray(receiptsHistory) ? receiptsHistory.slice(-12) : [];
  }, [receiptsHistory]);

  const maxReceipts = useMemo(() => {
    if (validHistory.length === 0) return 100_000;
    return Math.max(...validHistory.map((p) => p.receiptsMillionGbp), 10_000);
  }, [validHistory]);

  const meanMonthlyReceipts = useMemo(() => {
    if (validHistory.length === 0) return 0;
    const sum = validHistory.reduce((acc, p) => acc + p.receiptsMillionGbp, 0);
    return sum / validHistory.length / 1000;
  }, [validHistory]);

  return (
    <div className="border border-black/20 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-black/15 pb-4 md:flex-row md:items-baseline md:justify-between">
        <div>
          <span className="inline-block rounded-xs bg-[#0f172a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            Visual 5 · Public Finances Balance
          </span>
          <h4 id={`${chartId}-title`} className="mt-2 text-xl font-bold tracking-tight text-gray-950 md:text-2xl">
            Tax Receipts Flow vs National Debt Stock
          </h4>
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            Monthly government cash receipts (HMRC/ONS ANBV) contrasted with the outstanding public debt stock.
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

      {/* Headline Metric Panels */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xs border border-slate-200 bg-slate-50/60 p-4">
          <span className="font-mono text-[11px] font-bold uppercase text-slate-500">Monthly Tax Receipts</span>
          <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-slate-950">
            {formatBillion(currentReceiptsBillion)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {receiptsPeriod} · ONS ANBV central receipts
          </p>
        </div>

        <div className="rounded-xs border border-slate-200 bg-slate-50/60 p-4">
          <span className="font-mono text-[11px] font-bold uppercase text-slate-500">Total Net Debt Stock</span>
          <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-slate-950">
            {formatBillion(currentDebtBillion)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {debtPeriod} · Excl. public sector banks
          </p>
        </div>

        <div className="rounded-xs border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[11px] font-bold uppercase text-blue-800">Debt-to-GDP Ratio</span>
            <span className="font-mono text-[10px] text-blue-600 font-semibold">100% Benchmark</span>
          </div>
          <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-blue-950">
            {debtToGdpRatio.toFixed(1)}%
          </p>
          {/* Progress gauge towards 100% GDP */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-200/60">
            <div
              className={`h-full rounded-full transition-all duration-300 ${debtToGdpRatio >= 100 ? "bg-red-600" : "bg-blue-700"}`}
              style={{ width: `${Math.min(100, debtToGdpRatio)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Monthly Receipts Timeline Chart */}
      {validHistory.length > 0 && (
        <div className="mt-6" aria-hidden={showTable ? "true" : "false"}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span>Monthly Cash Receipts Timeline (Past 12 Months)</span>
            <span className="font-mono text-xs text-slate-500">
              Mean: {formatBillion(meanMonthlyReceipts)}/mo
            </span>
          </div>

          <div className="flex items-end justify-between gap-1 sm:gap-2 h-32 pt-2 border-b border-slate-200">
            {validHistory.map((item) => {
              const heightPct = Math.max(10, Math.round((item.receiptsMillionGbp / maxReceipts) * 100));
              const billionVal = item.receiptsMillionGbp / 1000;

              return (
                <div key={item.date} className="flex flex-1 flex-col items-center group">
                  <span className="font-mono text-[9px] font-bold text-slate-600 opacity-80 group-hover:opacity-100 tabular-nums">
                    £{billionVal.toFixed(0)}B
                  </span>
                  <div className="w-full max-w-[32px] rounded-t-xs bg-slate-200 group-hover:bg-blue-600 transition-colors" style={{ height: `${heightPct}%` }}>
                    <div className="h-full w-full bg-blue-800 rounded-t-xs opacity-90 group-hover:opacity-100" />
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 mt-1 truncate max-w-[40px]">
                    {item.date.slice(0, 7)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screen-Reader Table */}
      {showTable && (
        <div className="mt-5 overflow-x-auto border-t border-black/15 pt-4">
          <table className="min-w-full divide-y divide-black/10 text-left text-xs">
            <caption className="sr-only">Monthly public sector receipts and net debt comparison</caption>
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <th scope="col" className="px-3 py-2">Month</th>
                <th scope="col" className="px-3 py-2 text-right">Receipts (£ Millions)</th>
                <th scope="col" className="px-3 py-2 text-right">Receipts (£ Billions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {validHistory.map((point) => (
                <tr key={point.date} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{point.date}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    £{point.receiptsMillionGbp.toLocaleString("en-GB")}m
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-blue-900">
                    £{(point.receiptsMillionGbp / 1000).toFixed(2)}B
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Units: Pounds sterling (GBP) &amp; % of UK GDP</span>
        <span>Source: ONS Public Sector Finances (PSF) release bulletin</span>
      </div>
    </div>
  );
}
