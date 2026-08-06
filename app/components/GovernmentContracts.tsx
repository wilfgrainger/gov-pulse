"use client";

import { useMemo, useState } from "react";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";
import { isCurrentGovernmentContractsPayload } from "@/contracts/government-contracts";

const FALLBACK = {
  available: false,
  generatedAt: "",
  window: { updatedFrom: "", updatedTo: "", label: "", basis: "" },
  source: {
    publisher: "",
    service: "",
    apiUrl: "",
    documentationUrl: "",
    licenceUrl: "",
    standard: "",
  },
  summary: {
    awardCount: 0,
    disclosedValueTotal: 0,
    largestAwardValue: 0,
    top10Share: 0,
    distinctBuyers: 0,
    distinctSuppliers: 0,
    explicitDirectAwards: 0,
    missingProcedure: 0,
    frameworkAwards: 0,
    topBuyer: { name: "", awardCount: 0, disclosedValue: 0 },
    topSupplier: { name: "", awardCount: 0, disclosedValue: 0 },
  },
  awards: [],
  dataQuality: {
    pagesFetched: 0,
    releasesSeen: 0,
    awardsSeen: 0,
    validComparableAwards: 0,
    excludedMissingValue: 0,
    excludedNonGbp: 0,
    excludedMissingBuyer: 0,
    excludedMissingSupplier: 0,
    duplicatesRemoved: 0,
  },
  caveats: [],
  evidencePolicy: {
    rankingMeasure: "",
    actualSpendClaim: false,
    wasteClaim: false,
    fraudClaim: false,
    savingClaim: false,
    supplierAllocationMethod: "",
    comparisonCurrency: "GBP",
    requiredAwardCount: 100,
  },
};

type Award = {
  rank: number;
  key: string;
  ocid: string;
  releaseId: string;
  awardId: string;
  title: string;
  buyer: string;
  suppliers: string[];
  awardDate: string;
  publishedAt: string;
  amount: number;
  currency: "GBP";
  procurementMethod: string | null;
  procurementMethodDetails: string | null;
  mainProcurementCategory: string | null;
  framework: boolean;
  noticeUrl: string;
  procurementUrl: string;
};

type ContractsPayload = Omit<typeof FALLBACK, "awards"> & { awards: Award[] };
type SortMode = "value-desc" | "value-asc" | "date-desc" | "buyer" | "supplier";

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function SummaryFigure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-t border-black pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums md:text-4xl">{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-600">{note}</p>
    </div>
  );
}

function AwardCard({ award }: { award: Award }) {
  return (
    <article className="border-t border-black/20 py-5 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rank {award.rank}</p>
        <p className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(award.amount)}</p>
      </div>
      <h4 className="mt-3 text-lg font-semibold leading-6">{award.title}</h4>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="font-semibold">Buyer</dt>
          <dd className="mt-1 text-gray-700">{award.buyer}</dd>
        </div>
        <div>
          <dt className="font-semibold">Supplier{award.suppliers.length === 1 ? "" : "s"}</dt>
          <dd className="mt-1 text-gray-700">{award.suppliers.join(", ")}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-semibold">Award date</dt>
            <dd className="mt-1 text-gray-700">{formatDate(award.awardDate)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Procedure</dt>
            <dd className="mt-1 text-gray-700">
              {award.procurementMethodDetails ?? award.procurementMethod ?? "Not disclosed"}
            </dd>
          </div>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={award.noticeUrl} target="_blank" rel="noopener noreferrer">
          Open award notice
        </a>
        <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={award.procurementUrl} target="_blank" rel="noopener noreferrer">
          Procurement history
        </a>
      </div>
    </article>
  );
}

