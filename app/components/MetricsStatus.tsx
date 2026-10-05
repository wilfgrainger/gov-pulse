"use client";

import Link from "next/link";
import { DATA_SOURCES } from "@/app/lib/config";
import { DATA_SOURCE_DETAILS } from "@/app/lib/dataSourceDetails";
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

export default function MetricsStatus({ section, status, showCurrentness = true }: MetricsStatusProps) {
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
      className={`${showCurrentness ? "mt-6" : "mt-3"} border-y border-line-strong px-1 py-3 md:px-2`}
      aria-label={`${meta.name} ${showCurrentness ? "evidence status" : "evidence file"}`}
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

      <details className={`${showCurrentness ? "mt-1" : ""} max-w-5xl evidence-file-disclosure`}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold underline decoration-1 underline-offset-4 hover:text-accent">
          <span>Evidence file</span><span aria-hidden="true">＋</span>
        </summary>
        <div className="evidence-file">
          <div>
            <h2 className="font-semibold text-foreground">Primary publications</h2>
            <ul className="mt-1 list-none space-y-1 p-0">
              {meta.sources.map((source) => {
                const url = SOURCE_URLS[source];
                return (
                  <li key={source}>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline decoration-1 underline-offset-4 hover:text-accent"
                        aria-label={`Open ${source} source website`}
                      >
                        {source}
                      </a>
                    ) : <span className="font-semibold">{source}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">How to read it</h2>
            <p className="mt-1">{detail.caveat}</p>
          </div>
          <dl className="evidence-file__metadata">
            <div><dt>Publication window</dt><dd>{detail.publicationPeriod}</dd></div>
            <div><dt>Unit</dt><dd>{detail.unit}</dd></div>
            <div><dt>Revision policy</dt><dd>{detail.revisionStatus}</dd></div>
          </dl>
        </div>
      </details>
    </aside>
  );
}
