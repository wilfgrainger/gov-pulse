import { validateMeasureRecord, type MeasureCatalog } from "@/app/lib/measureCatalog";

export type Watchlist = { version: 1; measureIds: string[] };
export const MAX_WATCHLIST_MEASURES = 50;

export function parseWatchlist(input: unknown, catalog: MeasureCatalog): Watchlist {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Watchlist file must contain a versioned object.");
  const candidate = input as { version?: unknown; measureIds?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.measureIds) || candidate.measureIds.length > MAX_WATCHLIST_MEASURES || candidate.measureIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Watchlist version or measure id list is invalid.");
  }
  const ids = candidate.measureIds as string[];
  if (new Set(ids).size !== ids.length) throw new Error("Watchlist contains duplicate measure ids.");
  for (const id of ids) {
    if (!Object.hasOwn(catalog.measures, id)) throw new Error(`Unknown measure id: ${id}`);
    const measure = validateMeasureRecord(catalog.measures[id]);
    if (measure.id !== id) throw new Error(`Invalid measure record: ${id}`);
  }
  return { version: 1, measureIds: [...ids] };
}
