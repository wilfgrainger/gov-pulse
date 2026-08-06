"use client";

import Link from "next/link";
import {
  DATA_SOURCES,
  EVIDENCE_CLASS_DESCRIPTIONS,
  EVIDENCE_CLASS_LABELS,
} from "@/app/lib/config";
import { DATA_SOURCE_DETAILS } from "@/app/lib/dataSourceDetails";
import type { MetricsResult } from "@/app/lib/useMetrics";

interface MetricsStatusProps {
  section: string;
  status: Pick<
    MetricsResult<unknown>,
    | "isLive"
    | "lastUpdated"
    | "source"
    | "cacheState"
    | "observationPeriod"
    | "observationStatus"
    | "observedAt"
  >;
}

const SOURCE_URLS: Record<string, string> = {
  "Bank of England": "https://www.bankofengland.co.uk/statistics",
  "Bank of England Bank Rate IUDBEDR":
    "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
  "British Polling Council disclosure rules": "https://www.britishpollingcouncil.org/objects-and-rules/",
  "Electoral Commission": "https://www.electoralcommission.org.uk/research-reports-and-data",
  HMRC: "https://www.gov.uk/government/organisations/hm-revenue-customs/about/statistics",
  "Home Office": "https://www.gov.uk/government/organisations/home-office/about/statistics",
  IMF: "https://www.imf.org/en/Data",
  Ipsos: "https://www.ipsos.com/en-uk/topic/political-monitor",
  "More in Common": "https://www.moreincommon.org.uk/our-work/research/",
  "NatCen BSA": "https://natcen.ac.uk/british-social-attitudes",
  "NHS England": "https://www.england.nhs.uk/statistics/",
  "UKHSA COVER childhood vaccination statistics":
    "https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-annual-reports/vaccination-coverage-statistics-for-children-aged-up-to-5-years-england-cover-programme-report-april-2024-to-march-2025",
  "DfE School Readiness":
    "https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/2024-25",
  OBR: "https://obr.uk/data/",
  "Oddschecker public politics markets": "https://www.oddschecker.com/politics",
  ONS: "https://www.ons.gov.uk/",
  "ONS CPI D7G7":
    "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
  "ONS Labour Force Survey": "https://www.ons.gov.uk/surveys/informationforhouseholdsandindividuals/householdandindividualsurveys/labourforcesurveylfs",
  "ONS Public Sector Finances": "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance",
  "ONS unemployment MGSX":
    "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
  "R&W": "https://redfieldandwiltonstrategies.com/",
  Savanta: "https://savanta.com/knowledge-centre/published-polls/",
  "Verified primary pollster publications": "https://yougov.com/en-gb/topics/topic/British_Politics",
  YouGov: "https://yougov.com/en-gb/topics/topic/British_Politics",
};

