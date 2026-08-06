import { METRICS_SNAPSHOT_PATH, REFRESH_INTERVAL_MS } from "./config";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";
import { filterCurrentSnapshot } from "@/worker/publication-currentness";

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
    [key: string]: unknown;
  };
  [section: string]: unknown;
}

export interface LoadedMetricsSnapshot {
  payload: MetricsSnapshot;
  delivery: "snapshot";
}

let cachedSnapshot:
  | { loaded: LoadedMetricsSnapshot; cachedAt: number }
  | null = null;
let pendingSnapshot: Promise<LoadedMetricsSnapshot> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

async function loadSnapshot(): Promise<LoadedMetricsSnapshot> {
  const candidates: Array<{
    url: string;
    delivery: LoadedMetricsSnapshot["delivery"];
  }> = [];
  // The file is produced only by the static production build. The browser
  // deliberately has no cross-origin API fallback.
  if (process.env.NODE_ENV === "production" && METRICS_SNAPSHOT_PATH) {
    candidates.push({ url: METRICS_SNAPSHOT_PATH, delivery: "snapshot" });
  }
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      return await requestSnapshot(candidate.url, candidate.delivery);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join("; ") || "No metrics snapshot is configured");
}

export async function fetchMetricsSnapshot(): Promise<LoadedMetricsSnapshot> {
  if (
    cachedSnapshot &&
    Date.now() - cachedSnapshot.cachedAt < REFRESH_INTERVAL_MS
  ) {
    return cachedSnapshot.loaded;
  }
  if (!pendingSnapshot) {
    pendingSnapshot = loadSnapshot()
      .then((loaded) => {
        cachedSnapshot = { loaded, cachedAt: Date.now() };
        return loaded;
      })
      .finally(() => {
        pendingSnapshot = null;
      });
  }
  return pendingSnapshot;
}

export function resetMetricsSnapshotCache() {
  cachedSnapshot = null;
  pendingSnapshot = null;
}
