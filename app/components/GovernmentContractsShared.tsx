"use client";

import { FrameworkBadge } from "@/app/components/ContractLeadNotice";
import { valueBasisDescription } from "@/app/lib/publicMoney";

export const FALLBACK = {
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
    valueBasis: "award-value" as "award-value" | "contract-value",
    largestAwardValue: 0,
    top10Share: 0,
    distinctBuyers: 0,
    distinctSuppliers: 0,
    explicitDirectAwards: 0,
    missingProcedure: 0,
    frameworkAwards: 0,
    topBuyer: { name: "", awardCount: 0, disclosedValue: 0 },
    topSupplier: { name: "", entityId: null, awardCount: 0, disclosedValue: 0 },
  },
  awards: [],
  supplierConcentration: [],
  dataQuality: {
    pagesFetched: 0,
    releasesSeen: 0,
    awardsSeen: 0,
    validComparableAwards: 0,
    excludedMissingValue: 0,
    excludedAmbiguousContractValue: 0,
    excludedNonGbp: 0,
    excludedMissingBuyer: 0,
    excludedMissingSupplier: 0,
    excludedMalformed: 0,
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
    displayedAwardLimit: 100,
  },
};

export type Award = {
  rank: number;
  key: string;
  ocid: string;
  releaseId: string;
  awardId: string;
  title: string;
  buyer: string;
  buyerId?: string | null;
  suppliers: string[];
  supplierIds?: Array<string | null>;
  supplierNations: string[];
  awardDate: string;
  publishedAt: string;
  amount: number;
  currency: "GBP";
  valueBasis: "award-value" | "contract-value";
  procurementMethod: string | null;
  procurementMethodDetails: string | null;
  mainProcurementCategory: string | null;
  framework: boolean;
  noticeUrl: string;
  procurementUrl: string;
};

export type SupplierConcentrationEntry = {
  name: string;
  entityId?: string | null;
  identityBasis?: "publisher-id" | "exact-name";
  aliases?: string[];
  awardCount: number;
  disclosedValue: number;
  nation: string;
};

export type ContractsPayload = Omit<typeof FALLBACK, "awards" | "supplierConcentration"> & {
  awards: Award[];
  supplierConcentration: SupplierConcentrationEntry[];
};
export type SortMode = "value-desc" | "value-asc" | "date-desc" | "buyer" | "supplier";

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function SummaryFigure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-t border-black pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums md:text-4xl">{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-600">{note}</p>
    </div>
  );
}

export function AwardCard({ award }: { award: Award }) {
  return (
    <article className={`border-t py-5 first:border-t-0 ${award.framework ? "border-amber-700/40 bg-amber-50/40" : "border-black/20"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rank {award.rank}</p>
          <FrameworkBadge framework={award.framework} />
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(award.amount)}</p>
          <p className="mt-1 text-xs text-gray-600">{valueBasisDescription(award.valueBasis)}</p>
        </div>
      </div>
      <h4 className="mt-3 text-lg font-semibold leading-6">{award.title}</h4>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="font-semibold">Buyer</dt>
          <dd className="mt-1 text-gray-700">{award.buyer}</dd>
        </div>
        <div>
          <dt className="font-semibold">Supplier{award.suppliers.length === 1 ? "" : "s"}</dt>
          <dd className="mt-1 text-gray-700">
            {award.suppliers.map((supplier, index) => (
              <span key={supplier}>
                {index > 0 ? ", " : ""}
                {supplier}{" "}
                <span className="text-xs text-gray-500">
                  ({award.supplierNations[index] ?? "Other/Unknown"})
                </span>
              </span>
            ))}
          </dd>
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
