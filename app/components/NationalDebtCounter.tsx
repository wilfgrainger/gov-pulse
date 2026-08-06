"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";

const FALLBACK = {
  baseDebt: 0,
  baseDate: 0,
  debtToGdp: 0,
  observationPeriod: "",
  publicationDate: "",
  annualDelta: {
    debtBillion: 0,
    debtToGdpPoints: 0,
  },
  history: [] as Array<{
    period: string;
    observedAt: number;
    debtBillion: number;
    debtToGdp: number;
  }>,
  revisionStatus: "",
  source: {
    publisher: "",
    debtUrl: "",
    debtToGdpUrl: "",
  },
  series: {
    debt: "",
    debtToGdp: "",
  },
};

function formatDebt(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseObservationDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

function parseDateOnlyUtc(value: unknown) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return new Date(Number.NaN);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? date
    : new Date(Number.NaN);
}

function formatObservationPeriod(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatPublicationDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(parseDateOnlyUtc(value));
}

export default function NationalDebtCounter() {
  const metrics = useMetrics("nationalDebt", FALLBACK);
  const data = metrics.data;
  const debtValue = Number(data.baseDebt);
  const debtRatio = Number(data.debtToGdp);
  const observationDate = parseObservationDate(data.baseDate);
  const publicationDate = parseDateOnlyUtc(data.publicationDate);
  const valid =
    metrics.isLive &&
    metrics.cacheState === "fresh" &&
    Number.isFinite(debtValue) &&
    debtValue > 0 &&
    Number.isFinite(debtRatio) &&
    debtRatio > 0 &&
    !Number.isNaN(observationDate.getTime()) &&
    !Number.isNaN(publicationDate.getTime()) &&
    data.series?.debt === "HF6W" &&
    data.series?.debtToGdp === "HF6X" &&
    data.source?.publisher === "Office for National Statistics" &&
    data.source?.debtUrl?.startsWith("https://www.ons.gov.uk/") &&
    data.source?.debtToGdpUrl?.startsWith("https://www.ons.gov.uk/") &&
    typeof data.revisionStatus === "string" &&
    data.revisionStatus.trim().length > 0 &&
    Number.isFinite(data.annualDelta?.debtBillion) &&
    Number.isFinite(data.annualDelta?.debtToGdpPoints) &&
    Array.isArray(data.history) &&
    data.history.length >= 13;
  const period = valid ? formatObservationPeriod(observationDate) : "";

  return (
    <div className="space-y-8">
      {valid ? (
        <>
          <section aria-labelledby="national-debt-value" className="border-y border-foreground bg-black p-6 text-white">
            <p className="mb-2 text-sm text-gray-300">UK public sector net debt excluding public sector banks</p>
            <h3
              id="national-debt-value"
              className="text-3xl font-bold tracking-tight text-white md:text-5xl"
            >
              {formatDebt(debtValue)}
            </h3>
            <p className="mt-3 text-sm text-gray-300">
              ONS monthly observation for {period}. Equivalent to {debtRatio.toFixed(1)}% of GDP in the matching release.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Published {formatPublicationDate(data.publicationDate)}. This is a dated stock, not a real-time counter.
            </p>
          </section>

          <section aria-labelledby="national-debt-change-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="national-debt-change-title" className="mt-1 text-2xl font-semibold">
                Latest official stock; no movement inferred from one observation
              </h4>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-700">
              The latest verified observation is {formatDebt(debtValue)} for {period}, or {debtRatio.toFixed(1)}% of GDP. public-data.org does not project the stock between releases or claim a monthly change without a matched comparison series.
            </p>
            <dl className="mt-5 grid gap-4 border-y border-black/15 py-4 sm:grid-cols-2 sm:divide-x sm:divide-black/15">
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-gray-500">Annual change in debt stock</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {data.annualDelta.debtBillion > 0 ? "+" : "-"}£{Math.abs(data.annualDelta.debtBillion).toFixed(1)}bn
                </dd>
              </div>
              <div className="sm:pl-4">
                <dt className="text-xs uppercase tracking-[0.08em] text-gray-500">Annual change in debt-to-GDP</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {data.annualDelta.debtToGdpPoints > 0 ? "+" : ""}{data.annualDelta.debtToGdpPoints.toFixed(1)} percentage points
                </dd>
              </div>
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="Public sector net debt: ten-year direction"
            description="End-month ONS debt stock excluding public sector banks. Values are dated observations, not a live counter."
            data={data.history}
            series={[{ key: "debtBillion", label: "Debt stock", color: "#172234" }]}
            valueFormatter={(value) => `£${value.toFixed(1)}bn`}
            axisFormatter={(value) => `£${Math.round(value)}bn`}
          />

          <FinancialTimeSeriesChart
            title="Debt relative to GDP"
            description="The matching ONS debt-to-GDP series places the stock against the size of the economy on the same publication basis."
            data={data.history}
            series={[{ key: "debtToGdp", label: "Debt-to-GDP", color: "#b23a20" }]}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />

          <CoreEvidenceExplanation
            idPrefix="national-debt"
            why={
              <p>
                Debt records the accumulated stock of past borrowing after financial assets are netted off. The level and its ratio to GDP help describe the scale of public liabilities, but do not alone show whether today&apos;s fiscal policy is sustainable.
              </p>
            }
            definition={
              <p>
                Public sector net debt excluding public sector banks, ONS series HF6W. The matching GDP ratio is series{" "}
                <a
                  className="font-semibold underline underline-offset-4"
                  href={data.source.debtToGdpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  HF6X
                </a>
                .
              </p>
            }
            unit="Pounds and percentage of GDP"
            geography="United Kingdom"
            interpretation={
              <p>
                The cash figure is the debt stock at the end of the stated month. The percentage places that stock against the size of the economy on the ONS basis used in the same release.
              </p>
            }
            caveat={<p>{data.revisionStatus} Other debt measures use different coverage and are not interchangeable.</p>}
            sourceLabel="ONS HF6W public sector net debt series"
            sourceUrl={data.source.debtUrl}
            sourceDate={`Published ${formatPublicationDate(data.publicationDate)} · observation period ${period}`}
          />
        </>
      ) : (
        <section role="status" className="border border-gray-300 bg-white p-6">
          <h3 className="text-lg font-semibold">Debt observation unavailable</h3>
          <p className="mt-2 text-sm text-gray-600">
            public-data.org could not verify a current dated ONS debt observation with matching publication and source metadata, so no embedded estimate is shown.
          </p>
        </section>
      )}

      <MetricsStatus section="nationalDebt" status={metrics} />
    </div>
  );
}
