"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PublicMoneyDossierAside from "@/app/components/PublicMoneyDossierAside";
import PublicMoneyNoticeList from "@/app/components/PublicMoneyNoticeList";
import {
  buildDossier,
  contractCoverageLine,
  filteredAwardCoverage,
  parsePublicMoneyUrlState,
  serializePublicAwardsCsv,
  serializePublicMoneyUrlState,
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

export default function PublicMoneyExplorer({
  awards,
  caveats,
  windowLabel = "Not stated",
  completeWindowComparableAwardCount = awards.length,
  excludedAwardCount = null,
}: {
  awards: PublicAward[];
  caveats: string[];
  windowLabel?: string;
  completeWindowComparableAwardCount?: number;
  excludedAwardCount?: number | null;
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
  const coverageLine = contractCoverageLine(completeWindowComparableAwardCount, excludedAwardCount ?? null);
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
      <PublicMoneyNoticeList
        query={query}
        setQuery={setQuery}
        setPage={setPage}
        buyer={buyer}
        setBuyer={setBuyer}
        nation={nation}
        setNation={setNation}
        buyers={buyers}
        nations={nations}
        valueBasis={valueBasis}
        windowLabel={windowLabel}
        coverageLine={coverageLine}
        firstRow={firstRow}
        lastRow={lastRow}
        coverage={coverage}
        listedShareOfSourceWindow={listedShareOfSourceWindow}
        downloadVisibleAwards={downloadVisibleAwards}
        visible={visible}
        pageAwards={pageAwards}
        maximum={maximum}
        setSelected={setSelected}
        pageCount={pageCount}
        currentPage={currentPage}
        caveats={caveats}
      />
      <PublicMoneyDossierAside
        selected={selected}
        coverageLine={coverageLine}
        visible={visible}
        setSelected={setSelected}
        openBuyerDossier={openBuyerDossier}
        openSupplierDossier={openSupplierDossier}
        releaseHistory={releaseHistory}
        historyRequest={historyRequest}
        loadReleaseHistory={loadReleaseHistory}
      />
    </div>
  );
}
