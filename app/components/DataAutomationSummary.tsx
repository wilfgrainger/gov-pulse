"use client";

import { useEffect, useState } from "react";
import {
  DATA_SOURCES,
  EVIDENCE_CLASS_LABELS,
} from "@/app/lib/config";
import type { DataAutomation } from "@/app/lib/config";
import { fetchMetricsSnapshot } from "@/app/lib/metricsSnapshot";

interface SourceStatus {
  status?: string;
  fetchedAt?: string;
  cacheState?: string;
}

interface PublicationRecord {
  meta?: {
    generatedAt?: string;
    sources?: Record<string, SourceStatus>;
  };
}

function formatTimestamp(value?: string) {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";

  return `${new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(parsed)} UTC`;
}

function getUpdateMethodLabel(automation: DataAutomation) {
  switch (automation) {
    case "automated":
      return "Automatic";
    case "interactive":
      return "Interactive";
    case "withdrawn":
      return "Withdrawn";
    default:
      return "Curated";
  }
}

function getUpdateMethodTone(automation: DataAutomation) {
  if (automation === "automated") {
    return "border-[#172234] bg-[#172234] text-white";
  }
  if (automation === "interactive") {
    return "border-blue-300 bg-blue-50 text-blue-900";
  }
  if (automation === "withdrawn") {
    return "border-rose-300 bg-rose-50 text-rose-900";
  }
  return "border-[#cbc4b8] bg-[#f7f3eb] text-[#172234]";
}

function getSectionStatus(
  automation: DataAutomation,
  sourceStatus?: SourceStatus
) {
  if (automation === "interactive") {
    return { label: "Available here", tone: "bg-blue-50 text-blue-900" };
  }
  if (automation === "withdrawn") {
    return { label: "Not shown", tone: "bg-rose-50 text-rose-900" };
  }
  if (automation === "static") {
    return { label: "Dated material", tone: "bg-[#eee9df] text-[#4f5560]" };
  }
  if (!sourceStatus) {
    return { label: "Being checked", tone: "bg-amber-50 text-amber-900" };
  }
  if (sourceStatus.status !== "ok") {
    return { label: "Temporarily unavailable", tone: "bg-rose-50 text-rose-900" };
  }
  if (sourceStatus.cacheState === "expired") {
    return { label: "Update overdue", tone: "bg-rose-50 text-rose-900" };
  }
  if (sourceStatus.cacheState === "missing") {
    return { label: "No current value", tone: "bg-rose-50 text-rose-900" };
  }
  if (sourceStatus.cacheState === "stale") {
    return { label: "Update due", tone: "bg-amber-50 text-amber-900" };
  }
  if (sourceStatus.cacheState !== "fresh") {
    return { label: "Date not verified", tone: "bg-amber-50 text-amber-900" };
  }
  return { label: "Current", tone: "bg-emerald-50 text-emerald-900" };
}

export default function DataAutomationSummary() {
  const [publicationRecord, setPublicationRecord] =
    useState<PublicationRecord | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicationRecord() {
      try {
        const payload = (await fetchMetricsSnapshot()).payload as PublicationRecord;
        if (!cancelled) {
          setPublicationRecord(payload);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    }

    loadPublicationRecord();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = Object.entries(DATA_SOURCES)
    .filter(([, source]) => source.automation !== "withdrawn")
    .sort(([, left], [, right]) => left.name.localeCompare(right.name));
  const generatedAt = publicationRecord?.meta?.generatedAt;
  const sourceStatuses = publicationRecord?.meta?.sources ?? {};

  return (
    <section aria-labelledby="current-publication-status">
      <div className="mb-7 grid gap-4 border-b border-[#d8d3c8] pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-accent">Publication status</p>
          <h2
            id="current-publication-status"
            className="font-display text-3xl leading-tight md:text-5xl"
          >
            What is current now
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
            A core release is “current” only when its official source was fetched
            successfully, its observation period and publication date were
            validated, and it remains inside the section&apos;s freshness window.
            This is a publication check, not an endorsement of the result.
          </p>
        </div>
        <div className="border-l-2 border-[#172234] pl-4 text-sm leading-6 text-gray-600">
          <p className="font-semibold text-[#172234]">Register checked</p>
          <p>
            {generatedAt
              ? formatTimestamp(generatedAt)
              : loadFailed
                ? "Temporarily unavailable"
                : "Checking"}
          </p>
        </div>
      </div>

      <div className="grid gap-px border border-[#d8d3c8] bg-[#d8d3c8] md:grid-cols-2">
        {entries.map(([section, meta]) => {
          const sourceStatus = sourceStatuses[section];
          const sectionStatus = getSectionStatus(meta.automation, sourceStatus);
          const lastChecked =
            meta.automation === "automated"
              ? formatTimestamp(sourceStatus?.fetchedAt)
              : meta.automation === "static"
                ? "Dated material"
                : "Not applicable";

          return (
            <article key={section} className="bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl leading-tight">{meta.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="border border-[#cbc4b8] bg-white px-2 py-1 text-xs font-semibold text-[#172234]">
                      {EVIDENCE_CLASS_LABELS[meta.evidenceClass]}
                    </span>
                    <span className="border border-[#d8d3c8] bg-[#f7f3eb] px-2 py-1 text-xs text-gray-600">
                      {meta.geographicCoverage}
                    </span>
                  </div>
                </div>
                <span className={`inline-block px-2.5 py-1 text-xs font-semibold ${sectionStatus.tone}`}>
                  {sectionStatus.label}
                </span>
              </div>

              <dl className="mt-5 grid gap-x-5 gap-y-4 border-t border-[#e4dfd6] pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Update method
                  </dt>
                  <dd className="mt-1">
                    <span className={`inline-block border px-2.5 py-1 text-xs font-semibold ${getUpdateMethodTone(meta.automation)}`}>
                      {getUpdateMethodLabel(meta.automation)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Expected schedule
                  </dt>
                  <dd className="mt-1 font-semibold">{meta.frequency}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Last checked
                  </dt>
                  <dd className="mt-1">{lastChecked}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Publisher
                  </dt>
                  <dd className="mt-1 leading-6 text-gray-700">{meta.sources.join(" · ")}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
