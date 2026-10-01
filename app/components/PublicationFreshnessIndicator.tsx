"use client";

import { nextScheduledCheck } from "@/app/lib/publicationSchedule";
import { usePublicationHealth, type PublicationHealthReport } from "@/app/lib/usePublicationHealth";

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value);
}

export interface FreshnessCopy {
  message: string;
  degraded: boolean;
}

/**
 * Pure formatter so the fixture-driven test can exercise every state without
 * mounting the network-dependent hook.
 */
export function describeFreshness(
  report: PublicationHealthReport | null,
  now: Date
): FreshnessCopy | null {
  if (!report || !report.lastRefresh) return null;

  const lastRefreshMs = Date.parse(report.lastRefresh);
  if (!Number.isFinite(lastRefreshMs)) return null;
  const lastRefresh = new Date(lastRefreshMs);

  if (!report.healthy) {
    return {
      degraded: true,
      message: `Data last confirmed fresh at ${formatTime(lastRefresh)} UTC — some sections may be delayed`,
    };
  }

  const next = nextScheduledCheck(now);
  const asOf = `Data as of ${formatTime(lastRefresh)} UTC`;
  return {
    degraded: false,
    message: next ? `${asOf}, next check at ${formatTime(next)} UTC` : asOf,
  };
}

export default function PublicationFreshnessIndicator() {
  const { report, isLive } = usePublicationHealth();
  if (!isLive || !report) return null;

  const copy = describeFreshness(report, new Date());
  if (!copy) return null;

  return (
    <p
      className={`hidden shrink-0 items-center border-l pl-4 text-xs leading-5 lg:flex ${
        copy.degraded ? "border-amber-300 text-amber-800" : "border-[#d3dae1] text-[#68707b]"
      }`}
      role="status"
    >
      {copy.message}
    </p>
  );
}
