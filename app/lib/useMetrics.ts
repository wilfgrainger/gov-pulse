"use client";

import { useEffect, useRef, useState } from "react";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import { filterCurrentSnapshot } from "@/worker/publication-currentness";
import { DATA_SOURCES, REFRESH_INTERVAL_MS } from "./config";
import {
  fetchMetricsSnapshot,
  isCompatibleMetricsSnapshot,
  type MetricsSnapshot,
} from "./metricsSnapshot";

export type MetricsCacheState = "fresh" | "stale" | "expired" | "missing" | null;
export type MetricsObservationStatus = "current" | "stale" | "unverified" | null;

export interface MetricsResult<T> {
  data: T;
  isLive: boolean;
  lastUpdated: Date | null;
  source: "snapshot" | "worker" | "fallback";
  cacheState: MetricsCacheState;
  observationPeriod: string | null;
  observationStatus: MetricsObservationStatus;
  observedAt: Date | null;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
  source: "snapshot" | "worker";
  lastUpdated: string | null;
  cacheState: MetricsCacheState;
  observationPeriod: string | null;
  observationStatus: MetricsObservationStatus;
  observedAt: string | null;
}

interface RawObservation {
  status?: unknown;
  period?: unknown;
  observedAt?: unknown;
}

const cache = new Map<string, CacheEntry>();

function compatibleShape(expected: unknown, candidate: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(candidate)) return false;
    if (expected.length === 0) return true;
    return candidate.every((item) => compatibleShape(expected[0], item));
  }

  if (expected === null || candidate === null) return expected === candidate;
  if (typeof expected !== "object") return typeof candidate === typeof expected;
  if (typeof candidate !== "object" || Array.isArray(candidate)) return false;

  const expectedRecord = expected as Record<string, unknown>;
  const candidateRecord = candidate as Record<string, unknown>;
  return Object.entries(expectedRecord).every(([key, expectedValue]) =>
    key in candidateRecord && compatibleShape(expectedValue, candidateRecord[key])
  );
}

export function acceptsCompleteLivePayload<T>(fallback: T, liveData: unknown): liveData is T {
  return compatibleShape(fallback, liveData);
}

function readObservation(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      observationPeriod: null,
      observationStatus: null as MetricsObservationStatus,
      observedAt: null,
    };
  }

  const observation = (raw as { __observation?: RawObservation }).__observation;
  const status: MetricsObservationStatus =
    observation?.status === "current"
      ? "current"
      : observation?.status === "stale"
        ? "stale"
        : observation
          ? "unverified"
          : null;
  const observedAt =
    typeof observation?.observedAt === "string" && Number.isFinite(Date.parse(observation.observedAt))
      ? observation.observedAt
      : null;

  return {
    observationPeriod:
      typeof observation?.period === "string" && observation.period.trim()
        ? observation.period.trim()
        : null,
    observationStatus: status,
    observedAt,
  };
}

export function normalizeCacheState(
  timestamp: string | undefined,
  upstreamState: MetricsCacheState,
  freshnessWindowMs: number | undefined,
  now = Date.now()
): MetricsCacheState {
  if (
    upstreamState === "missing" ||
    !freshnessWindowMs ||
    freshnessWindowMs <= 0 ||
    !timestamp
  ) {
    return upstreamState;
  }

  const fetchedAt = Date.parse(timestamp);
  if (!Number.isFinite(fetchedAt)) return upstreamState;

  const ageMs = Math.max(0, now - fetchedAt);
  if (ageMs <= freshnessWindowMs) return "fresh";
  if (ageMs <= freshnessWindowMs * 2) return "stale";
  return "expired";
}

function fallbackResult<T>(fallback: T): MetricsResult<T> {
  return {
    data: fallback,
    isLive: false,
    lastUpdated: null,
    source: "fallback",
    cacheState: null,
    observationPeriod: null,
    observationStatus: null,
    observedAt: null,
  };
}

function sourcedResult<T>({
  data,
  source,
  timestamp,
  cacheState,
  freshnessWindowMs,
  now,
}: {
  data: T;
  source: "snapshot" | "worker";
  timestamp: string | undefined;
  cacheState: MetricsCacheState;
  freshnessWindowMs: number | undefined;
  now: number;
}): MetricsResult<T> {
  const normalizedCacheState = normalizeCacheState(
    timestamp,
    cacheState,
    freshnessWindowMs,
    now
  );
  const observation = readObservation(data);
  const parsedTimestamp = timestamp ? Date.parse(timestamp) : Number.NaN;

  return {
    data,
    isLive: true,
    lastUpdated: Number.isFinite(parsedTimestamp) ? new Date(parsedTimestamp) : null,
    source,
    cacheState: normalizedCacheState,
    observationPeriod: observation.observationPeriod,
    observationStatus: observation.observationStatus,
    observedAt: observation.observedAt ? new Date(observation.observedAt) : null,
  };
}

