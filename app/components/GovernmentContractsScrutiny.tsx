"use client";

import ContractsMonthlyPipeline from "@/app/components/visuals/ContractsMonthlyPipeline";
import SupplierMarketConcentration from "@/app/components/visuals/SupplierMarketConcentration";
import {
  formatCurrency,
  type ContractsPayload,
} from "@/app/components/GovernmentContractsShared";
import { valueBasisDescription } from "@/app/lib/publicMoney";

export function GovernmentContractsScrutiny({ data }: { data: ContractsPayload }) {
  return (
    <>
      <ContractsMonthlyPipeline
        awards={data.awards}
        totalValue={data.summary.disclosedValueTotal}
        valueBasisLabel={valueBasisDescription(data.summary.valueBasis)}
      />

      <section id="uk-doge" aria-labelledby="uk-doge-title" className="border border-black bg-[#14243b] p-6 text-white md:p-8">
        <p className="text-sm font-semibold text-red-300">UK DOGE · independent scrutiny</p>
        <h3 id="uk-doge-title" className="mt-2 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
          Where should public-money scrutiny start?
        </h3>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-gray-300 md:text-base">
          This is an independent evidence view, not a government body and not affiliated with the US Department of Government Efficiency. These are leads for examination—not findings of waste, fraud or savings.
        </p>
        <dl className="mt-7 grid gap-6 md:grid-cols-3">
          <div className="border-t border-white/30 pt-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-300">Largest listed value</dt>
            <dd className="mt-2 text-2xl font-semibold">{formatCurrency(data.summary.largestAwardValue, true)}</dd>
            <dd className="mt-2 text-sm leading-6 text-gray-300">Open the notice to distinguish a firm award from a framework ceiling or multi-lot disclosure.</dd>
          </div>
          <div className="border-t border-white/30 pt-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-300">Leading buyer</dt>
            <dd className="mt-2 text-xl font-semibold">{data.summary.topBuyer.name}</dd>
            <dd className="mt-2 text-sm leading-6 text-gray-300">{data.summary.topBuyer.awardCount} ranked awards · {formatCurrency(data.summary.topBuyer.disclosedValue, true)} disclosed.</dd>
          </div>
          <div className="border-t border-white/30 pt-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-300">Leading supplier equal-share scenario</dt>
            <dd className="mt-2 text-xl font-semibold">{data.summary.topSupplier.name}</dd>
            <dd className="mt-2 text-sm leading-6 text-gray-300">{formatCurrency(data.summary.topSupplier.disclosedValue, true)} of {valueBasisDescription(data.summary.valueBasis)} under an equal-share scenario; this is not attributed supplier revenue.{data.summary.topSupplier.entityId ? ` Find a Tender ID: ${data.summary.topSupplier.entityId}.` : ""}</dd>
          </div>
        </dl>
      </section>

      <SupplierMarketConcentration
        suppliers={data.supplierConcentration}
        totalDisclosedValue={data.summary.disclosedValueTotal}
        top10Share={data.summary.top10Share}
        valueBasisLabel={valueBasisDescription(data.summary.valueBasis)}
      />
    </>
  );
}
