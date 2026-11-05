"use client";

import { GovernmentContractsScrutiny } from "@/app/components/GovernmentContractsScrutiny";
import type { ContractsPayload } from "@/app/components/GovernmentContractsShared";

export function GovernmentContractsCharts({ data }: { data: ContractsPayload }) {
  return <GovernmentContractsScrutiny data={data} />;
}
