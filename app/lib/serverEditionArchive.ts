import { SITE_DISCOVERY } from "@/app/lib/discovery";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

export type EditionSummary = NonNullable<MetricsSnapshot["meta"]["editionSummary"]>;
export type ArchivedEdition = { edition: string; asOf: string; availability: "historical"; measureCatalog: MeasureCatalog; summary: EditionSummary };

function safeEditionId(value: string) { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(value); }

export async function readEditionSummaries(): Promise<EditionSummary[] | null> {
  try {
    const response = await fetch(new URL("/data/editions.json", SITE_DISCOVERY.origin), { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const payload = await response.json() as { editions?: unknown };
    return Array.isArray(payload.editions) ? payload.editions as EditionSummary[] : null;
  } catch { return null; }
}

export async function readArchivedEdition(id: string): Promise<ArchivedEdition | null> {
  if (!safeEditionId(id)) return null;
  try {
    const url = new URL("/data/edition.json", SITE_DISCOVERY.origin);
    url.searchParams.set("edition", id);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const payload = await response.json() as ArchivedEdition;
    if (payload.availability !== "historical" || payload.edition !== id || payload.measureCatalog?.editionId !== id) return null;
    return payload;
  } catch { return null; }
}
