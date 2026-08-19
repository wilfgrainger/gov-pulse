"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";

const FALLBACK = {
  available: false,
  headline: {
    period: "",
    observedAt: 0,
    releaseDate: "",
    monthlyGrowth: 0,
    threeMonthGrowth: 0,
    annualGrowth: 0,
  },
  history: [] as Array<{
    period: string;
    observedAt: number;
    index: number;
    monthlyGrowth: number;
    threeMonthGrowth: number;
    annualGrowth: number;
  }>,
  methodology: {
    measure: "",
    status: "",
    revisionNote: "",
  },
  source: {
    bulletinUrl: "",
    landingUrl: "",
  },
};

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isOnsUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("https://www.ons.gov.uk/");
}

function parseDateOnlyUtc(value: unknown) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date(Number.NaN);
}

function formatReleaseDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(parseDateOnlyUtc(value));
}

function validPayload(value: typeof FALLBACK) {
  return (
    value?.available === true &&
    typeof value.headline?.period === "string" &&
    value.headline.period.trim().length > 0 &&
    isFiniteNumber(value.headline.observedAt) &&
    !Number.isNaN(parseDateOnlyUtc(value.headline.releaseDate).getTime()) &&
    isFiniteNumber(value.headline.monthlyGrowth) &&
    isFiniteNumber(value.headline.threeMonthGrowth) &&
    isFiniteNumber(value.headline.annualGrowth) &&
    Array.isArray(value.history) &&
    value.history.length >= 13 &&
    value.history.every(
      (point) =>
        isFiniteNumber(point.observedAt) &&
        isFiniteNumber(point.index) &&
        isFiniteNumber(point.monthlyGrowth) &&
        isFiniteNumber(point.threeMonthGrowth) &&
        isFiniteNumber(point.annualGrowth)
    ) &&
    typeof value.methodology?.measure === "string" &&
    typeof value.methodology?.revisionNote === "string" &&
    isOnsUrl(value.source?.bulletinUrl)
  );
}

function changeWord(value: number) {
  if (value === 0) return "was unchanged";
  return value > 0 ? "grew" : "fell";
}

function formatChange(value: number) {
  return `${Math.abs(value).toFixed(1)}%`;
}

export default function GDPTracker() {
  const metrics = useMetrics("gdpTracker", FALLBACK);
  const data = metrics.data;
  const valid = validPayload(data);

  return (
    <div className="space-y-8">
      {valid ? (
        <>
          <section aria-labelledby="gdp-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Latest ONS monthly estimate</p>
            <h3
              id="gdp-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              UK GDP {changeWord(data.headline.monthlyGrowth)} in {data.headline.period}
              {data.headline.monthlyGrowth === 0 ? "." : ` by ${formatChange(data.headline.monthlyGrowth)}.`}
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              Across the latest three months, real GDP {changeWord(data.headline.threeMonthGrowth)}
              {data.headline.threeMonthGrowth === 0
                ? "."
                : ` by ${formatChange(data.headline.threeMonthGrowth)}.`}
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {formatReleaseDate(data.headline.releaseDate)}. Monthly GDP is an early estimate and can be revised.
            </p>
          </section>

          <section aria-labelledby="gdp-numbers-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="gdp-numbers-title" className="mt-1 text-2xl font-semibold">
                Monthly movement and the broader three-month signal
              </h4>
            </div>
            <dl className="grid border-y border-black/20 md:grid-cols-3 md:divide-x md:divide-black/15">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">Latest month</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums">
                  {data.headline.monthlyGrowth > 0 ? "+" : ""}{data.headline.monthlyGrowth.toFixed(1)}%
                </dd>
                <dd className="mt-2 text-sm text-gray-600">Real GDP in {data.headline.period}.</dd>
              </div>
              <div className="border-t border-black/15 p-4 md:border-l md:border-t-0 md:p-5">
                <dt className="text-sm text-gray-600">Latest three months</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums text-accent">
                  {data.headline.threeMonthGrowth > 0 ? "+" : ""}{data.headline.threeMonthGrowth.toFixed(1)}%
                </dd>
                <dd className="mt-2 text-sm text-gray-600">A less volatile view than one monthly estimate.</dd>
              </div>
              <div className="border-t border-black/15 p-4 md:border-l md:border-t-0 md:p-5">
                <dt className="text-sm text-gray-600">Change from a year earlier</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums">
                  {data.headline.annualGrowth > 0 ? "+" : ""}{data.headline.annualGrowth.toFixed(1)}%
                </dd>
                <dd className="mt-2 text-sm text-gray-600">Real GDP compared with the same month one year earlier.</dd>
              </div>
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="UK real GDP: ten-year direction"
            description="Monthly chained-volume index from the ONS. A straight line joins exact monthly observations; it is not a forecast."
            data={data.history}
            series={[{ key: "index", label: "Real GDP index", color: "#172234" }]}
            valueFormatter={(value) => value.toFixed(1)}
          />

          <FinancialTimeSeriesChart
            title="GDP growth rates"
            description="Monthly, three-month-on-three-month and annual growth are shown on the same percentage scale. The monthly line is naturally more volatile."
            data={data.history}
            series={[
              { key: "monthlyGrowth", label: "Monthly", color: "#b23a20" },
              { key: "threeMonthGrowth", label: "Latest three months", color: "#172234" },
              { key: "annualGrowth", label: "From a year earlier", color: "#6b7280", dashed: true },
            ]}
            valueFormatter={(value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`}
            referenceValue={0}
            referenceLabel="No growth"
          />

          <CoreEvidenceExplanation
            idPrefix="gdp"
            why={
              <p>
                Monthly GDP is an early signal of economic momentum. The three-month comparison is usually the steadier guide because a single monthly estimate can be volatile and revised.
              </p>
            }
            definition={<p>{data.methodology.measure}.</p>}
            unit="Percentage change"
            geography="United Kingdom"
            interpretation={
              <p>
                The monthly figure compares output with the previous month; the three-month figure compares the latest three months with the preceding three months.
              </p>
            }
            caveat={<p>{data.methodology.revisionNote}</p>}
            sourceLabel="ONS monthly GDP bulletin"
            sourceUrl={data.source.bulletinUrl}
            sourceDate={`Published ${formatReleaseDate(data.headline.releaseDate)} · observation period ${data.headline.period}`}
          />
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Current GDP estimate unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            public-data.org could not verify one complete current ONS monthly GDP release, so it is not showing an older snapshot or forecast.
          </p>
        </section>
      )}

      <MetricsStatus section="gdpTracker" status={metrics} />
    </div>
  );
}
