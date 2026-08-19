"use client";

import Link from "next/link";
import { DATA_SOURCES, EVIDENCE_CLASS_LABELS } from "@/app/lib/config";
import { DATA_SOURCE_DETAILS } from "@/app/lib/dataSourceDetails";
import type { MetricsResult } from "@/app/lib/useMetrics";

interface MetricsStatusProps {
  section: string;
  status: Pick<
    MetricsResult<unknown>,
    | "isLive"
    | "lastUpdated"
    | "cacheState"
    | "observationPeriod"
    | "observationStatus"
  >;
}

const SOURCE_URLS: Record<string, string> = {
  "Verified primary pollster publications":
    "https://yougov.com/en-gb/topics/topic/British_Politics",
  "British Polling Council disclosure rules":
    "https://www.britishpollingcouncil.org/objects-and-rules/",
  "Oddschecker public politics markets": "https://www.oddschecker.com/politics",
  "ONS Public Sector Finances":
    "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance",
  "ONS GDP monthly estimate":
    "https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpmonthlyestimateuk",
  "ONS CPI D7G7":
    "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
  "Bank of England Bank Rate IUDBEDR":
    "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
  "ONS unemployment MGSX":
    "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
  "Cabinet Office Find a Tender OCDS award releases":
    "https://www.find-tender.service.gov.uk/",
  "ONS UK labour market bulletin":
    "https://www.ons.gov.uk/employmentandlabourmarket",
  "ONS Crime Survey for England and Wales":
    "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice",
  "Home Office Police Recorded Crime":
    "https://www.gov.uk/government/collections/crime-statistics",
  "Ministry of Justice Criminal Court Statistics":
    "https://www.gov.uk/government/collections/criminal-court-statistics",
  "NHS England RTT statistical press notice":
    "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
  "ONS Long-term international migration":
    "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration",
  "UKHSA COVER childhood vaccination statistics":
    "https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-annual-reports/vaccination-coverage-statistics-for-children-aged-up-to-5-years-england-cover-programme-report-april-2024-to-march-2025",
  "DfE School Readiness":
    "https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/2024-25",
};

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

export default function MetricsStatus({ section, status }: MetricsStatusProps) {
  const meta = DATA_SOURCES[section];
  const detail = DATA_SOURCE_DETAILS[section];
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
      className="mt-6 border-y border-[#d8d3c8] bg-[#faf8f3] px-4 py-5 md:px-5"
      aria-label={`${meta.name} evidence and sources`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent">{"Evidence & sources"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`border px-2.5 py-1 text-xs font-semibold ${dataStateTone}`}>
              {dataState}
            </span>
            {revisionWarning ? (
              <span className="border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                May be revised
              </span>
            ) : null}
            <span className="text-sm text-neutral-700">
              {EVIDENCE_CLASS_LABELS[meta.evidenceClass]}
            </span>
          </div>
        </div>
        <Link
          href="/sources"
          prefetch={false}
          className="text-sm font-semibold underline decoration-1 underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#172234]"
        >
          View all sources
        </Link>
      </div>

      <p className="mt-3 text-sm leading-6 text-neutral-700">{timing}</p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold text-black">Sources:</span>
        {meta.sources.map((source, index) => {
          const url = SOURCE_URLS[source];
          return (
            <span key={source}>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline decoration-1 underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#172234]"
                  aria-label={`Open ${source} source website`}
                >
                  {source}
                </a>
              ) : (
                <span className="font-semibold">{source}</span>
              )}
              {index < meta.sources.length - 1 ? ", " : ""}
            </span>
          );
        })}
      </div>

      <p className="mt-4 border-l-2 border-accent pl-4 text-sm leading-6 text-neutral-700">
        <span className="font-semibold text-black">{"What to know:"} </span>
        {detail.caveat}
      </p>
    </aside>
  );
}
