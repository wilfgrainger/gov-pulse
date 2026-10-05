"use client";

import {
  AwardCard,
  formatCurrency,
  formatDate,
  type Award,
  type ContractsPayload,
  type SortMode,
} from "@/app/components/GovernmentContractsShared";
import { FrameworkBadge } from "@/app/components/ContractLeadNotice";
import { valueBasisDescription } from "@/app/lib/publicMoney";

export function GovernmentContractsTable({
  data,
  displayedAwards,
  query,
  setQuery,
  sortMode,
  setSortMode,
}: {
  data: ContractsPayload;
  displayedAwards: Award[];
  query: string;
  setQuery: (value: string) => void;
  sortMode: SortMode;
  setSortMode: (value: SortMode) => void;
}) {
  return (
      <section aria-labelledby="contracts-table-title">
        <div className="grid gap-4 border-b border-black/20 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] md:items-end">
          <div>
            <p className="text-sm font-semibold text-accent">Award explorer</p>
            <h3 id="contracts-table-title" className="mt-1 text-2xl font-semibold md:text-3xl">Search buyers, suppliers and awards</h3>
          </div>
          <p className="text-sm leading-6 text-gray-600">Every row links to the official notice and full procurement history.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="text-sm font-semibold">
            Search ranked awards
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Contract, buyer, supplier or notice"
              className="mt-2 min-h-11 w-full border border-black/30 bg-white px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            />
          </label>
          <label className="text-sm font-semibold">
            Sort by
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="mt-2 min-h-11 w-full border border-black/30 bg-white px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <option value="value-desc">Value: highest first</option>
              <option value="value-asc">Value: lowest first</option>
              <option value="date-desc">Award date: newest first</option>
              <option value="buyer">Buyer: A to Z</option>
              <option value="supplier">Supplier: A to Z</option>
            </select>
          </label>
        </div>
        <p role="status" className="mt-4 text-sm text-gray-600">Showing {displayedAwards.length} of {data.awards.length} retained awards.</p>

        <div className="mt-3 md:hidden">
          {displayedAwards.map((award) => <AwardCard key={award.key} award={award} />)}
        </div>

        <div className="mt-5 hidden overflow-x-auto border-y border-black/20 md:block">
          <table className="min-w-full divide-y divide-black/15 text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">Rank</th>
                <th scope="col" className="px-4 py-3">Award</th>
                <th scope="col" className="px-4 py-3">Buyer and supplier</th>
                <th scope="col" className="px-4 py-3">Nation</th>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3 text-right">Value ({valueBasisDescription(data.summary.valueBasis)})</th>
                <th scope="col" className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-white">
              {displayedAwards.map((award) => (
                <tr key={award.key} className={award.framework ? "bg-amber-50/50" : undefined}>
                  <td className="px-4 py-4 align-top font-mono tabular-nums">{award.rank}</td>
                  <th scope="row" className="max-w-sm px-4 py-4 align-top font-semibold">
                    <span className="block">{award.title}</span>
                    <span className="mt-2 block"><FrameworkBadge framework={award.framework} /></span>
                  </th>
                  <td className="max-w-xs px-4 py-4 align-top">
                    <span className="block font-semibold">{award.buyer}</span>
                    <span className="mt-1 block text-gray-600">{award.suppliers.join(", ")}</span>
                  </td>
                  <td className="px-4 py-4 align-top text-gray-600">
                    {[...new Set(award.supplierNations)].join(", ")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top">{formatDate(award.awardDate)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right align-top font-mono font-semibold tabular-nums">{formatCurrency(award.amount)}<span className="mt-1 block whitespace-normal font-sans text-xs font-normal text-gray-600">{valueBasisDescription(award.valueBasis)}</span></td>
                  <td className="px-4 py-4 align-top">
                    <a className="font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black" href={award.noticeUrl} target="_blank" rel="noopener noreferrer">Notice</a>
                    <a className="mt-2 block text-xs underline decoration-black/20 underline-offset-4 hover:decoration-black" href={award.procurementUrl} target="_blank" rel="noopener noreferrer">History</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
  );
}
