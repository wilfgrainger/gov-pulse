"use client";

import Link from "next/link";
import { DATA_SOURCES } from "@/app/lib/config";
import { DATA_SOURCE_DETAILS } from "@/app/lib/dataSourceDetails";
import { sourceLinksForFeed } from "@/contracts/source-catalog.js";
import type { MetricsResult } from "@/app/lib/useMetrics";
import EvidenceClassBadge from "./EvidenceClassBadge";

interface MetricsStatusProps {
  section: string;
  showCurrentness?: boolean;
  status: Pick<
    MetricsResult<unknown>,
    | "isLive"
    | "lastUpdated"
    | "cacheState"
    | "observationPeriod"
    | "observationStatus"
  >;
}

function formatCheckDate(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return null;

  const formatted = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value);

  return `Checked ${formatted} UTC`;
}

export default function MetricsStatus({ section, status, showCurrentness = true }: MetricsStatusProps) {
  const meta = DATA_SOURCES[section];
  const detail = DATA_SOURCE_DETAILS[section];
  const sourceLinks = sourceLinksForFeed(section);
  if (!meta || !detail) return null;

  const automatedUnavailable =
    meta.automation === "automated" &&
    (status.cacheState === "expired" || status.cacheState === "missing");
  const automatedStale = meta.automation === "automated" && status.cacheState === "stale";
  const observationVerified =
    meta.automation === "automated" &&
    status.isLive &&
    status.cacheState === "fresh" &&
    status.observationStatus === "current" &&
    Boolean(status.observationPeriod);

  const dataState =
    meta.automation === "interactive"
      ? "Calculated here"
      : meta.automation === "withdrawn"
        ? "Unavailable"
        : meta.automation === "static"
          ? "Dated publication"
          : !status.isLive
            ? "Current value unavailable"
            : automatedUnavailable
              ? "Update unavailable"
              : automatedStale
                ? "Update due"
                : observationVerified
                  ? "Latest available"
                  : "Date unverified";

  const dataStateTone =
    meta.automation === "interactive"
      ? "border-blue-300 bg-blue-50 text-blue-900"
      : meta.automation === "withdrawn" || automatedUnavailable
        ? "border-red-300 bg-red-50 text-red-900"
        : meta.automation === "static" || !status.isLive
          ? "border-neutral-300 bg-neutral-100 text-neutral-800"
          : automatedStale || !observationVerified
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-green-300 bg-green-50 text-green-900";

  const checkDate = formatCheckDate(status.lastUpdated);
  const timing =
    meta.automation === "interactive"
      ? "Calculated from your answers"
      : meta.automation === "withdrawn"
        ? "No current evidence is displayed"
        : meta.automation === "static"
          ? detail.publicationPeriod
          : status.isLive
            ? [status.observationPeriod ? `Period ${status.observationPeriod}` : null, checkDate]
                .filter(Boolean)
                .join(" · ") || "Publication date unavailable"
            : "No current verified value";

  const revisionWarning =
    detail.revisionStatus.toLowerCase().includes("revis") ||
    detail.revisionStatus.toLowerCase().includes("provisional");

  return (
    <aside
      className={`${showCurrentness ? "mt-6" : "mt-3"} border-y border-line-strong px-1 py-3 md:px-2`}
      aria-label={`${meta.name} ${showCurrentness ? "evidence status" : "sources and methods"}`}
    >
      {showCurrentness ? (
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`border px-2.5 py-1 text-xs font-semibold ${dataStateTone}`}>
              {dataState}
            </span>
            {revisionWarning && status.isLive ? (
              <span className="border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                May be revised
              </span>
            ) : null}
            <EvidenceClassBadge evidenceClass={meta.evidenceClass} />
            <span className="text-sm leading-6 text-neutral-700">{timing}</span>
          </div>
          <Link
            href="/sources/"
            prefetch={false}
            className="min-h-11 inline-flex items-center text-sm font-semibold underline decoration-1 underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14243b]"
          >
            All sources
          </Link>
        </div>
      ) : null}

      <details className={`${showCurrentness ? "mt-1" : ""} max-w-4xl`}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline decoration-1 underline-offset-4 hover:text-accent">
          Sources and methods
        </summary>
        <div className="grid gap-3 border-l-2 border-accent py-2 pl-4 text-sm leading-6 text-neutral-700 sm:ml-1 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] sm:gap-6">
          <div>
            <h2 className="font-semibold text-foreground">Primary publications</h2>
            <ul className="mt-1 list-none space-y-1 p-0">
              {sourceLinks.length > 0 ? sourceLinks.map((source) => (
                <li key={`${source.sourceId}:${source.url}`}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline decoration-1 underline-offset-4 hover:text-accent"
                    aria-label={`Open ${source.label} source website`}
                  >
                    {source.label}
                  </a>
                </li>
              )) : meta.sources.map((source) => (
                <li key={source}><span className="font-semibold">{source}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">How to read it</h2>
            <p className="mt-1">{detail.caveat}</p>
          </div>
        </div>
      </details>
    </aside>
  );
}
