"use client";

import { useMemo, useState } from "react";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";
import { GovernmentContractsBriefing } from "@/app/components/GovernmentContractsBriefing";
import { GovernmentContractsCharts } from "@/app/components/GovernmentContractsCharts";
import { GovernmentContractsDetails } from "@/app/components/GovernmentContractsDetails";
import { GovernmentContractsTable } from "@/app/components/GovernmentContractsTable";
import {
  FALLBACK,
  type ContractsPayload,
  type SortMode,
} from "@/app/components/GovernmentContractsShared";
import { contractCoverageLine, sumContractExclusions } from "@/app/lib/publicMoney";
import { isCurrentGovernmentContractsPayload } from "@/contracts/government-contracts";

export default function GovernmentContracts() {
  const metrics = useMetrics("governmentContracts", FALLBACK);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("value-desc");
  const [nationFilter, setNationFilter] = useState<string>("all");
  const valid =
    metrics.isLive &&
    metrics.cacheState === "fresh" &&
    metrics.observationStatus === "current" &&
    isCurrentGovernmentContractsPayload(metrics.data);
  const data = metrics.data as ContractsPayload;
  const displayedAwardLimit = data.evidencePolicy?.displayedAwardLimit ?? 100;

  const displayedAwards = useMemo(() => {
    if (!valid) return [];
    const search = query.trim().toLocaleLowerCase("en-GB");
    const filtered = data.awards.filter((award) => {
      const matchesSearch = search
        ? [award.title, award.buyer, ...award.suppliers, award.releaseId, award.ocid]
            .join(" ")
            .toLocaleLowerCase("en-GB")
            .includes(search)
        : true;
      const matchesNation =
        nationFilter === "all" || award.supplierNations.includes(nationFilter);
      return matchesSearch && matchesNation;
    });
    return filtered.sort((left, right) => {
      if (sortMode === "value-asc") return left.amount - right.amount;
      if (sortMode === "date-desc") return Date.parse(right.awardDate) - Date.parse(left.awardDate);
      if (sortMode === "buyer") return left.buyer.localeCompare(right.buyer, "en-GB");
      if (sortMode === "supplier") {
        return left.suppliers.join(", ").localeCompare(right.suppliers.join(", "), "en-GB");
      }
      return right.amount - left.amount;
    });
  }, [data.awards, nationFilter, query, sortMode, valid]);

  const supplierConcentration = useMemo(() => {
    if (!valid) return [];
    if (nationFilter === "all") return data.supplierConcentration;
    return data.supplierConcentration.filter((entry) => entry.nation === nationFilter);
  }, [data.supplierConcentration, nationFilter, valid]);

  const availableNations = useMemo(() => {
    if (!valid) return [];
    return [...new Set(data.supplierConcentration.map((entry) => entry.nation))].sort(
      (left, right) => left.localeCompare(right, "en-GB")
    );
  }, [data.supplierConcentration, valid]);

  if (!valid) {
    return (
      <>
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Government contracts evidence temporarily unavailable</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            This section only publishes after the complete Find a Tender update window and every API page, source link and disclosure check reconcile. A smaller complete edition remains valid; estimates never fill missing records.
          </p>
        </section>
        <MetricsStatus section="governmentContracts" status={metrics} />
      </>
    );
  }

  const excludedTotal = sumContractExclusions(data.dataQuality);
  const coverageLine = contractCoverageLine(data.dataQuality.validComparableAwards, excludedTotal);
  const leadAward = data.awards[0] ?? null;

  return (
    <div className="space-y-10">
      <GovernmentContractsBriefing data={data} leadAward={leadAward} coverageLine={coverageLine} />
      <GovernmentContractsCharts
        data={data}
        supplierConcentration={supplierConcentration}
        nationFilter={nationFilter}
        setNationFilter={setNationFilter}
        availableNations={availableNations}
      />
      <GovernmentContractsTable
        data={data}
        displayedAwards={displayedAwards}
        query={query}
        setQuery={setQuery}
        sortMode={sortMode}
        setSortMode={setSortMode}
      />
      <GovernmentContractsDetails data={data} metrics={metrics} displayedAwardLimit={displayedAwardLimit} />
    </div>
  );
}
