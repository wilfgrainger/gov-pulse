"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { barWidthPercent } from "@/app/lib/chartModel";
import {
  buildDossier,
  filteredAwardCoverage,
  parsePublicMoneyUrlState,
  serializePublicAwardsCsv,
  serializePublicMoneyUrlState,
  valueBasisDescription,
  type AwardDossier,
  type DossierSelection,
  type PublicAward,
} from "@/app/lib/publicMoney";

const PAGE_SIZE = 20;

type ContractReleaseHistory = {
  ocid: string;
  source: {
    packageUrl: string;
    documentationUrl: string;
  };
  releases: Array<{
    id: string;
    date: string;
    tags: string[];
    title: string | null;
    description: string | null;
    noticeUrl: string;
  }>;
};

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

export default function PublicMoneyExplorer({
  awards,
  caveats,
  windowLabel = "Not stated",
  completeWindowComparableAwardCount = awards.length,
}: {
  awards: PublicAward[];
  caveats: string[];
  windowLabel?: string;
  completeWindowComparableAwardCount?: number;
}) {
  const valueBasis = awards[0]?.valueBasis ?? "award-value";
  const [query, setQuery] = useState("");
  const [buyer, setBuyer] = useState("all");
  const [nation, setNation] = useState("all");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<DossierSelection | null>(null);
  const [releaseHistory, setReleaseHistory] = useState<ContractReleaseHistory | null>(null);
  const [historyRequest, setHistoryRequest] = useState<{ ocid: string; state: "loading" | "loaded" | "unavailable" } | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const awardsRef = useRef(awards);

  useEffect(() => {
    awardsRef.current = awards;
  }, [awards]);

  const buyers = useMemo(
    () => [...new Set(awards.map((award) => award.buyer))].sort((a, b) => a.localeCompare(b, "en-GB")),
    [awards],
  );
  const nations = useMemo(
    () => [...new Set(awards.flatMap((award) => award.supplierNations))].sort((a, b) => a.localeCompare(b, "en-GB")),
    [awards],
  );

  useEffect(() => {
    function restoreUrlState() {
      const currentAwards = awardsRef.current;
      const parsed = parsePublicMoneyUrlState(window.location.search);
      const validBuyers = new Set(currentAwards.map((award) => award.buyer));
      const validNations = new Set(currentAwards.flatMap((award) => award.supplierNations));
      const dossier = parsed.dossier && buildDossier(
        currentAwards,
        parsed.dossier.identity,
        parsed.dossier.kind,
        parsed.dossier.basis,
      ) ? parsed.dossier : null;

      setQuery(parsed.query);
      setBuyer(parsed.buyer === "all" || validBuyers.has(parsed.buyer) ? parsed.buyer : "all");
      setNation(parsed.nation === "all" || validNations.has(parsed.nation) ? parsed.nation : "all");
      setPage(parsed.page);
      setSelection(dossier);
      setUrlReady(true);
    }

    restoreUrlState();
    window.addEventListener("popstate", restoreUrlState);
    return () => window.removeEventListener("popstate", restoreUrlState);
  }, []);

  const term = query.trim().toLocaleLowerCase("en-GB");
  const visible = awards.filter((award) =>
    (!term || [
      award.title,
      award.buyer,
      award.buyerId ?? "",
      ...award.suppliers,
      ...(award.supplierIds ?? []).filter((id): id is string => Boolean(id)),
      award.releaseId,
    ].join(" ").toLocaleLowerCase("en-GB").includes(term)) &&
    (buyer === "all" || award.buyer === buyer) &&
    (nation === "all" || award.supplierNations.includes(nation)),
  );
  const selected = selection
    ? buildDossier(visible, selection.identity, selection.kind, selection.basis)
    : null;
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstRow = visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(currentPage * PAGE_SIZE, visible.length);
  const pageAwards = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (!urlReady) return;
    const search = serializePublicMoneyUrlState({ query, buyer, nation, page: currentPage, dossier: selection });
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [buyer, currentPage, nation, page, query, selection, urlReady]);

  function setSelected(dossier: AwardDossier | null) {
    if (!dossier) {
      setSelection(null);
      return;
    }
    const basis: DossierSelection["basis"] = dossier.kind === "notice"
      ? "notice"
      : dossier.identityBasis.startsWith("publisher-")
        ? "publisher-id"
        : "exact-name";
    setSelection({
      identity: dossier.kind === "notice" ? dossier.award.key : dossier.entityId ?? dossier.label,
      kind: dossier.kind,
      basis,
    });
  }

  const coverage = filteredAwardCoverage(awards, visible, completeWindowComparableAwardCount);
  const listedShareOfSourceWindow = coverage.sourceDenominator
    ? coverage.listedCount / coverage.sourceDenominator
    : 0;
  const maximum = Math.max(0, ...visible.map((award) => award.amount));

  function downloadVisibleAwards() {
    const blob = new Blob([serializePublicAwardsCsv(visible, {
      windowLabel,
      listedAwardSampleCount: coverage.listedCount,
      sourceWindowAwardCount: coverage.sourceDenominator,
    })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "public-money-filtered-awards.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openBuyerDossier(award: PublicAward) {
    const basis = award.buyerId ? "publisher-id" : "exact-name";
    const identity = award.buyerId ?? award.buyer;
    setSelected(buildDossier(visible, identity, "buyer", basis));
  }

  function openSupplierDossier(award: PublicAward, supplier: string, index: number) {
    const supplierId = award.supplierIds?.[index] ?? null;
    const basis = supplierId ? "publisher-id" : "exact-name";
    setSelected(buildDossier(visible, supplierId ?? supplier, "supplier", basis));
  }

  async function loadReleaseHistory(ocid: string) {
    setHistoryRequest({ ocid, state: "loading" });
    try {
      const response = await fetch(`/data/contracts/history.json?ocid=${encodeURIComponent(ocid)}`);
      if (!response.ok) throw new Error("Release history is unavailable");
      const payload = await response.json() as ContractReleaseHistory;
      const valid = payload?.ocid === ocid &&
        typeof payload.source?.packageUrl === "string" &&
        typeof payload.source?.documentationUrl === "string" &&
        Array.isArray(payload.releases) && payload.releases.length > 0 &&
        payload.releases.every((release) => {
          if (!release || typeof release.id !== "string" || typeof release.date !== "string" ||
            !Array.isArray(release.tags) || !release.tags.every((tag) => typeof tag === "string") ||
            typeof release.noticeUrl !== "string") return false;
          try {
            const notice = new URL(release.noticeUrl);
            return notice.protocol === "https:" && notice.hostname === "www.find-tender.service.gov.uk" &&
              /^\/Notice\/\d{6}-\d{4}$/.test(notice.pathname);
          } catch {
            return false;
          }
        });
      if (!valid) throw new Error("Release history is invalid");
      setReleaseHistory(payload);
      setHistoryRequest({ ocid, state: "loaded" });
    } catch {
      setHistoryRequest({ ocid, state: "unavailable" });
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.6fr)]">
      <section aria-labelledby="public-money-results" className="min-w-0">
        <div className="min-w-0 border-y-2 border-foreground bg-white p-4 md:p-6">
          <p className="eyebrow">Find a Tender · GBP award notices</p>
          <h2 id="public-money-results" className="mt-2 text-3xl font-black">Award notices and buyer/supplier dossiers</h2>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            Open a notice or inspect records grouped by the publisher&apos;s identifier. Where no identifier is disclosed,
            records are matched by the exact name shown; neither grouping proves legal identity.
          </p>
          <p className="mt-2 text-sm font-semibold">Current value basis: {valueBasisDescription(valueBasis)}.</p>
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
      <aside aria-labelledby="award-dossier-heading" className="h-fit border-y-2 border-foreground bg-surface-warm p-5 md:p-7">
        <p className="eyebrow">Publisher IDs first · exact-name fallback</p>
        <h2 id="award-dossier-heading" className="mt-2 text-2xl font-black">Award dossier</h2>
        {selected ? (
          <div className="mt-5">
            <h3 className="text-lg font-bold">{selected.label}</h3>
            <p className="mt-3 text-sm">
              Total {valueBasisDescription(selected.award.valueBasis)} for matched notices, not supplier revenue: <strong>{pounds(selected.disclosedTotal)}</strong>
            </p>
            <p className="mt-2 text-xs text-gray-600">{selected.noticeCount} matched {selected.noticeCount === 1 ? "notice" : "notices"} · {selected.filteredDenominator} award records in filtered denominator</p>
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
    </div>
  );
}
