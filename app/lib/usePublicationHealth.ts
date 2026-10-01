"use client";

import { useEffect, useRef, useState } from "react";

// Mirrors worker/health-report.js buildHealthReport() — the Cloudflare data
// Worker's own health endpoint, already used by the deploy bootstrap check
// (scripts/bootstrap-cloudflare-publication.mjs, PR #106). The frontend reuses
// this as the single source of truth for "data as of" rather than inventing a
// second freshness signal.
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

const HEALTH_PATH = "/data/health.json";
// Same cadence the frontend already polls metrics on (app/lib/config.ts
// REFRESH_INTERVAL_MS) — no new polling policy introduced for this indicator.
const POLL_INTERVAL_MS = 60 * 60 * 1000;

function isPublicationHealthReport(value: unknown): value is PublicationHealthReport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.status === "ok" || candidate.status === "degraded") &&
    typeof candidate.healthy === "boolean" &&
    typeof candidate.generatedAt === "string" &&
    (candidate.lastRefresh === null || typeof candidate.lastRefresh === "string") &&
    typeof candidate.counts === "object" &&
    candidate.counts !== null
  );
}

/**
 * Reads the Cloudflare data Worker's `/data/health.json` endpoint — the same
 * endpoint the deploy pipeline's bootstrap/finalise check uses — so the UI's
 * "data as of" indicator can never drift from the real publication state.
 * Only runs in the browser in production; falls back to no report (indicator
 * renders nothing) rather than guessing a value.
 */
export function usePublicationHealth(): PublicationHealthResult {
  const [result, setResult] = useState<PublicationHealthResult>({
    report: null,
    isLive: false,
  });
  const activeRef = useRef(true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    activeRef.current = true;

    const fetchHealth = async () => {
      try {
        const response = await fetch(HEALTH_PATH, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as unknown;
        if (!isPublicationHealthReport(payload)) return;
        if (activeRef.current) setResult({ report: payload, isLive: true });
      } catch {
        // Keep the previous report (or none) rather than showing a guess.
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, POLL_INTERVAL_MS);
    return () => {
      activeRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return result;
}
