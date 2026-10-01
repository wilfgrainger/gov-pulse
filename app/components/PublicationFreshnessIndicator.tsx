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

  // Desktop keeps the full sentence inline in the nav rail. Below `lg` there
  // is no room for prose next to the logo/links, so the same status renders
  // as a compact coloured dot + time-only chip instead of disappearing
  // entirely — tapping/focusing it (a <details> needs no JS) reveals the
  // full message. The underlying text and semantics are unchanged from the
  // desktop version; this only adds a second, narrower presentation.
  const shortTime = copy.message.match(/\d{2}:\d{2}/)?.[0] ?? "";

  return (
    <>
      <p
        className={`hidden shrink-0 items-center gap-2 border-l pl-4 text-xs leading-5 lg:flex ${
          copy.degraded ? "border-amber-400 text-amber-800" : "border-[var(--accent-vivid)] text-[#0a4a6e]"
        }`}
        role="status"
      >
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${copy.degraded ? "animate-live bg-amber-500" : "bg-[var(--accent-vivid)]"}`}
        />
        {copy.message}
      </p>
      <details className="group ml-1 shrink-0 lg:hidden">
        <summary
          aria-label={copy.message}
          className={`flex min-h-8 cursor-pointer list-none items-center gap-1.5 border px-2 py-1 text-[0.68rem] font-semibold leading-none ${
            copy.degraded
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-[var(--accent-vivid)] bg-[var(--accent-soft)] text-[#0a4a6e]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full ${copy.degraded ? "animate-live bg-amber-500" : "bg-[var(--accent-vivid)]"}`}
          />
          <span aria-hidden="true">{shortTime || "Status"}</span>
        </summary>
        <p role="status" className="mt-1 max-w-[14rem] border border-[#d3dae1] bg-white p-2 text-xs leading-5 text-[#3a4450] shadow-[0_8px_20px_rgba(20,36,59,0.12)]">
          {copy.message}
        </p>
      </details>
    </>
  );
}
