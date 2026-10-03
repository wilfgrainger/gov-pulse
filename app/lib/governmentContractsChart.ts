import type { ChartMetadata } from "@/app/lib/chartExport";

export type SupplierConcentrationRow = {
  name: string;
  entityId?: string | null;
  identityBasis?: "publisher-id" | "exact-name";
  awardCount: number;
  disclosedValue: number;
  nation: string;
};

function calendarDate(value: string): string | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

export function buildSupplierConcentrationMetadata(input: {
  title: string;
  suppliers: SupplierConcentrationRow[];
  filteredSupplierCount: number;
  fullSupplierCount: number;
  updateWindow: { updatedFrom: string; updatedTo: string };
  sourceUrl: string;
  sourceLabel: string;
  caveats: string[];
}): ChartMetadata {
  const start = calendarDate(input.updateWindow.updatedFrom);
  const end = calendarDate(input.updateWindow.updatedTo);
  const sourceUrl = /^https:\/\//.test(input.sourceUrl) ? input.sourceUrl : "Source URL unavailable in this publication.";
  const plotted = input.suppliers.length;
  return {
    schemaVersion: 2,
    title: input.title,
    sourceCitation: `${input.sourceLabel}: ${sourceUrl} · Equal-share scenario, not supplier revenue · Plot shows ${plotted} of ${input.filteredSupplierCount} filtered supplier groups (${input.fullSupplierCount} in the full publication) · Complete update window ${start ?? "date unavailable"} to ${end ?? "date unavailable"}`,
    observationWindow: start && end
      ? { start: { period: start, observedAt: start }, end: { period: end, observedAt: end } }
      : { start: null, end: null },
    series: input.suppliers.map((supplier) => ({
      key: supplier.entityId ? `id:${supplier.entityId}` : `name:${supplier.name}`,
      label: `${supplier.name}${supplier.entityId ? ` · Find a Tender ID ${supplier.entityId}` : " · exact-name match"} · ${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(supplier.disclosedValue)} scenario value · ${supplier.awardCount} awards · ${supplier.nation}`,
    })),
    observations: input.suppliers.map((supplier) => ({
      period: `${start ?? "date unavailable"} to ${end ?? "date unavailable"}`,
      observedAt: end,
      values: { [supplier.entityId ? `id:${supplier.entityId}` : `name:${supplier.name}`]: supplier.disclosedValue },
      details: { supplier: supplier.name, publisherId: supplier.entityId ?? null, identityBasis: supplier.identityBasis ?? "exact-name", awardCount: supplier.awardCount, nation: supplier.nation },
    })),
    caveats: [...new Set([
      ...input.caveats,
      "Multi-supplier award values are split equally for a comparison scenario; they are not attributed supplier revenue or confirmed expenditure.",
      `Only the first ${plotted} supplier-group rows are included in the image; ${input.filteredSupplierCount} groups match the current filter.`,
    ])],
  };
}
