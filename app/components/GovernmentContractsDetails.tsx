"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import MetricsStatus from "@/app/components/MetricsStatus";
import { valueBasisDescription } from "@/app/lib/publicMoney";
import type { ContractsPayload } from "@/app/components/GovernmentContractsShared";
import { formatDate } from "@/app/components/GovernmentContractsShared";

export function GovernmentContractsDetails({
  data,
  metrics,
  displayedAwardLimit,
}: {
  data: ContractsPayload;
  metrics: ReturnType<typeof import("@/app/lib/useMetrics").useMetrics>;
  displayedAwardLimit: number;
}) {
  return (
    <>
      <CoreEvidenceExplanation
        idPrefix="government-contracts"
        why={
          <p>
            Large public contract awards show where government spending is being committed and to whom. Independent scrutiny of named buyers and suppliers helps readers judge concentration and procurement choices without implying waste, fraud or savings.
          </p>
        }
        definition={
          <p>
            {data.evidencePolicy.rankingMeasure}. This publication uses {valueBasisDescription(data.summary.valueBasis)} throughout. Only comparable GBP awards in the complete update window are eligible, drawn from Cabinet Office Find a Tender award releases.
          </p>
        }
        unit={`${valueBasisDescription(data.summary.valueBasis)} (GBP)`}
        geography="United Kingdom (Find a Tender central government procurement)"
        interpretation={
          <p>
            Values are disclosure figures from award notices, not a claim about cash already spent or value for money. Ranking order reflects disclosed amounts only.
          </p>
        }
        caveat={
          <p>
            {data.caveats[0] ?? "See the method and coverage details below for full limitations."} This publication uses {valueBasisDescription(data.summary.valueBasis)} throughout. The collector examined {data.dataQuality.releasesSeen.toLocaleString("en-GB")} releases and found {data.dataQuality.validComparableAwards.toLocaleString("en-GB")} comparable awards in the complete window; this display retains the highest-valued awards.
          </p>
        }
        sourceLabel="Find a Tender OCDS API"
        sourceUrl={data.source.apiUrl}
        sourceDate={`Refreshed ${formatDate(data.generatedAt)}`}
        additionalSources={[
          { label: "API documentation", url: data.source.documentationUrl },
          { label: "Open Government Licence", url: data.source.licenceUrl },
        ]}
        explainLabel="Explain this ranking"
      />

      <details className="border-y border-black/20 py-5">
        <summary className="cursor-pointer text-lg font-semibold">Method, coverage and caveats</summary>
        <div className="mt-4 grid gap-6 text-sm leading-6 text-gray-700 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-black">What was ranked</h4>
            <p className="mt-2">{data.evidencePolicy.rankingMeasure}. This publication uses {valueBasisDescription(data.summary.valueBasis)} throughout.</p>
            <p className="mt-3">The collector examined {data.dataQuality.releasesSeen.toLocaleString("en-GB")} releases across {data.dataQuality.pagesFetched.toLocaleString("en-GB")} complete API pages and found {data.dataQuality.validComparableAwards.toLocaleString("en-GB")} comparable awards. The display retains up to {displayedAwardLimit} highest-valued records from that complete window.</p>
            <p className="mt-3">{data.dataQuality.excludedAmbiguousContractValue.toLocaleString("en-GB")} awards were excluded because multiple linked contracts made their value basis ambiguous.</p>
          </div>
          <div>
            <h4 className="font-semibold text-black">Important limitations</h4>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              {data.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
            </ul>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={data.source.apiUrl} target="_blank" rel="noopener noreferrer">Find a Tender OCDS API</a>
          <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={data.source.documentationUrl} target="_blank" rel="noopener noreferrer">API documentation</a>
          <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={data.source.licenceUrl} target="_blank" rel="noopener noreferrer">Open Government Licence</a>
        </div>
      </details>

      <MetricsStatus section="governmentContracts" status={metrics} />
    </>
  );
}