export default function GovernmentContracts() {
  const metrics = useMetrics("governmentContracts", FALLBACK);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("value-desc");
  const valid =
    metrics.isLive &&
    metrics.cacheState === "fresh" &&
    metrics.observationStatus === "current" &&
    isCurrentGovernmentContractsPayload(metrics.data);
  const data = metrics.data as ContractsPayload;

  const displayedAwards = useMemo(() => {
    if (!valid) return [];
    const search = query.trim().toLocaleLowerCase("en-GB");
    const filtered = search
      ? data.awards.filter((award) =>
          [award.title, award.buyer, ...award.suppliers, award.releaseId, award.ocid]
            .join(" ")
            .toLocaleLowerCase("en-GB")
            .includes(search)
        )
      : [...data.awards];
    return filtered.sort((left, right) => {
      if (sortMode === "value-asc") return left.amount - right.amount;
      if (sortMode === "date-desc") return Date.parse(right.awardDate) - Date.parse(left.awardDate);
      if (sortMode === "buyer") return left.buyer.localeCompare(right.buyer, "en-GB");
      if (sortMode === "supplier") {
        return left.suppliers.join(", ").localeCompare(right.suppliers.join(", "), "en-GB");
      }
      return right.amount - left.amount;
    });
  }, [data.awards, query, sortMode, valid]);

  if (!valid) {
    return (
      <>
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Government contracts evidence temporarily unavailable</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            This section only publishes when a complete Find a Tender update window produces 100 comparable GBP awards and the ranking, source links and disclosure checks all reconcile. It does not substitute estimates or an incomplete page of notices.
          </p>
        </section>
        <MetricsStatus section="governmentContracts" status={metrics} />
      </>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="contracts-briefing-title" className="border-y border-foreground py-6">
        <p className="text-sm font-semibold text-accent">Official procurement notices</p>
        <h3 id="contracts-briefing-title" className="mt-2 max-w-5xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl">
          The 100 largest disclosed government contract awards in the latest complete window.
        </h3>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-gray-700">
          Ranked from Cabinet Office Find a Tender award releases updated between {data.window.label}. Values are disclosure figures, not a claim about cash already spent or value for money.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {data.window.basis}. Refreshed {formatDate(data.generatedAt)} using {data.source.standard}.
        </p>
      </section>

      <section aria-label="Government contracts summary" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryFigure
          label="Disclosed value"
          value={formatCurrency(data.summary.disclosedValueTotal, true)}
          note="Sum of the 100 ranked award values; not confirmed expenditure."
        />
        <SummaryFigure
          label="Top ten share"
          value={`${data.summary.top10Share.toFixed(1)}%`}
          note="Share of the ranked disclosed value held by the ten largest awards."
        />
        <SummaryFigure
          label="Named suppliers"
          value={data.summary.distinctSuppliers.toLocaleString("en-GB")}
          note={`${data.summary.distinctBuyers.toLocaleString("en-GB")} distinct buyers in the top 100.`}
        />
        <SummaryFigure
          label="Explicit direct signals"
          value={data.summary.explicitDirectAwards.toLocaleString("en-GB")}
          note={`${data.summary.missingProcedure.toLocaleString("en-GB")} awards do not disclose a procedure label in the accepted fields.`}
        />
      </section>

      <section id="uk-doge" aria-labelledby="uk-doge-title" className="border border-black bg-[#172234] p-6 text-white md:p-8">
        <p className="text-sm font-semibold text-red-300">UK DOGE · independent scrutiny</p>
        <h3 id="uk-doge-title" className="mt-2 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
          Where should public-money scrutiny start?
        </h3>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-gray-300 md:text-base">
          This is an independent evidence view, not a government body and not affiliated with the US Department of Government Efficiency. These are leads for examination—not findings of waste, fraud or savings.
        </p>
        <dl className="mt-7 grid gap-6 md:grid-cols-3">
          <div className="border-t border-white/30 pt-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-300">Largest disclosed award</dt>
            <dd className="mt-2 text-2xl font-semibold">{formatCurrency(data.summary.largestAwardValue, true)}</dd>
            <dd className="mt-2 text-sm leading-6 text-gray-300">Open the notice to distinguish a firm award from a framework ceiling or multi-lot disclosure.</dd>
          </div>
          <div className="border-t border-white/30 pt-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-300">Leading buyer</dt>
            <dd className="mt-2 text-xl font-semibold">{data.summary.topBuyer.name}</dd>
            <dd className="mt-2 text-sm leading-6 text-gray-300">{data.summary.topBuyer.awardCount} ranked awards · {formatCurrency(data.summary.topBuyer.disclosedValue, true)} disclosed.</dd>
          </div>
          <div className="border-t border-white/30 pt-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-300">Leading supplier allocation</dt>
            <dd className="mt-2 text-xl font-semibold">{data.summary.topSupplier.name}</dd>
            <dd className="mt-2 text-sm leading-6 text-gray-300">{formatCurrency(data.summary.topSupplier.disclosedValue, true)} using equal allocation where an award names multiple suppliers.</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="contracts-table-title">
        <div className="grid gap-4 border-b border-black/20 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] md:items-end">
          <div>
            <p className="text-sm font-semibold text-accent">Top 100 explorer</p>
            <h3 id="contracts-table-title" className="mt-1 text-2xl font-semibold md:text-3xl">Search buyers, suppliers and awards</h3>
          </div>
          <p className="text-sm leading-6 text-gray-600">Every row links to the official notice and full procurement history.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="text-sm font-semibold">
            Search the top 100
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
        <p role="status" className="mt-4 text-sm text-gray-600">Showing {displayedAwards.length} of 100 awards.</p>

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
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3 text-right">Disclosed value</th>
                <th scope="col" className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-white">
              {displayedAwards.map((award) => (
                <tr key={award.key}>
                  <td className="px-4 py-4 align-top font-mono tabular-nums">{award.rank}</td>
                  <th scope="row" className="max-w-sm px-4 py-4 align-top font-semibold">{award.title}</th>
                  <td className="max-w-xs px-4 py-4 align-top">
                    <span className="block font-semibold">{award.buyer}</span>
                    <span className="mt-1 block text-gray-600">{award.suppliers.join(", ")}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top">{formatDate(award.awardDate)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right align-top font-mono font-semibold tabular-nums">{formatCurrency(award.amount)}</td>
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

      <details className="border-y border-black/20 py-5">
        <summary className="cursor-pointer text-lg font-semibold">Method, coverage and caveats</summary>
        <div className="mt-4 grid gap-6 text-sm leading-6 text-gray-700 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-black">What was ranked</h4>
            <p className="mt-2">{data.evidencePolicy.rankingMeasure}. Only comparable GBP awards in the complete update window are eligible.</p>
            <p className="mt-3">The collector examined {data.dataQuality.releasesSeen.toLocaleString("en-GB")} releases across {data.dataQuality.pagesFetched.toLocaleString("en-GB")} complete API pages and found {data.dataQuality.validComparableAwards.toLocaleString("en-GB")} comparable awards before selecting the largest 100.</p>
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
    </div>
  );
}
