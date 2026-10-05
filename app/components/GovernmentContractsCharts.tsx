"use client";

import { GovernmentContractsScrutiny } from "@/app/components/GovernmentContractsScrutiny";
import { GovernmentContractsSupplierBars } from "@/app/components/GovernmentContractsSupplierBars";
import type { ContractsPayload, SupplierConcentrationEntry } from "@/app/components/GovernmentContractsShared";

export function GovernmentContractsCharts({
  data,
  supplierConcentration,
  nationFilter,
  setNationFilter,
  availableNations,
}: {
  data: ContractsPayload;
  supplierConcentration: SupplierConcentrationEntry[];
  nationFilter: string;
  setNationFilter: (value: string) => void;
  availableNations: string[];
}) {
  return (
    <>
      <GovernmentContractsScrutiny data={data} />
      <GovernmentContractsSupplierBars
        data={data}
        supplierConcentration={supplierConcentration}
        nationFilter={nationFilter}
        setNationFilter={setNationFilter}
        availableNations={availableNations}
      />
    </>
  );
}
