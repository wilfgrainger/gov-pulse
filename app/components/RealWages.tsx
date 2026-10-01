"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import ReleaseNoteStrip from "@/app/components/ReleaseNoteStrip";
import { buildReleaseNote } from "@/app/lib/releaseNote";
import { describePercentageChange } from "@/app/lib/changeLanguage";
import { useMetrics } from "@/app/lib/useMetrics";

type RealWagesHeadline = {
  period: string;
  observedAt: number;
  releaseDate: string;
  regularPayRealGrowthPercent: number;
  totalPayRealGrowthPercent: number;
  deflator: string;
};

type RealWagesHistory = {
  period: string;
  observedAt: number;
  totalPayRealGrowthPercent: number;
  regularPayRealGrowthPercent: number;
  cpihAnnualRatePercent: number;
};

type RealWagesPayload = {
  headline: RealWagesHeadline;
  history: RealWagesHistory[];
  methodology: {
    measure: string;
    status: string;
    revisionNote: string;
  };
  source: {
    edition: string;
    bulletinUrl: string;
    historyUrl: string;
  };
};

const FALLBACK: RealWagesPayload = {
  headline: {
    period: "",
    observedAt: 0,
    releaseDate: "",
    regularPayRealGrowthPercent: 0,
    totalPayRealGrowthPercent: 0,
    deflator: "CPIH",
  },
  history: [],
  methodology: {
    measure: "",
    status: "",
    revisionNote: "",
  },
  source: {
    edition: "",
    bulletinUrl: "",
    historyUrl: "",
  },
};

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDateOnlyUtc(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(Number.NaN);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? date
    : new Date(Number.NaN);
}

function formatReleaseDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(parseDateOnlyUtc(value));
}

function validHeadline(value: unknown): value is RealWagesHeadline {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<RealWagesHeadline>;
  const releaseDate = nonEmptyString(candidate.releaseDate)
    ? parseDateOnlyUtc(candidate.releaseDate)
    : new Date(Number.NaN);

  return (
    nonEmptyString(candidate.period) &&
    typeof candidate.observedAt === "number" &&
    Number.isFinite(candidate.observedAt) &&
    typeof candidate.regularPayRealGrowthPercent === "number" &&
    Number.isFinite(candidate.regularPayRealGrowthPercent) &&
    typeof candidate.totalPayRealGrowthPercent === "number" &&
    Number.isFinite(candidate.totalPayRealGrowthPercent) &&
    nonEmptyString(candidate.deflator) &&
    !Number.isNaN(releaseDate.getTime())
  );
}

function validPayload(value: unknown): value is RealWagesPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<RealWagesPayload>;
  return (
    validHeadline(candidate.headline) &&
    Array.isArray(candidate.history) &&
    candidate.history.length >= 2 &&
    candidate.history.every(
      (point) =>
        nonEmptyString(point?.period) &&
        typeof point?.observedAt === "number" &&
        Number.isFinite(point.observedAt) &&
        typeof point?.totalPayRealGrowthPercent === "number" &&
        Number.isFinite(point.totalPayRealGrowthPercent) &&
        typeof point?.regularPayRealGrowthPercent === "number" &&
        Number.isFinite(point.regularPayRealGrowthPercent)
    ) &&
    nonEmptyString(candidate.methodology?.measure) &&
    nonEmptyString(candidate.methodology?.status) &&
    nonEmptyString(candidate.methodology?.revisionNote) &&
    nonEmptyString(candidate.source?.edition) &&
    candidate.source?.bulletinUrl?.startsWith("https://www.ons.gov.uk/") === true &&
    candidate.source?.historyUrl?.startsWith("https://www.ons.gov.uk/") === true
  );
}

