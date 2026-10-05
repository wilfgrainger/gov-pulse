"use client";

import {
  dossierHref,
  frameworkValueLabel,
  valueBasisDescription,
} from "@/app/lib/publicMoney";

type Award = {
  rank: number;
  key: string;
  title: string;
  buyer: string;
  buyerId?: string | null;
  suppliers: string[];
  supplierIds?: Array<string | null>;
  awardDate: string;
  amount: number;
  valueBasis: "award-value" | "contract-value";
  procurementMethod: string | null;
  procurementMethodDetails: string | null;
  framework: boolean;
  noticeUrl: string;
  procurementUrl: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
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

function FrameworkBadge({ framework }: { framework: boolean }) {
  return (
    <span
      className={
        framework
          ? "inline-flex border border-amber-700 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-900"
          : "inline-flex border border-black/20 bg-white px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-gray-700"
      }
    >
      {frameworkValueLabel(framework)}
    </span>
  );
}

function LeadNoticeCard({ award }: { award: Award }) {
  const buyerHref = award.buyerId
    ? `/money/buyer/${encodeURIComponent(award.buyerId)}`
    : dossierHref({ kind: "buyer", basis: "exact-name", identity: award.buyer });

  return (
    <article
      data-testid="lead-notice"
      className="border-y-2 border-foreground bg-white p-5 md:p-7"
      aria-labelledby="lead-notice-title"
    >
      <p className="text-sm font-semibold text-accent">Lead notice · not a money total</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FrameworkBadge framework={award.framework} />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rank {award.rank}</span>
      </div>
      <h3 id="lead-notice-title" className="mt-3 max-w-4xl text-2xl font-semibold leading-tight tracking-[-0.03em] md:text-4xl">
        {award.title}
      </h3>
      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <dt className="font-semibold">Buyer</dt>
          <dd className="mt-1 text-gray-700">
            <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={buyerHref}>
              {award.buyer}
            </a>
            {award.buyerId ? <span className="mt-1 block font-mono text-xs text-gray-600">ID {award.buyerId}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Supplier{award.suppliers.length === 1 ? "" : "s"}</dt>
          <dd className="mt-1 text-gray-700">
            {award.suppliers.map((name, index) => {
              const id = award.supplierIds?.[index] ?? null;
              const href = id
                ? `/money/supplier/${encodeURIComponent(id)}`
                : dossierHref({ kind: "supplier", basis: "exact-name", identity: name });
              return (
                <span key={`${name}:${index}`} className="block">
                  <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={href}>
                    {name}
                  </a>
                  {id ? <span className="ml-2 font-mono text-xs text-gray-600">ID {id}</span> : null}
                </span>
              );
            })}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Recorded value</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatCurrency(award.amount)}</dd>
          <dd className="mt-1 text-xs text-gray-600">{valueBasisDescription(award.valueBasis)} · not confirmed expenditure</dd>
        </div>
        <div>
          <dt className="font-semibold">Procedure</dt>
          <dd className="mt-1 text-gray-700">
            {award.procurementMethodDetails ?? award.procurementMethod ?? "Not disclosed"}
          </dd>
          <dd className="mt-1 text-xs text-gray-600">Awarded {formatDate(award.awardDate)}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={award.noticeUrl} target="_blank" rel="noopener noreferrer">
          Open Find a Tender notice
        </a>
        <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href={award.procurementUrl} target="_blank" rel="noopener noreferrer">
          Procurement history
        </a>
        <a className="underline decoration-black/30 underline-offset-4 hover:decoration-black" href="/money">
          Buyer and supplier dossiers
        </a>
      </div>
    </article>
  );
}

export { FrameworkBadge, LeadNoticeCard };
export type { Award as LeadAward };
