import { SITE_DISCOVERY } from "@/app/lib/discovery";
import { publicationEnabled } from "@/contracts/publication-policy";
import { validateMeasureRecord } from "@/app/lib/measureCatalog";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

export type EditionSummary = NonNullable<MetricsSnapshot["meta"]["editionSummary"]>;
export type ListedEditionSummary = EditionSummary & { asOf?: string };
export type ArchivedEdition = { edition: string; asOf: string; availability: "historical"; measureCatalog: MeasureCatalog; summary: EditionSummary };

function safeEditionId(value: string) { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(value); }

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validInstant(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validDateOrNull(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTextOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && Boolean(value.trim()) && value.length <= 500);
}

function validOptionalInstant(value: unknown): boolean {
  return value === undefined || value === null || validInstant(value);
}

function validOptionalSourceUrl(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

function validOptionalFieldList(value: unknown): boolean {
  return value === undefined || Array.isArray(value) && value.length <= 20 &&
    value.every((field) => typeof field === "string" && /^[A-Za-z][A-Za-z0-9.]{0,79}$/.test(field));
}

function validSummaryCorrection(value: unknown, editionId: string, previousEditionId: unknown): boolean {
  if (value === undefined) return true;
  return object(value) && value.kind === "baseline-reconciliation" &&
    typeof value.baselineEditionId === "string" && safeEditionId(value.baselineEditionId) &&
    value.baselineEditionId !== editionId && value.baselineEditionId === previousEditionId &&
    typeof value.note === "string" && Boolean(value.note.trim()) && value.note.length <= 500;
}

function validEditionSummary(value: unknown, id?: string): value is EditionSummary {
  if (!object(value) || typeof value.id !== "string" || !safeEditionId(value.id) || (id && value.id !== id) ||
    !validInstant(value.publishedAt) || value.asOf !== undefined && !validInstant(value.asOf) || !(value.previousEditionId === undefined || value.previousEditionId === null ||
      typeof value.previousEditionId === "string" && safeEditionId(value.previousEditionId)) ||
    !validSummaryCorrection(value.summaryCorrection, value.id, value.previousEditionId) ||
    !Array.isArray(value.sourceEditionIds) || value.sourceEditionIds.length > 100 ||
    !Array.isArray(value.changes) || value.changes.length > 5_000) return false;
  const sourceIds = new Set<string>();
  for (const sourceId of value.sourceEditionIds) {
    if (typeof sourceId !== "string" || !sourceId.trim() || sourceId.length > 200 || sourceIds.has(sourceId)) return false;
    sourceIds.add(sourceId);
  }
  for (const change of value.changes) {
    if (!object(change) || typeof change.measureId !== "string" || !change.measureId.trim() || change.measureId.length > 160 ||
      !["new-observation", "revision", "method-change", "metadata-change"].includes(String(change.kind)) || !validDateOrNull(change.observedAt) ||
      !validTextOrNull(change.period) || !validTextOrNull(change.previousSourceEditionId) ||
      typeof change.nextSourceEditionId !== "string" || !change.nextSourceEditionId.trim() || change.nextSourceEditionId.length > 200 ||
      !validTextOrNull(change.previousRevisionId) || typeof change.nextRevisionId !== "string" || !change.nextRevisionId.trim() ||
      !(change.previous === null || typeof change.previous === "number" && Number.isFinite(change.previous)) ||
      !(change.next === null || typeof change.next === "number" && Number.isFinite(change.next)) ||
      !validOptionalInstant(change.previousSourcePublishedAt) ||
      !(change.nextSourcePublishedAt === undefined || validInstant(change.nextSourcePublishedAt)) ||
      !validOptionalSourceUrl(change.previousSourceUrl) || !validOptionalSourceUrl(change.nextSourceUrl) ||
      !validTextOrNull(change.previousUnit) && change.previousUnit !== undefined ||
      !validTextOrNull(change.nextUnit) && change.nextUnit !== undefined ||
      !validOptionalFieldList(change.changedFields) ||
      !sourceIds.has(change.nextSourceEditionId)) return false;
  }
  return true;
}

function validArchivedEdition(value: unknown, id: string): value is ArchivedEdition {
  if (!object(value) || value.availability !== "historical" || value.edition !== id || !validInstant(value.asOf) ||
    !object(value.measureCatalog) || value.measureCatalog.schemaVersion !== 2 || value.measureCatalog.editionId !== id ||
    !validInstant(value.measureCatalog.generatedAt) || value.asOf !== value.measureCatalog.generatedAt ||
    !(value.measureCatalog.validUntil === null || validInstant(value.measureCatalog.validUntil)) || !object(value.measureCatalog.measures) ||
    !validEditionSummary(value.summary, id)) return false;
  const measures: Record<string, ReturnType<typeof validateMeasureRecord>> = {};
  try {
    for (const [key, raw] of Object.entries(value.measureCatalog.measures)) {
      const measure = validateMeasureRecord(raw);
      if (key !== measure.id) return false;
      measures[key] = measure;
    }
  } catch {
    return false;
  }
  return Object.keys(measures).length === Object.keys(value.measureCatalog.measures).length;
}

export async function readEditionSummaries(): Promise<ListedEditionSummary[] | null> {
  if (!publicationEnabled("editionArchive")) return null;
  try {
    const response = await fetch(new URL("/data/editions.json", SITE_DISCOVERY.origin), { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const payload = await response.json() as unknown;
    if (!object(payload) || !Array.isArray(payload.editions) || typeof payload.retention !== "number" ||
      !Number.isInteger(payload.retention) || payload.retention !== payload.editions.length || payload.retention > 60 ||
      !payload.editions.every((edition) => validEditionSummary(edition))) return null;
    return (payload.editions as ListedEditionSummary[]).toSorted((left, right) =>
      (right.asOf ?? right.publishedAt).localeCompare(left.asOf ?? left.publishedAt) || right.id.localeCompare(left.id)
    );
  } catch { return null; }
}

export async function readArchivedEdition(id: string): Promise<ArchivedEdition | null> {
  if (!publicationEnabled("editionArchive")) return null;
  if (!safeEditionId(id)) return null;
  try {
    const url = new URL("/data/edition.json", SITE_DISCOVERY.origin);
    url.searchParams.set("edition", id);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const payload = await response.json() as unknown;
    if (!validArchivedEdition(payload, id)) return null;
    return payload;
  } catch { return null; }
}
