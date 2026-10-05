"use client";

import { LeadNoticeCard } from "@/app/components/ContractLeadNotice";
import {
  SummaryFigure,
  formatCurrency,
  formatDate,
  type Award,
  type ContractsPayload,
} from "@/app/components/GovernmentContractsShared";
import { valueBasisDescription } from "@/app/lib/publicMoney";

export function GovernmentContractsBriefing({
  data,
  leadAward,
  coverageLine,
}: {
  data: ContractsPayload;
  leadAward: Award | null;
  coverageLine: string | null;
}) {
  return (
    <>
      <section aria-labelledby="contracts-briefing-title" className="border-y border-foreground py-6">
        <p className="text-sm font-semibold text-accent">Official procurement notices</p>
        <h3 id="contracts-briefing-title" className="mt-2 max-w-5xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl">
          Notices updated, not money spent
        </h3>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-gray-700">
          Cabinet Office Find a Tender award releases updated between {data.window.label}. This is a seven-day notices window, not a claim about cash paid that week. Values use {valueBasisDescription(data.summary.valueBasis)}; they are not confirmed expenditure or a value-for-money assessment.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {data.window.basis}. Refreshed {formatDate(data.generatedAt)} using {data.source.standard}.
        </p>
      </section>

      {leadAward ? <LeadNoticeCard award={leadAward} /> : null}

      {coverageLine ? (
        <section aria-label="Government contracts summary" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryFigure
            label="Comparable awards in window"
            value={data.dataQuality.validComparableAwards.toLocaleString("en-GB")}
            note={`${coverageLine}. Ranked display retains the highest-valued notices, not every award.`}
          />
          <SummaryFigure
            label="Value in ranked notices"
            value={formatCurrency(data.summary.disclosedValueTotal, true)}
            note={`${coverageLine}. Sum of displayed notices using ${valueBasisDescription(data.summary.valueBasis)}; not confirmed expenditure.`}
          />
          <SummaryFigure
            label="Framework maxima in ranking"
            value={data.summary.frameworkAwards.toLocaleString("en-GB")}
            note="Framework ceilings are visually distinct from single awards. A maximum is not committed spend."
          />
          <SummaryFigure
            label="Named suppliers"
            value={data.summary.distinctSuppliers.toLocaleString("en-GB")}
            note={`${data.summary.distinctBuyers.toLocaleString("en-GB")} distinct buyers in the displayed ranking.`}
          />
        </section>
      ) : (
        <p role="status" className="border border-black/20 bg-white p-4 text-sm text-gray-700">
          Ranked money totals are withheld until exclusion counts are complete. Open individual notices instead.
        </p>
      )}
    </>
  );
}
