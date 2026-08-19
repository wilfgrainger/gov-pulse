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
    receiptsBillion: 0,
    yearChangeBillion: 0,
  },
  history: [] as Array<{
    period: string;
    observedAt: number;
    receiptsBillion: number;
  }>,
  methodology: {
    measure: "",
    status: "",
    caveat: "",
  },
  source: {
    bulletinUrl: "",
    landingUrl: "",
  },
};

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
    typeof value.headline.observedAt === "number" &&
    Number.isFinite(value.headline.observedAt) &&
    !Number.isNaN(parseDateOnlyUtc(value.headline.releaseDate).getTime()) &&
    typeof value.headline.receiptsBillion === "number" &&
    Number.isFinite(value.headline.receiptsBillion) &&
    value.headline.receiptsBillion >= 0 &&
    typeof value.headline.yearChangeBillion === "number" &&
    Number.isFinite(value.headline.yearChangeBillion) &&
    Array.isArray(value.history) &&
    value.history.length >= 13 &&
    value.history.every(
      (point) =>
        typeof point.observedAt === "number" &&
        Number.isFinite(point.observedAt) &&
        typeof point.receiptsBillion === "number" &&
        Number.isFinite(point.receiptsBillion)
    ) &&
    typeof value.methodology?.measure === "string" &&
    typeof value.methodology?.caveat === "string" &&
    typeof value.source?.bulletinUrl === "string" &&
    value.source.bulletinUrl.startsWith("https://www.ons.gov.uk/")
  );
}

export default function TaxRevenue() {
  const metrics = useMetrics("taxRevenue", FALLBACK);
  const data = metrics.data;
  const valid = validPayload(data);

  return (
    <div className="space-y-8">
      {valid ? (
        <>
          <section aria-labelledby="receipts-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Latest ONS public-finance release</p>
            <h3
              id="receipts-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              Central government receipts were £{data.headline.receiptsBillion.toFixed(1)}bn in {data.headline.period}.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              That was £{Math.abs(data.headline.yearChangeBillion).toFixed(1)}bn {data.headline.yearChangeBillion >= 0 ? "more" : "less"} than in the comparable month a year earlier.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {formatReleaseDate(data.headline.releaseDate)}. Public-finance estimates can be revised as more complete data arrive.
            </p>
          </section>

          <section aria-labelledby="receipts-numbers-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="receipts-numbers-title" className="mt-1 text-2xl font-semibold">
                One monthly receipts measure, compared like for like
              </h4>
            </div>
            <dl className="grid border-y border-black/20 md:grid-cols-2 md:divide-x md:divide-black/15">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">Central government receipts</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums">£{data.headline.receiptsBillion.toFixed(1)}bn</dd>
                <dd className="mt-2 text-sm text-gray-600">{data.headline.period}</dd>
              </div>
              <div className="border-t border-black/15 p-4 md:border-l md:border-t-0 md:p-5">
                <dt className="text-sm text-gray-600">Change from a year earlier</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums text-accent">
                  {data.headline.yearChangeBillion >= 0 ? "+" : "-"}£{Math.abs(data.headline.yearChangeBillion).toFixed(1)}bn
                </dd>
                <dd className="mt-2 text-sm text-gray-600">Same monthly measure and accounting basis.</dd>
              </div>
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="Central government receipts: ten-year direction"
            description="Monthly ONS current receipts on a consistent cash basis. The seasonal pattern is why the annual comparison uses the same month one year earlier."
            data={data.history}
            series={[{ key: "receiptsBillion", label: "Monthly receipts", color: "#172234" }]}
            valueFormatter={(value) => `£${value.toFixed(1)}bn`}
            axisFormatter={(value) => `£${Math.round(value)}bn`}
          />

          <CoreEvidenceExplanation
            idPrefix="receipts"
            why={
              <p>
                Receipts help determine how much government must borrow to fund spending. A monthly receipts figure is not the same thing as the annual tax burden or an estimate of what an average person pays.
              </p>
            }
            definition={<p>{data.methodology.measure}.</p>}
            unit="£ billions"
            geography="United Kingdom"
            interpretation={
              <p>
                The annual comparison uses the same monthly measure and accounting basis, so it shows whether receipts were higher or lower than one year earlier.
              </p>
            }
            caveat={<p>{data.methodology.caveat}</p>}
            sourceLabel="ONS public-sector-finance bulletin"
            sourceUrl={data.source.bulletinUrl}
            sourceDate={`Published ${formatReleaseDate(data.headline.releaseDate)} · observation period ${data.headline.period}`}
          />
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Current receipts estimate unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            public-data.org could not verify one complete current ONS public-finance release, so it is not showing an older annual estimate or a forecast.
          </p>
        </section>
      )}

      <MetricsStatus section="taxRevenue" status={metrics} />
    </div>
  );
}
