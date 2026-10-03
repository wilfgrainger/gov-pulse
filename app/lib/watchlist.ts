import { validateMeasureRecord, type MeasureCatalog, type MeasureRecord } from "@/app/lib/measureCatalog";

export type Watchlist = { version: 1; measureIds: string[] };
export type WatchEvidenceReference = { signature: string; sourceEditionId: string };
export type WatchEvidenceState = "first-visit" | "changed" | "edition-only" | "unchanged" | "unavailable";
export type WatchEvidenceBaselines = { version: 1; measures: Record<string, WatchEvidenceReference> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function buildWatchEvidenceReference(record: MeasureRecord | null | undefined): Promise<WatchEvidenceReference | null> {
  if (!record) return null;
  const points = [...record.points]
    .map(({ period, observedAt, value, valueStatus }) => ({ period, observedAt, value, valueStatus }))
    .sort((left, right) => left.period.localeCompare(right.period) || left.observedAt.localeCompare(right.observedAt));
  const evidence = {
    id: record.id,
    label: record.label,
    evidenceClass: record.evidenceClass,
    comparisonKey: record.comparisonKey,
    cadence: record.cadence,
    unit: record.unit,
    basis: record.basis,
    note: record.note ?? null,
    publisher: record.publisher ?? null,
    geography: record.geography,
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl,
    observationPeriod: record.observationPeriod,
    value: record.value,
    points,
    caveats: record.caveats,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(evidence));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const signature = [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
  return { signature, sourceEditionId: record.sourceEditionId };
}

export function compareWatchEvidence(previous: WatchEvidenceReference | undefined, current: WatchEvidenceReference | null): WatchEvidenceState {
  if (!current) return "unavailable";
  if (!previous) return "first-visit";
  if (previous.signature !== current.signature) return "changed";
  if (previous.sourceEditionId !== current.sourceEditionId) return "edition-only";
  return "unchanged";
}

export function parseWatchEvidenceBaselines(input: unknown, catalog: MeasureCatalog): WatchEvidenceBaselines {
  if (!isRecord(input) || input.version !== 1 || !isRecord(input.measures)) return { version: 1, measures: {} };
  const measures: Record<string, WatchEvidenceReference> = {};
  for (const [id, raw] of Object.entries(input.measures)) {
    if (!Object.hasOwn(catalog.measures, id) || !isRecord(raw)) continue;
    if (typeof raw.signature !== "string" || !/^[a-f0-9]{64}$/.test(raw.signature)) continue;
    if (typeof raw.sourceEditionId !== "string" || !raw.sourceEditionId.trim() || raw.sourceEditionId.length > 256) continue;
    measures[id] = { signature: raw.signature, sourceEditionId: raw.sourceEditionId };
  }
  return { version: 1, measures };
}

export function parseWatchlist(input: unknown, catalog: MeasureCatalog): Watchlist {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Watchlist file must contain a versioned object.");
  const candidate = input as { version?: unknown; measureIds?: unknown };
  const availableIds = Object.keys(catalog.measures);
  if (candidate.version !== 1 || !Array.isArray(candidate.measureIds) || candidate.measureIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Watchlist version or measure id list is invalid.");
  }
  if (candidate.measureIds.length > availableIds.length) throw new Error("Watchlist contains more unique IDs than the validated measure catalog.");
  const ids = candidate.measureIds as string[];
  if (new Set(ids).size !== ids.length) throw new Error("Watchlist contains duplicate measure ids.");
  for (const id of ids) {
    if (!Object.hasOwn(catalog.measures, id)) throw new Error(`Unknown measure id: ${id}`);
    const measure = validateMeasureRecord(catalog.measures[id]);
    if (measure.id !== id) throw new Error(`Invalid measure record: ${id}`);
  }
  return { version: 1, measureIds: [...ids] };
}
