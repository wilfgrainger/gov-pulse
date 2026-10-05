"use client";

import { barWidthPercent } from "@/app/lib/chartModel";
import {
  buildDossier,
  frameworkValueLabel,
  valueBasisDescription,
  type AwardDossier,
  type PublicAward,
} from "@/app/lib/publicMoney";

function pounds(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function percentage(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export type PublicMoneyNoticeListProps = {
  query: string;
  setQuery: (value: string) => void;
  setPage: (value: number | ((prev: number) => number)) => void;
  buyer: string;
  setBuyer: (value: string) => void;
  nation: string;
  setNation: (value: string) => void;
  buyers: string[];
  nations: string[];
  valueBasis: PublicAward["valueBasis"];
  windowLabel: string;
  coverageLine: string | null;
  firstRow: number;
  lastRow: number;
  coverage: { visibleCount: number; listedCount: number; sourceDenominator: number; shareOfSourceWindow: number };
  listedShareOfSourceWindow: number;
  downloadVisibleAwards: () => void;
  visible: PublicAward[];
  pageAwards: PublicAward[];
  maximum: number;
  setSelected: (dossier: AwardDossier | null) => void;
  pageCount: number;
  currentPage: number;
  caveats: string[];
};

export default function PublicMoneyNoticeList(p: PublicMoneyNoticeListProps) {
  const {
    query, setQuery, setPage, buyer, setBuyer, nation, setNation, buyers, nations, valueBasis, windowLabel, coverageLine,
    firstRow, lastRow, coverage, listedShareOfSourceWindow, downloadVisibleAwards, visible, pageAwards, maximum,
    setSelected, pageCount, currentPage, caveats,
  } = p;
  return (
<section aria-labelledby="public-money-results" className="min-w-0">
        <div className="min-w-0 border-y-2 border-foreground bg-white p-4 md:p-6">
          <p className="eyebrow">Find a Tender · GBP award notices</p>
          <h2 id="public-money-results" className="mt-2 text-3xl font-black">Award notices and buyer/supplier dossiers</h2>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            Open a notice or inspect records grouped by the publisher&apos;s identifier. Where no identifier is disclosed,
            records are matched by the exact name shown; neither grouping proves legal identity.
          </p>
          <p className="mt-2 text-sm font-semibold">Current value basis: {valueBasisDescription(valueBasis)}.</p>
          <p className="mt-1 text-sm text-gray-700">Window {windowLabel}: notices updated in this period, not money spent that week.</p>
          {coverageLine ? <p className="mt-1 text-sm text-gray-700">{coverageLine}.</p> : null}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="grid min-w-0 gap-1 text-xs font-bold">
              Search notices
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                type="search"
                className="min-h-11 w-full min-w-0 border border-foreground px-3 text-sm font-normal"
                placeholder="Buyer, supplier or title"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-bold">
              Buyer
              <select value={buyer} onChange={(event) => { setBuyer(event.target.value); setPage(1); }} className="min-h-11 w-full min-w-0 border border-foreground bg-white px-3 text-sm font-normal">
                <option value="all">All buyers</option>
                {buyers.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-bold">
              Supplier nation
              <select value={nation} onChange={(event) => { setNation(event.target.value); setPage(1); }} className="min-h-11 w-full min-w-0 border border-foreground bg-white px-3 text-sm font-normal">
                <option value="all">All known or unknown</option>
                {nations.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm font-semibold">
              Showing {firstRow}–{lastRow} of {coverage.visibleCount} matching awards. Listed top-ranked sample: {coverage.listedCount} of {coverage.sourceDenominator} comparable awards ({percentage(listedShareOfSourceWindow)}). Search and filters apply only within that list; current matches cover {coverage.visibleCount} of {coverage.sourceDenominator} awards in the full source window ({percentage(coverage.shareOfSourceWindow)}).
            </p>
            <button type="button" onClick={downloadVisibleAwards} disabled={!visible.length} className="min-h-11 border border-foreground bg-white px-4 text-sm font-bold underline decoration-black/30 underline-offset-4 hover:bg-surface-warm disabled:cursor-not-allowed disabled:opacity-50">
              Download filtered notices CSV
            </button>
          </div>
        </div>
        {visible.length ? (
          <ol className="mt-4 list-none divide-y divide-line border-y border-line-strong bg-white p-0">
            {pageAwards.map((award) => (
              <li key={award.key} className="p-4 md:p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Notice {award.releaseId} · {award.awardDate.slice(0, 10)}</p>
                    <h3 className="mt-2 text-lg font-extrabold leading-6">{award.title}</h3>
                    <p className="mt-2">
                      <span className={award.framework ? "inline-flex border border-amber-700 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-900" : "inline-flex border border-black/20 bg-white px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-gray-700"}>
                        {frameworkValueLabel(award.framework)}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-gray-700">Buyer: {award.buyer}{award.buyerId ? ` · ID ${award.buyerId}` : ""}</p>
                    <p className="mt-1 text-sm text-gray-700">Disclosed suppliers: {award.suppliers.map((name, index) => `${name}${award.supplierIds?.[index] ? ` · ID ${award.supplierIds[index]}` : ""}`).join(", ")}</p>
                  </div>
                  <div>
                    <p className="font-mono text-xl font-black tabular-nums">{pounds(award.amount)}</p>
                    <p className="mt-1 text-xs text-gray-600">{valueBasisDescription(award.valueBasis)}</p>
                    <div className="mt-3 h-3 border border-black/25 bg-white" role="img" aria-label={`${valueBasisDescription(award.valueBasis)} ${pounds(award.amount)} on a zero-based scale`}>
                      <div className="h-full bg-[#ef5124]" style={{ width: `${barWidthPercent(award.amount, maximum)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-600">Zero-based magnitude</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelected(buildDossier(visible, award.key))} className="mt-4 min-h-11 border border-foreground bg-surface-warm px-4 text-sm font-bold hover:bg-accent-soft">
                  Open notice dossier
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p role="status" className="mt-4 border border-line bg-white p-5 text-sm">No award notice matches these filters in the current source window.</p>
        )}
        {pageCount > 1 && (
          <nav aria-label="Award notice pages" className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="min-h-10 border border-foreground bg-white px-3 text-sm font-bold disabled:opacity-50">Previous page</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} aria-current={pageNumber === currentPage ? "page" : undefined} aria-label={`Page ${pageNumber}`} className={`min-h-10 min-w-10 border px-3 text-sm font-bold ${pageNumber === currentPage ? "border-foreground bg-foreground text-white" : "border-line bg-white"}`}>
                {pageNumber}
              </button>
            ))}
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount} className="min-h-10 border border-foreground bg-white px-3 text-sm font-bold disabled:opacity-50">Next page</button>
          </nav>
        )}
        <aside className="mt-6 border-l-4 border-accent bg-surface-warm p-5">
          <h3 className="font-bold">Coverage and interpretation</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-700">{caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
        </aside>
      </section>
  );
}