export default function RealWages() {
  const metrics = useMetrics("realWages", FALLBACK);
  const payload = metrics.data as unknown;
  const valid =
    metrics.isLive && metrics.cacheState === "fresh" && validPayload(payload);
  const headline = valid ? payload.headline : null;
  const releaseNote =
    valid && headline
      ? buildReleaseNote({
          measureLabel: "Regular pay, real terms (CPIH-adjusted)",
          latestValueDisplay: formatPercent(headline.regularPayRealGrowthPercent),
          latestPeriod: headline.period,
          releaseDate: headline.releaseDate,
          history: payload.history.map((point) => ({
            observedAt: point.observedAt,
            value: point.regularPayRealGrowthPercent,
          })),
          provisional: true,
        })
      : null;

  return (
    <div className="space-y-8">
      {valid && headline ? (
        <>
          <section aria-labelledby="real-wages-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Latest ONS estimate</p>
            <h3
              id="real-wages-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              Regular pay {describePercentageChange(headline.regularPayRealGrowthPercent)} in real terms (CPIH-adjusted) in {headline.period}.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              Total pay, including bonuses, {describePercentageChange(headline.totalPayRealGrowthPercent)} in real terms (CPIH-adjusted) over the same period.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {formatReleaseDate(headline.releaseDate)}. Average weekly earnings are published on a provisional basis and remain subject to revision.
            </p>
            {releaseNote ? <ReleaseNoteStrip idPrefix="real-wages" note={releaseNote} /> : null}
          </section>

          <section aria-labelledby="real-wages-components-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Latest observation</p>
              <h4 id="real-wages-components-title" className="mt-1 text-2xl font-semibold">
                Annual earnings growth, adjusted for inflation using CPIH
              </h4>
            </div>
            <dl className="grid border-y border-black/20 md:grid-cols-2 md:divide-x md:divide-black/15">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">Regular pay, real terms (CPIH-adjusted)</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{formatPercent(headline.regularPayRealGrowthPercent)}</dd>
                <dd className="mt-2 text-xs text-gray-600">Excludes bonuses</dd>
              </div>
              <div className="border-y border-black/15 p-4 md:border-y-0 md:p-5">
                <dt className="text-sm text-gray-600">Total pay, real terms (CPIH-adjusted)</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums text-accent">{formatPercent(headline.totalPayRealGrowthPercent)}</dd>
                <dd className="mt-2 text-xs text-gray-600">Includes bonuses</dd>
              </div>
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="Real earnings growth: recent rolling three-month periods"
            description="Three-month annual growth rates, adjusted for inflation using CPIH, from the ONS average weekly earnings bulletin's published history."
            data={payload.history}
            series={[
              { key: "regularPayRealGrowthPercent", label: "Regular pay (real)", color: "#14243b" },
              { key: "totalPayRealGrowthPercent", label: "Total pay (real)", color: "#1f5c8a" },
            ]}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
            axisFormatter={(value) => `${value.toFixed(0)}%`}
            referenceValue={0}
          />

          <CoreEvidenceExplanation
            idPrefix="real-wages"
            why={
              <p>
                Real-terms earnings growth shows whether pay is keeping pace with the cost of living. A positive figure means average pay is growing faster than CPIH inflation; a negative figure means it is falling behind.
              </p>
            }
            definition={
              <p>
                This is ONS&apos;s own real-terms earnings growth figure, published directly in the average weekly earnings bulletin&apos;s prose. It is not a calculation performed by public-data.org. {payload.methodology.measure}.
              </p>
            }
            unit="Percentage, real terms (CPIH-adjusted)"
            geography="Great Britain"
            interpretation={
              <p>
                The bulletin also quotes a figure adjusted using CPI (which excludes owner occupiers&apos; housing costs) nearby in the same sentence structure. This page shows only the CPIH-adjusted figure, which is ONS&apos;s preferred measure of consumer price inflation.
              </p>
            }
            caveat={<p>{payload.methodology.revisionNote}</p>}
            sourceLabel="ONS average weekly earnings bulletin"
            sourceUrl={payload.source.bulletinUrl}
            sourceDate={`Published ${formatReleaseDate(headline.releaseDate)} · observation period ${headline.period}`}
          />
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Real wages estimate unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            public-data.org could not verify one complete, reconciled current ONS average weekly earnings release, so no embedded or older headline estimate is shown.
          </p>
        </section>
      )}

      <MetricsStatus section="realWages" status={metrics} />
    </div>
  );
}
