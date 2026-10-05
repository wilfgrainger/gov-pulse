"use client";

import Link from "next/link";
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

type ContractReleaseHistory = {
  ocid: string;
  source: { packageUrl: string; documentationUrl: string };
  releases: Array<{
    id: string;
    date: string;
    tags: string[];
    title: string | null;
    description: string | null;
    noticeUrl: string;
  }>;
};

export type PublicMoneyDossierAsideProps = {
  selected: AwardDossier | null;
  coverageLine: string | null;
  visible: PublicAward[];
  setSelected: (dossier: AwardDossier | null) => void;
  openBuyerDossier: (award: PublicAward) => void;
  openSupplierDossier: (award: PublicAward, supplier: string, index: number) => void;
  releaseHistory: ContractReleaseHistory | null;
  historyRequest: { ocid: string; state: "loading" | "loaded" | "unavailable" } | null;
  loadReleaseHistory: (ocid: string) => void;
};

export default function PublicMoneyDossierAside({
  selected,
  coverageLine,
  visible,
  setSelected,
  openBuyerDossier,
  openSupplierDossier,
  releaseHistory,
  historyRequest,
  loadReleaseHistory,
}: PublicMoneyDossierAsideProps) {
  return (
<aside aria-labelledby="award-dossier-heading" className="h-fit border-y-2 border-foreground bg-surface-warm p-5 md:p-7">
        <p className="eyebrow">Publisher IDs first · exact-name fallback</p>
        <h2 id="award-dossier-heading" className="mt-2 text-2xl font-black">Award dossier</h2>
        {selected ? (
          <div className="mt-5">
            <h3 className="text-lg font-bold">{selected.label}</h3>
            {coverageLine ? (
              <p className="mt-3 text-sm">
                Total {valueBasisDescription(selected.award.valueBasis)} for matched notices, not supplier revenue: <strong>{pounds(selected.disclosedTotal)}</strong>
                <span className="mt-1 block text-xs text-gray-600">{coverageLine}. Value basis: {valueBasisDescription(selected.award.valueBasis)}.</span>
              </p>
            ) : (
              <p role="status" className="mt-3 text-sm text-gray-700">
                Matched-notice money totals are withheld until exclusion counts are complete. Open individual Find a Tender notices instead.
              </p>
            )}
            <p className="mt-2 text-xs text-gray-600">{selected.noticeCount} matched {selected.noticeCount === 1 ? "notice" : "notices"} · {selected.filteredDenominator} award records in filtered denominator</p>
            <p className="mt-2">
              <span className={selected.award.framework ? "inline-flex border border-amber-700 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-900" : "inline-flex border border-black/20 bg-white px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-gray-700"}>
                {frameworkValueLabel(selected.award.framework)}
              </span>
            </p>
            {selected.entityId && <p className="mt-2 text-xs font-mono text-gray-700">Publisher {selected.kind} ID: {selected.entityId}</p>}
            {selected.aliases.length > 0 && <p className="mt-2 text-xs text-gray-700">Names disclosed for this ID: {selected.aliases.join(" · ")}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelected(buildDossier(visible, selected.award.key, "notice", "notice"))} aria-pressed={selected.kind === "notice"} className={`min-h-10 border px-3 text-xs font-bold ${selected.kind === "notice" ? "border-foreground bg-accent-soft" : "border-line bg-white"}`}>Single notice</button>
              <button type="button" onClick={() => openBuyerDossier(selected.award)} aria-pressed={selected.kind === "buyer"} className={`min-h-10 border px-3 text-xs font-bold ${selected.kind === "buyer" ? "border-foreground bg-accent-soft" : "border-line bg-white"}`}>{selected.award.buyerId ? `Buyer ID: ${selected.award.buyerId}` : "Exact buyer name"}</button>
              {selected.award.suppliers.map((supplier, index) => {
                const supplierId = selected.award.supplierIds?.[index] ?? null;
                const active = selected.kind === "supplier" && (supplierId ? selected.entityId === supplierId : selected.label === supplier);
                return (
                  <button key={`${supplierId ?? supplier}:${index}`} type="button" onClick={() => openSupplierDossier(selected.award, supplier, index)} aria-pressed={active} className={`min-h-10 border px-3 text-xs font-bold ${active ? "border-foreground bg-accent-soft" : "border-line bg-white"}`}>
                    {supplierId ? `Supplier ID: ${supplier} · ${supplierId}` : `Exact supplier name: ${supplier}`}
                  </button>
                );
              })}
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-bold">Buyer disclosed on selected notice</dt><dd>{selected.award.buyer}</dd></div>
              <div><dt className="font-bold">Supplier strings on selected notice</dt><dd>{selected.award.suppliers.join(", ")}</dd></div>
            </dl>
            {selected.noticeLinks.length > 0 && (
              <section aria-label="Award-value timeline" className="mt-4 border-t border-line pt-4">
                <h4 className="text-sm font-bold">Matched notices by award date</h4>
                <ol className="mt-2 space-y-2 text-sm">
                  {selected.noticeLinks.map((notice) => (
                    <li key={notice.releaseId} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                      <a className="underline" href={notice.noticeUrl} target="_blank" rel="noreferrer">
                        Notice {notice.releaseId} · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(notice.awardDate))}
                      </a>
                      <span className="font-mono tabular-nums">{pounds(notice.amount)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {releaseHistory?.ocid === selected.award.ocid ? (
              <section aria-label="Publisher release history" className="mt-4 border-t border-line pt-4">
                <h4 className="text-sm font-bold">Find a Tender release history</h4>
                <p className="mt-2 text-xs leading-5 text-gray-700">
                  The dated releases returned in this publisher record package. Tags retain the publisher&apos;s release type; events may be missing if they were not submitted to Find a Tender.
                </p>
                <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">
                  {releaseHistory.releases.map((release) => (
                    <li key={release.id}>
                      <a className="font-bold underline" href={release.noticeUrl} target="_blank" rel="noreferrer">
                        {release.id} · {release.tags.join(", ")}
                      </a>
                      <time className="mt-1 block text-xs text-gray-600" dateTime={release.date}>
                        Source release date: {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(release.date))}
                      </time>
                      {release.title && <p className="mt-1 font-semibold">{release.title}</p>}
                      {release.description && <p className="mt-1 text-gray-700">{release.description}</p>}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                  <a className="underline" href={releaseHistory.source.packageUrl} target="_blank" rel="noreferrer">Original record package</a>
                  <a className="underline" href={releaseHistory.source.documentationUrl} target="_blank" rel="noreferrer">API method and limits</a>
                </p>
              </section>
            ) : (
              <div className="mt-4 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => void loadReleaseHistory(selected.award.ocid)}
                  disabled={historyRequest?.ocid === selected.award.ocid && historyRequest.state === "loading"}
                  className="min-h-10 border border-foreground bg-white px-3 text-sm font-bold underline decoration-black/30 underline-offset-4 hover:bg-surface-warm disabled:cursor-wait disabled:opacity-60"
                >
                  {historyRequest?.ocid === selected.award.ocid && historyRequest.state === "loading" ? "Loading source history…" : "Load source release history"}
                </button>
                {historyRequest?.ocid === selected.award.ocid && historyRequest.state === "unavailable" && (
                  <p role="status" className="mt-2 text-sm text-gray-700">The publisher release history is temporarily unavailable. The official notice and procurement record remain available below.</p>
                )}
                <p className="mt-2 text-xs text-gray-600">Loads dated notices, updates, awards and amendments published under this exact OCID.</p>
              </div>
            )}
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs leading-5 text-gray-700">{selected.caveats.map((item) => <li key={item}>{item}</li>)}</ul>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
              <a className="underline" href={selected.award.noticeUrl} target="_blank" rel="noreferrer">Selected official notice</a>
              <a className="underline" href={selected.award.procurementUrl} target="_blank" rel="noreferrer">Selected procurement record</a>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-gray-700">Select an award to inspect its source record, then group by a disclosed publisher ID or exact fallback name across the visible award window.</p>
        )}
        <p className="mt-6 border-t border-line pt-4 text-xs leading-5 text-gray-600">Fiscal measures such as receipts and debt use different units, periods and bases. Inspect their published records separately; this page does not label procurement awards as paid spending.</p>
        <Link className="mt-3 inline-block text-sm font-bold underline" href="/measure/receipts">Inspect central-government receipts →</Link>
      </aside>
  );
}
