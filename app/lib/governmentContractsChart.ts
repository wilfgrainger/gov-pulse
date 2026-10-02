import type { ChartMetadata } from "@/app/lib/chartExport";

export type SupplierConcentrationRow = {
  name: string;
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
    schemaVersion: 1,
    title: input.title,
    sourceCitation: `${input.sourceLabel}: ${sourceUrl} · Plot shows ${plotted} of ${input.filteredSupplierCount} filtered suppliers (${input.fullSupplierCount} in the full publication) · Complete update window ${start ?? "date unavailable"} to ${end ?? "date unavailable"}`,
    observationWindow: start && end
      ? { start: { period: start, observedAt: start }, end: { period: end, observedAt: end } }
      : { start: null, end: null },
    series: input.suppliers.map((supplier) => ({
      key: supplier.name,
      label: `${supplier.name} · ${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(supplier.disclosedValue)} · ${supplier.awardCount} awards · ${supplier.nation}`,
    })),
    caveats: [...new Set([
      ...input.caveats,
      "Multi-supplier award values are allocated equally for the supplier ranking.",
      `Only the first ${plotted} supplier rows are included in the image; ${input.filteredSupplierCount} suppliers match the current filter.`,
    ])],
  };
}
