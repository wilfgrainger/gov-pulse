"use client";

import { useEffect, useRef, useState } from "react";
import {
  filterCurrentSnapshot,
  sectionValidityDeadline,
} from "@/worker/publication-currentness";
import { DATA_SOURCES, REFRESH_INTERVAL_MS } from "./config";
import { useInitialMetricsSnapshot } from "./MetricsSnapshotProvider";
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
  validUntil: number | null;
}

interface RawObservation {
  status?: unknown;
  period?: unknown;
  observedAt?: unknown;
}


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
    validUntil: null,
  };
}

function sourcedResult<T>({
  data,
  source,
  timestamp,
  cacheState,
  freshnessWindowMs,
  now,
  validUntil,
}: {
  data: T;
  source: "snapshot" | "worker";
  timestamp: string | undefined;
  cacheState: MetricsCacheState;
  freshnessWindowMs: number | undefined;
  now: number;
  validUntil: number | null;
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
    validUntil,
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
  // The request-time worker has already filtered the snapshot against its
  // clock. Reuse that edition clock for the first render on both server and
  // client, then let the exact-deadline timer and live reader use browser now.
  const resolvedNow = now ?? (Number.isFinite(generatedAt) ? generatedAt : Date.now());
  const validUntil = sectionValidityDeadline(section, raw, sourceStatus, new Date(resolvedNow));
  if (validUntil === null || validUntil <= resolvedNow) return null;

  return sourcedResult({
    data: raw,
    source: "snapshot",
    timestamp,
    cacheState: (sourceStatus.cacheState as MetricsCacheState) ?? null,
    freshnessWindowMs,
    now: resolvedNow,
    validUntil,
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
  const initialSnapshot = useInitialMetricsSnapshot();
  const latestSnapshotRef = useRef<unknown>(initialSnapshot);
  const sourceMeta = DATA_SOURCES[section];
  const shouldFetchLive = sourceMeta?.automation === "automated";
  const [initialSnapshotResult] = useState<MetricsResult<T> | null>(() =>
    metricsResultFromSnapshot(
      initialSnapshot,
      section,
      fallback,
      sourceMeta?.freshnessWindowMs
    )
  );

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  const [result, setResult] = useState<MetricsResult<T>>(
    () => initialSnapshotResult ?? fallbackResult(fallback)
  );

  useEffect(() => {
    if (result.validUntil === null) return;
    const remaining = result.validUntil - Date.now();
    const delay = Math.min(Math.max(remaining, 1), 2_147_000_000);
    const timer = setTimeout(() => {
      const next = currentMetricsResultFromSnapshot(
        latestSnapshotRef.current,
        section,
        fallbackRef.current,
        sourceMeta?.freshnessWindowMs,
        Date.now(),
      );
      setResult(next ?? fallbackResult(fallbackRef.current));
    }, delay);
    return () => clearTimeout(timer);
  }, [result.validUntil, section, sourceMeta?.freshnessWindowMs]);

  useEffect(() => {
    if (!shouldFetchLive) return;

    let active = true;
    const readerInitialResult = currentMetricsResultFromSnapshot(
      initialSnapshot,
      section,
      fallbackRef.current,
      sourceMeta?.freshnessWindowMs
    );
    queueMicrotask(() => {
      if (active) setResult(readerInitialResult ?? fallbackResult(fallbackRef.current));
    });

    const fetchData = async () => {
      try {
        const loaded = await fetchMetricsSnapshot();
        latestSnapshotRef.current = loaded.payload;
        const currentResult = currentMetricsResultFromSnapshot(
          loaded.payload,
          section,
          fallbackRef.current,
          sourceMeta?.freshnessWindowMs,
          Date.now(),
        );
        if (currentResult) {
          setResult({ ...currentResult, source: loaded.delivery });
          return;
        }
      } catch {
        // Retain the request-time server snapshot below when refresh fails.
      }

      if (active) {
        setResult(currentMetricsResultFromSnapshot(latestSnapshotRef.current, section, fallbackRef.current, sourceMeta?.freshnessWindowMs) ?? fallbackResult(fallbackRef.current));
      }
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [initialSnapshot, section, shouldFetchLive, sourceMeta?.freshnessWindowMs]);

  return result;
}