function formatImportDate(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return "Check time unavailable";

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
        ? "Withdrawn"
        : meta.automation === "static"
          ? "Dated publication"
          : !status.isLive
            ? "Current value unavailable"
            : automatedUnavailable
              ? "Update unavailable"
              : automatedStale
                ? "Update overdue"
                : observationVerified
                  ? "Latest verified"
                  : "Publication date not verified";

  const dataStateTone =
    meta.automation === "interactive"
      ? "border-blue-300 bg-blue-50 text-blue-900"
      : meta.automation === "withdrawn"
        ? "border-red-300 bg-red-50 text-red-900"
        : meta.automation === "static" || !status.isLive
          ? "border-neutral-300 bg-neutral-100 text-neutral-800"
          : automatedUnavailable
            ? "border-red-300 bg-red-50 text-red-900"
            : automatedStale || !observationVerified
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-green-300 bg-green-50 text-green-900";

  const importLabel =
    meta.automation === "automated"
      ? status.isLive
        ? formatImportDate(status.lastUpdated)
        : "No current verified value"
      : meta.automation === "interactive"
        ? "Calculated from your answers"
        : meta.automation === "withdrawn"
          ? "No current evidence is displayed"
          : `Dated publication · ${meta.frequency}`;

  const retrievalLabel =
    observationVerified && status.observationPeriod
      ? `Publication period ${status.observationPeriod} · ${importLabel}`
      : importLabel;

  const deliveryLabel =
    meta.automation === "interactive"
      ? "Calculated on this page"
      : meta.automation === "withdrawn"
        ? "Withdrawn"
        : meta.automation === "static"
          ? "Curated evidence"
          : status.isLive
            ? "Automatic publication check"
            : "Current check unavailable";

  const deliveryExplanation =
    meta.automation === "interactive"
      ? "This result is calculated only from the answers you provide on this page."
      : meta.automation === "withdrawn"
        ? "public-data.org deliberately displays no value because the former evidence does not meet the current evidence standard."
        : meta.automation === "static"
          ? "This is dated, curated evidence and is not automatically updated."
          : !status.isLive
            ? "The latest publication could not be verified, so no current value is shown."
            : automatedStale
              ? "The last check is older than the expected update window. Check the publisher before relying on it."
              : automatedUnavailable
                ? "The publication is unavailable or outside its acceptable update window."
                : observationVerified
                  ? "The original publication was checked and its observation period falls within the expected release window."
                  : "The publication was found, but its underlying observation period could not be verified. It is not labelled current.";

  const publicationPeriod =
    observationVerified && status.observationPeriod
      ? status.observationPeriod
      : detail.publicationPeriod;

  return (
    <aside
      className="mt-6 border-y border-[#d8d3c8] bg-[#faf8f3] px-4 py-5 md:px-5"
      aria-label={`${meta.name} evidence and sources`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent">
            Evidence &amp; sources
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`border px-2.5 py-1 text-xs font-semibold ${dataStateTone}`}>
              {dataState}
            </span>
            {detail.revisionStatus.toLowerCase().includes("revis") && (
              <span className="border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                Subject to Revision
              </span>
            )}
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

      <p className="mt-3 text-sm leading-6 text-neutral-700">{retrievalLabel}</p>

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
        <span className="font-semibold text-black">What to know: </span>
        {detail.caveat}
      </p>

      <details className="group mt-4 border-t border-neutral-200 pt-3">
        <summary className="cursor-pointer list-none py-1 text-sm font-semibold text-black underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
          How this evidence was produced
        </summary>

        <div className="mt-4 bg-[#faf8f3] p-4">
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-neutral-500">Coverage</dt><dd className="mt-1 font-semibold text-black">{meta.geographicCoverage}</dd></div>
            <div><dt className="text-neutral-500">Publication period</dt><dd className="mt-1 font-semibold text-black">{publicationPeriod}</dd></div>
            <div><dt className="text-neutral-500">Unit</dt><dd className="mt-1 font-semibold text-black">{detail.unit}</dd></div>
            <div><dt className="text-neutral-500">Revision status</dt><dd className="mt-1 font-semibold text-black">{detail.revisionStatus}</dd></div>
            <div><dt className="text-neutral-500">Publication cadence</dt><dd className="mt-1 font-semibold text-black">{meta.frequency}</dd></div>
            <div><dt className="text-neutral-500">Update method</dt><dd className="mt-1 font-semibold text-black">{deliveryLabel}</dd></div>
            {status.isLive && meta.freshnessWindow ? (
              <div><dt className="text-neutral-500">Expected update window</dt><dd className="mt-1 font-semibold text-black">{meta.freshnessWindow}</dd></div>
            ) : null}
          </dl>

          <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4 text-sm leading-6 text-neutral-700">
            <p><span className="font-semibold text-black">Evidence class: </span>{EVIDENCE_CLASS_DESCRIPTIONS[meta.evidenceClass]}</p>
            {status.isLive && meta.freshnessRationale ? (
              <p><span className="font-semibold text-black">Verification rule: </span>{meta.freshnessRationale}</p>
            ) : null}
            <p><span className="font-semibold text-black">Current status: </span>{deliveryExplanation}</p>
          </div>
        </div>
      </details>
    </aside>
  );
}
