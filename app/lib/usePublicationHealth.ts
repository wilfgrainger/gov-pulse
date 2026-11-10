"use client";

import { useInitialMetricsSnapshot } from "./MetricsSnapshotProvider";
import type { MetricsSnapshot } from "./metricsSnapshot";

// Same shape as the data Worker health report, which stays for monitors.
// Readers no longer poll it: the report is derived from the edition snapshot the
// page was rendered with, so a static page never shows a time newer than its data.
export interface PublicationHealthReport {
  status: "ok" | "degraded";
  healthy: boolean;
  service: string;
  generatedAt: string;
  lastRefresh: string | null;
  counts: {
    total: number;
    ok: number;
    stale: number;
    expired: number;
    missing: number;
    error: number;
  };
  sections: Record<string, { status: string; healthy: boolean }>;
}

export interface PublicationHealthResult {
  report: PublicationHealthReport | null;
  isLive: boolean;
}

/** Derive the freshness report from the page's own edition snapshot (no network). */
export function healthReportFromSnapshot(snapshot: MetricsSnapshot | null): PublicationHealthReport | null {
  const entries = Object.entries(snapshot?.meta.sources ?? {});
  if (!snapshot || entries.length === 0) return null;
  const counts = { total: entries.length, ok: 0, stale: 0, expired: 0, missing: 0, error: 0 };
  const sections: PublicationHealthReport["sections"] = {};
  let lastRefresh: number | null = null;
  for (const [id, source] of entries) {
    if (source.status === "ok") counts.ok += 1;
    else if (source.status === "stale") counts.stale += 1;
    else counts.error += 1;
    sections[id] = { status: String(source.status ?? "missing"), healthy: source.status === "ok" };
    const fetched = typeof source.fetchedAt === "string" ? Date.parse(source.fetchedAt) : NaN;
    if (Number.isFinite(fetched) && (lastRefresh === null || fetched > lastRefresh)) lastRefresh = fetched;
  }
  const healthy = counts.ok === counts.total;
  const lastRefreshIso = lastRefresh === null ? null : new Date(lastRefresh).toISOString();
  return {
    status: healthy ? "ok" : "degraded",
    healthy,
    service: "edition-snapshot",
    generatedAt: snapshot.meta.generatedAt ?? lastRefreshIso ?? "",
    lastRefresh: lastRefreshIso,
    counts,
    sections,
  };
}

export function usePublicationHealth(): PublicationHealthResult {
  const report = healthReportFromSnapshot(useInitialMetricsSnapshot());
  return { report, isLive: report !== null };
}
