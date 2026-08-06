"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DATA_SOURCES } from "@/app/lib/config";
import { fetchMetricsSnapshot } from "@/app/lib/metricsSnapshot";

export interface WorkerSourceStatus {
  status?: string;
  cacheState?: string;
}

export interface WorkerObservationStatus {
  status?: string;
  period?: string;
  observedAt?: string;
}

interface WorkerSectionSnapshot {
  __observation?: WorkerObservationStatus;
}

interface WorkerSnapshot {
  meta?: {
    sources?: Record<string, WorkerSourceStatus>;
  };
  [section: string]: unknown;
}

export type HealthState =
  | { kind: "checking"; label: string }
  | { kind: "unavailable"; label: string }
  | { kind: "healthy"; label: string }
  | { kind: "degraded"; label: string };

export function summariseFeedHealth(
  automatedSections: string[],
  sources: Record<string, WorkerSourceStatus>,
  observations: Record<string, WorkerObservationStatus> = {}
): HealthState {
  const verifiedCount = automatedSections.filter((section) => {
    const source = sources[section];
    const observation = observations[section];
    return (
      source?.status === "ok" &&
      source.cacheState === "fresh" &&
      observation?.status === "current" &&
      Boolean(observation.period) &&
      Boolean(observation.observedAt)
    );
  }).length;

  return {
    kind: verifiedCount === automatedSections.length ? "healthy" : "degraded",
    label:
      verifiedCount === automatedSections.length
        ? `All ${verifiedCount} core releases are current`
        : `${verifiedCount} of ${automatedSections.length} core releases are current`,
  };
}

function currentIssueDate() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export default function DataHealthBar() {
  const automatedSections = useMemo(
    () =>
      Object.entries(DATA_SOURCES)
        .filter(
          ([, source]) =>
            source.automation === "automated" &&
            source.publicationRequirement !== "optional"
        )
        .map(([key]) => key),
    []
  );
  const [issueDate, setIssueDate] = useState("");
  const [health, setHealth] = useState<HealthState>({
    kind: "checking",
    label: "Checking publication dates",
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIssueDate(currentIssueDate());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const parsed = (await fetchMetricsSnapshot()).payload as unknown;
        const snapshot: WorkerSnapshot = parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as WorkerSnapshot)
          : {};
        const observations = Object.fromEntries(
          automatedSections.map((section) => {
            const value = snapshot[section];
            const observation =
              value && typeof value === "object" && !Array.isArray(value)
                ? (value as WorkerSectionSnapshot).__observation ?? {}
                : {};
            return [section, observation];
          })
        );

        if (!cancelled) {
          setHealth(
            summariseFeedHealth(
              automatedSections,
              snapshot.meta?.sources ?? {},
              observations
            )
          );
        }
      } catch {
        if (!cancelled) {
          setHealth({ kind: "unavailable", label: "Publication status temporarily unavailable" });
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, [automatedSections]);

  const tone =
    health.kind === "healthy"
      ? "text-emerald-200"
      : health.kind === "degraded"
        ? "text-amber-300"
        : health.kind === "unavailable"
          ? "text-rose-200"
          : "text-gray-300";

  const dotTone =
    health.kind === "healthy"
      ? "bg-emerald-300"
      : health.kind === "degraded"
        ? "bg-amber-400"
        : health.kind === "unavailable"
          ? "bg-rose-300"
          : "bg-gray-400";

  return (
    <div
      className="border-b border-[#263852] bg-[#172234] px-4 py-1.5 text-white md:px-6 md:py-2"
      data-testid="publication-status-bar"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 sm:justify-between">
        <span className="hidden text-xs font-semibold tracking-[0.04em] sm:inline">UK public evidence</span>
        <Link
          href="/sources"
          prefetch={false}
          className={`flex min-w-0 items-center gap-2 text-xs font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${tone}`}
          aria-label={`${health.label}. Open data sources and publication audit.`}
        >
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotTone}`} aria-hidden="true" />
          <span aria-live="polite">{health.label}</span>
        </Link>
        <span className="hidden text-xs opacity-65 sm:inline">
          {issueDate || "Date loading"}
        </span>
      </div>
    </div>
  );
}