export function metricsResultFromSnapshot<T>(
  snapshot: unknown,
  section: string,
  fallback: T,
  freshnessWindowMs: number | undefined,
  now?: number
): MetricsResult<T> | null {
  if (!isCompatibleMetricsSnapshot(snapshot)) return null;

  const typedSnapshot = snapshot as MetricsSnapshot;
  const sourceStatus = typedSnapshot.meta.sources[section];
  const raw = typedSnapshot[section];
  if (
    !sourceStatus ||
    (sourceStatus.status !== "ok" && sourceStatus.status !== "stale") ||
    raw === null ||
    raw === undefined ||
    !acceptsCompleteLivePayload(fallback, raw)
  ) {
    return null;
  }

  const timestamp =
    typeof sourceStatus.fetchedAt === "string"
      ? sourceStatus.fetchedAt
      : typeof typedSnapshot.meta.generatedAt === "string"
        ? typedSnapshot.meta.generatedAt
        : undefined;
  const generatedAt = Date.parse(
    typeof typedSnapshot.meta.generatedAt === "string"
      ? typedSnapshot.meta.generatedAt
      : ""
  );

  return sourcedResult({
    data: raw,
    source: "snapshot",
    timestamp,
    cacheState: (sourceStatus.cacheState as MetricsCacheState) ?? null,
    freshnessWindowMs,
    now: now ?? (Number.isFinite(generatedAt) ? generatedAt : Date.now()),
  });
}

export function currentMetricsResultFromSnapshot<T>(
  snapshot: unknown,
  section: string,
  fallback: T,
  freshnessWindowMs: number | undefined,
  now = Date.now()
): MetricsResult<T> | null {
  const currentSnapshot = filterCurrentSnapshot(snapshot, new Date(now));
  if (!currentSnapshot) return null;
  return metricsResultFromSnapshot(
    currentSnapshot,
    section,
    fallback,
    freshnessWindowMs,
    now
  );
}

export function useMetrics<T>(section: string, fallback: T): MetricsResult<T> {
  const fallbackRef = useRef(fallback);
  const sourceMeta = DATA_SOURCES[section];
  const shouldFetchLive =
    sourceMeta?.automation === "automated" && process.env.NODE_ENV === "production";
  const [buildSnapshotResult] = useState<MetricsResult<T> | null>(() =>
    metricsResultFromSnapshot(
      BUILD_METRICS_SNAPSHOT,
      section,
      fallback,
      sourceMeta?.freshnessWindowMs
    )
  );
  const buildSnapshotResultRef = useRef(buildSnapshotResult);

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  const [result, setResult] = useState<MetricsResult<T>>(
    () => buildSnapshotResult ?? fallbackResult(fallback)
  );

  useEffect(() => {
    if (!shouldFetchLive) return;

    let active = true;
    const readerBuildResult = currentMetricsResultFromSnapshot(
      BUILD_METRICS_SNAPSHOT,
      section,
      fallbackRef.current,
      sourceMeta?.freshnessWindowMs
    );
    buildSnapshotResultRef.current = readerBuildResult;
    queueMicrotask(() => {
      if (active) setResult(readerBuildResult ?? fallbackResult(fallbackRef.current));
    });

    const applyData = (
      raw: unknown,
      source: "snapshot" | "worker",
      timestamp: string | undefined,
      cacheState: MetricsCacheState
    ) => {
      if (!acceptsCompleteLivePayload(fallbackRef.current, raw)) return false;

      const nextResult = sourcedResult({
        data: raw,
        source,
        timestamp,
        cacheState,
        freshnessWindowMs: sourceMeta?.freshnessWindowMs,
        now: Date.now(),
      });
      cache.set(section, {
        data: raw,
        timestamp: Date.now(),
        source,
        lastUpdated: timestamp ?? null,
        cacheState: nextResult.cacheState,
        observationPeriod: nextResult.observationPeriod,
        observationStatus: nextResult.observationStatus,
        observedAt: nextResult.observedAt?.toISOString() ?? null,
      });
      if (active) setResult(nextResult);
      return true;
    };

    const fetchData = async () => {
      const cached = cache.get(section);
      if (cached && Date.now() - cached.timestamp < REFRESH_INTERVAL_MS) {
        if (active) {
          setResult({
            data: cached.data as T,
            isLive: true,
            lastUpdated: cached.lastUpdated
              ? new Date(cached.lastUpdated)
              : new Date(cached.timestamp),
            source: cached.source,
            cacheState: cached.cacheState,
            observationPeriod: cached.observationPeriod,
            observationStatus: cached.observationStatus,
            observedAt: cached.observedAt ? new Date(cached.observedAt) : null,
          });
        }
        return;
      }

      try {
        const loaded = await fetchMetricsSnapshot();
        const sourceStatus = loaded.payload.meta.sources[section];
        const data = loaded.payload[section];
        if (
          (sourceStatus?.status === "ok" || sourceStatus?.status === "stale") &&
          data !== null &&
          data !== undefined &&
          applyData(
            data,
            loaded.delivery,
            sourceStatus.fetchedAt ?? loaded.payload.meta.generatedAt,
            (sourceStatus.cacheState as MetricsCacheState) ?? null
          )
        ) {
          return;
        }
      } catch {
        // Retain the reader-current build snapshot below when refresh fails.
      }

      if (active) {
        setResult(buildSnapshotResultRef.current ?? fallbackResult(fallbackRef.current));
      }
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [section, shouldFetchLive, sourceMeta?.freshnessWindowMs]);

  return result;
}
