import { FEED_REGISTRY_VERSION } from "@/feeds/registry.js";
import { filterCurrentSnapshot } from "@/contracts/evidence-policy";
import type { MeasureCatalog } from "./measureCatalog";
import { isRecord } from "@/contracts/records.js";

export interface SnapshotSourceStatus {
  status?: string;
  cacheState?: string;
  fetchedAt?: string;
  [key: string]: unknown;
}

export interface MetricsSnapshot {
  meta: {
    registryVersion: string;
    generatedAt?: string;
    sources: Record<string, SnapshotSourceStatus>;
    measureCatalog?: MeasureCatalog;
    editionSummary?: {
      id: string;
      publishedAt: string;
      previousEditionId?: string | null;
      summaryCorrection?: {
        kind: "baseline-reconciliation";
        baselineEditionId: string;
        note: string;
      };
      sourceEditionIds: string[];
      changes: {
        measureId: string;
        kind: "new-observation" | "revision" | "method-change" | "metadata-change";
        observedAt: string | null;
        period: string | null;
        previousSourceEditionId: string | null;
        nextSourceEditionId: string;
        previousRevisionId: string | null;
        nextRevisionId: string;
        previousSourcePublishedAt?: string | null;
        nextSourcePublishedAt?: string;
        previousSourceUrl?: string | null;
        nextSourceUrl?: string | null;
        previousUnit?: string | null;
        nextUnit?: string | null;
        previous: number | null;
        next: number | null;
        changedFields?: string[];
      }[];
    };
    [key: string]: unknown;
  };
  [section: string]: unknown;
}

export function createClientMetricsSnapshot(
  snapshot: MetricsSnapshot | null
): MetricsSnapshot | null {
  if (!snapshot) return null;
  const meta = { ...snapshot.meta };
  delete meta.measureCatalog;
  return { ...snapshot, meta };
}

export interface LoadedMetricsSnapshot {
  payload: MetricsSnapshot;
  delivery: "snapshot";
}

export function isCompatibleMetricsSnapshot(
  value: unknown
): value is MetricsSnapshot {
  if (!isRecord(value) || !isRecord(value.meta)) return false;
  return (
    value.meta.registryVersion === FEED_REGISTRY_VERSION &&
    isRecord(value.meta.sources)
  );
}

export async function requestSnapshot(
  url: string,
  delivery: LoadedMetricsSnapshot["delivery"]
): Promise<LoadedMetricsSnapshot> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // Releasing an unsuccessful response body is best effort only.
      }
      throw new Error(`${delivery} returned ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    if (!isCompatibleMetricsSnapshot(payload)) {
      throw new Error(`${delivery} did not match the current data schema`);
    }
    const currentPayload = filterCurrentSnapshot(payload, new Date());
    if (!currentPayload) {
      throw new Error(`${delivery} contained no current source-owned evidence`);
    }
    return { payload: currentPayload as MetricsSnapshot, delivery };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
