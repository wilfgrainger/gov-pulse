"use client";

import { useMemo } from "react";
import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import ReleaseNoteStrip from "@/app/components/ReleaseNoteStrip";
import HousingAffordabilityVisual, {
  type TrendComparisonPoint,
} from "@/app/components/visuals/HousingAffordabilityVisual";
import { buildReleaseNote } from "@/app/lib/releaseNote";
import { useMetrics } from "@/app/lib/useMetrics";

type HousePriceHeadline = {
  period: string;
  observedAt: number;
  releaseDate: string;
  avgPriceGbp: number;
  changePercent: number;
  previousPeriod: string;
  previousChangePercent: number;
};

type HousePriceHistory = {
  period: string;
  observedAt: number;
  hpiChangePercent: number;
};

type HousePricePayload = {
  headline: HousePriceHeadline;
  history: HousePriceHistory[];
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

const FALLBACK: HousePricePayload = {
  headline: {
    period: "",
    observedAt: 0,
    releaseDate: "",
    avgPriceGbp: 0,
    changePercent: 0,
    previousPeriod: "",
    previousChangePercent: 0,
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
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

function validHeadline(value: unknown): value is HousePriceHeadline {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<HousePriceHeadline>;
  const releaseDate = nonEmptyString(candidate.releaseDate)
    ? parseDateOnlyUtc(candidate.releaseDate)
    : new Date(Number.NaN);

  return (
    nonEmptyString(candidate.period) &&
    nonEmptyString(candidate.previousPeriod) &&
    typeof candidate.observedAt === "number" &&
    Number.isFinite(candidate.observedAt) &&
    typeof candidate.avgPriceGbp === "number" &&
    Number.isFinite(candidate.avgPriceGbp) &&
    candidate.avgPriceGbp > 0 &&
    typeof candidate.changePercent === "number" &&
    Number.isFinite(candidate.changePercent) &&
    typeof candidate.previousChangePercent === "number" &&
    Number.isFinite(candidate.previousChangePercent) &&
    !Number.isNaN(releaseDate.getTime())
  );
}

function validPayload(value: unknown): value is HousePricePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<HousePricePayload>;
  return (
    validHeadline(candidate.headline) &&
    Array.isArray(candidate.history) &&
    candidate.history.length >= 2 &&
    candidate.history.every(
      (point) =>
        nonEmptyString(point?.period) &&
        typeof point?.observedAt === "number" &&
        Number.isFinite(point.observedAt) &&
        typeof point?.hpiChangePercent === "number" &&
        Number.isFinite(point.hpiChangePercent)
    ) &&
    nonEmptyString(candidate.methodology?.measure) &&
    nonEmptyString(candidate.methodology?.status) &&
    nonEmptyString(candidate.methodology?.revisionNote) &&
    nonEmptyString(candidate.source?.edition) &&
    candidate.source?.bulletinUrl?.startsWith("https://www.ons.gov.uk/") === true &&
    candidate.source?.historyUrl?.startsWith("https://www.ons.gov.uk/") === true
  );
}

export default function HousePriceIndex() {
  const metrics = useMetrics("housePriceIndex", FALLBACK);
  const wagesMetrics = useMetrics("realWages", {
    headline: { period: "", observedAt: 0, releaseDate: "", regularPayRealGrowthPercent: 0, totalPayRealGrowthPercent: 0, deflator: "CPIH" },
    history: [],
    methodology: { measure: "", status: "", revisionNote: "" },
    source: { edition: "", bulletinUrl: "", historyUrl: "" },
  });
  const payload = metrics.data as unknown;
  const valid =
    metrics.isLive && metrics.cacheState === "fresh" && validPayload(payload);
  const headline = valid ? payload.headline : null;
  const wagesData = wagesMetrics.data as {
    headline?: {
      regularPayRealGrowthPercent?: number;
      period?: string;
    };
    history?: Array<{
      period: string;
      regularPayRealGrowthPercent?: number | null;
    }>;
  } | null;
  const wagesAreCurrent =
    wagesMetrics.isLive && wagesMetrics.cacheState === "fresh";
  const wageHeadlineValue = wagesData?.headline?.regularPayRealGrowthPercent;
  const currentRealWageGrowth =
    wagesAreCurrent &&
    typeof wageHeadlineValue === "number" &&
    Number.isFinite(wageHeadlineValue) &&
    nonEmptyString(wagesData?.headline?.period)
      ? wageHeadlineValue
      : null;
  const wagesPeriod =
    currentRealWageGrowth !== null && nonEmptyString(wagesData?.headline?.period)
      ? wagesData.headline.period
      : "Unavailable";
  const change = headline ? headline.changePercent : 0;
  const direction = change >= 0 ? "rose" : "fell";
  const comparisonDirection = change >= 0 ? "higher" : "lower";

  const comparisonPoints = useMemo<TrendComparisonPoint[]>(() => {
    if (!valid || !payload?.history) return [];
    const wageHistory =
      wagesAreCurrent && Array.isArray(wagesData?.history)
        ? wagesData.history
        : [];
    const wageByPeriod = new Map<string, number>();
    for (const item of wageHistory) {
      if (
        nonEmptyString(item.period) &&
        typeof item.regularPayRealGrowthPercent === "number" &&
        Number.isFinite(item.regularPayRealGrowthPercent)
      ) {
        wageByPeriod.set(item.period, item.regularPayRealGrowthPercent);
      }
    }
    return payload.history.map((h) => ({
      date: h.period,
      housePriceGrowthPct: h.hpiChangePercent,
      realWageGrowthPct: wageByPeriod.get(h.period) ?? null,
    }));
  }, [payload, valid, wagesAreCurrent, wagesData]);

  const releaseNote =
    valid && headline
      ? buildReleaseNote({
          measureLabel: "Annual house price change",
          latestValueDisplay: formatPercent(headline.changePercent),
          latestPeriod: headline.period,
          releaseDate: headline.releaseDate,
          history: payload.history.map((point) => ({
            observedAt: point.observedAt,
            value: point.hpiChangePercent,
          })),
        })
      : null;

  return (
    <div className="space-y-8">
      {valid && headline ? (
        <>
          <section aria-labelledby="house-price-index-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Latest ONS estimate</p>
            <h3
              id="house-price-index-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              The average UK house price {direction} to {formatCurrency(headline.avgPriceGbp)} in the 12 months to {headline.period}.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              Annual house price inflation is {formatPercent(headline.changePercent)}, {comparisonDirection} than the {formatPercent(headline.previousChangePercent)} recorded in the 12 months to {headline.previousPeriod}.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {formatReleaseDate(headline.releaseDate)}. This is a provisional first estimate and may be revised as later transaction data is incorporated.
            </p>
            {releaseNote ? <ReleaseNoteStrip idPrefix="house-price-index" note={releaseNote} /> : null}
          </section>

          <section aria-labelledby="house-price-index-components-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Latest observation</p>
              <h4 id="house-price-index-components-title" className="mt-1 text-2xl font-semibold">
                Average price and annual change
              </h4>
            </div>
            <dl className="grid border-y border-black/20 md:grid-cols-2 md:divide-x md:divide-black/15">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">Average UK house price</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{formatCurrency(headline.avgPriceGbp)}</dd>
                <dd className="mt-2 text-xs text-gray-600">Headline-only; no comparable price-level history is published</dd>
              </div>
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">Annual % change</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums text-accent">{formatPercent(headline.changePercent)}</dd>
                <dd className="mt-2 text-xs text-gray-600">Previous 12 months to {headline.previousPeriod}: {formatPercent(headline.previousChangePercent)}</dd>
              </div>
            </dl>
          </section>

          {/* Visual 4: Housing Affordability & Real Wages Trend */}
          <HousingAffordabilityVisual
            points={comparisonPoints}
            currentHpiChange={headline.changePercent}
            currentRealWageGrowth={currentRealWageGrowth}
            hpiPeriod={headline.period}
            wagesPeriod={wagesPeriod}
          />

          <FinancialTimeSeriesChart
            title="UK House Price Index: annual percentage change"
            description="Monthly annual percentage-change observations from the latest ONS Private rent and house prices, UK bulletin's Figure 1 chart data. The average price level is headline-only and is not part of this history."
            citation={`Office for National Statistics · Bulletin: ${payload.source.bulletinUrl} · History CSV: ${payload.source.historyUrl} · published ${headline.releaseDate} · observation period ${payload.history[0]?.period ?? headline.period} to ${payload.history.at(-1)?.period ?? headline.period} · ${payload.methodology.revisionNote}`}
            data={payload.history}
            series={[
              { key: "hpiChangePercent", label: "Annual % change", color: "#1f5c8a" },
            ]}
            valueFormatter={formatPercent}
            referenceValue={0}
          />

          <CoreEvidenceExplanation
            idPrefix="house-price-index"
            why={
              <p>
                House prices affect housing affordability, household wealth and mortgage costs across the UK. This estimate does not by itself explain those effects.
              </p>
            }
            definition={
              <p>
                {payload.methodology.measure}.
              </p>
            }
            unit="Average price (£) and annual %-change"
            geography="United Kingdom"
            interpretation={
              <p>
                The annual change compares the latest 12-month period with the preceding 12-month period on the same UK House Price Index definition. The average price figure is a single headline level and is not tracked as a time series on this page.
              </p>
            }
            caveat={<p>{payload.methodology.revisionNote}</p>}
            sourceLabel="ONS Private rent and house prices, UK bulletin"
            sourceUrl={payload.source.bulletinUrl}
            sourceDate={`Published ${formatReleaseDate(headline.releaseDate)} · observation period ${headline.period}`}
          />
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">House price estimate unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            public-data.org could not verify one complete, reconciled current ONS house price release, so no embedded or older headline estimate is shown.
          </p>
        </section>
      )}

      <MetricsStatus section="housePriceIndex" status={metrics} />
    </div>
  );
}
