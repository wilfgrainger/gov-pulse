"use client";

import { useMemo, useState } from "react";
import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import SeriesEvidence, {
  type SeriesEvidenceItem,
} from "@/app/components/SeriesEvidence";
import { useMetrics } from "@/app/lib/useMetrics";

const FALLBACK = {
  available: false,
  order: [],
  series: {},
  methodology: {
    alignment: "",
    evidenceClass: "official-data",
  },
};

type Metric = "inflation" | "bankRate" | "unemployment";

type HistoryPoint = {
  period: string;
  observedAt: string;
  value: number;
};

type EconomicSeries = {
  id: Metric;
  label: string;
  shortLabel: string;
  value: number;
  unit: string;
  color: string;
  period: string;
  observedAt: string;
  publishedAt: string;
  retrievedAt: string;
  publisher: string;
  sourceUrl: string;
  seriesId: string;
  datasetId: string;
  frequency: string;
  revisionStatus: string;
  evidenceClass: string;
  status: "current";
  nextRelease: string | null;
  annualDelta: number | null;
  annualDeltaUnit: "percentage points";
  history: HistoryPoint[];
};

type EconomicPayload = typeof FALLBACK & {
  available: boolean;
  order: Metric[];
  series: Partial<Record<Metric, EconomicSeries>>;
};

const EXPECTED_ORDER: Metric[] = ["inflation", "bankRate", "unemployment"];

function validTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validSeries(value: unknown, id: Metric): value is EconomicSeries {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const series = value as Partial<EconomicSeries>;
  return (
    series.id === id &&
    typeof series.label === "string" &&
    series.label.trim().length > 0 &&
    typeof series.shortLabel === "string" &&
    series.shortLabel.trim().length > 0 &&
    typeof series.value === "number" &&
    Number.isFinite(series.value) &&
    typeof series.unit === "string" &&
    typeof series.color === "string" &&
    typeof series.period === "string" &&
    series.period.trim().length > 0 &&
    validTimestamp(series.observedAt) &&
    validTimestamp(series.publishedAt) &&
    validTimestamp(series.retrievedAt) &&
    typeof series.publisher === "string" &&
    series.publisher.trim().length > 0 &&
    typeof series.sourceUrl === "string" &&
    series.sourceUrl.startsWith("https://") &&
    typeof series.revisionStatus === "string" &&
    series.revisionStatus.trim().length > 0 &&
    series.evidenceClass === "official-data" &&
    series.status === "current" &&
    (series.annualDelta === null ||
      (typeof series.annualDelta === "number" && Number.isFinite(series.annualDelta))) &&
    series.annualDeltaUnit === "percentage points" &&
    Array.isArray(series.history) &&
    series.history.length > 0 &&
    series.history.every(
      (point) =>
        typeof point?.period === "string" &&
        point.period.trim().length > 0 &&
        validTimestamp(point.observedAt) &&
        typeof point.value === "number" &&
        Number.isFinite(point.value)
    )
  );
}

function validPayload(value: EconomicPayload) {
  return (
    value?.available === true &&
    Array.isArray(value.order) &&
    JSON.stringify(value.order) === JSON.stringify(EXPECTED_ORDER) &&
    EXPECTED_ORDER.every((id) => validSeries(value.series?.[id], id)) &&
    !("economicData" in value) &&
    !("metricConfig" in value)
  );
}

function formatValue(value: number, unit: string) {
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value)}${unit}`;
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function definitionFor(series: EconomicSeries) {
  if (series.id === "inflation") {
    return "The 12-month percentage change in the Consumer Prices Index.";
  }
  if (series.id === "bankRate") {
    return "The official interest rate set by the Bank of England Monetary Policy Committee.";
  }
  return "The share of the economically active population who are unemployed, estimated from the Labour Force Survey over a rolling three-month period.";
}

function interpretationFor(series: EconomicSeries) {
  if (series.id === "inflation") {
    return "A positive rate means the CPI basket cost more than one year earlier; the number does not describe every household's personal inflation rate.";
  }
  if (series.id === "bankRate") {
    return "Bank Rate influences borrowing and saving rates but is not the rate every household or business receives.";
  }
  return "The rate is a survey estimate of labour-market slack, not a count of every person without work.";
}

export default function SentimentPulse() {
  const metrics = useMetrics("sentimentPulse", FALLBACK);
  const data = metrics.data as EconomicPayload;
  const valid =
    metrics.isLive && metrics.cacheState === "fresh" && validPayload(data);
  const [metric, setMetric] = useState<Metric>("inflation");
  const selected = valid ? data.series[metric] ?? null : null;

  const chartData = useMemo(
    () =>
      selected?.history.map((point) => ({
        observedAt: Date.parse(point.observedAt),
        period: point.period,
        value: point.value,
      })) ?? [],
    [selected]
  );

  const evidence = useMemo<SeriesEvidenceItem[]>(
    () =>
      valid
        ? data.order.map((id) => {
            const series = data.series[id] as EconomicSeries;
            return {
              id,
              label: series.label,
              period: series.period,
              publisher: series.publisher,
              sourceUrl: series.sourceUrl,
              retrievedAt: series.retrievedAt,
              publishedAt: series.publishedAt,
              revisionStatus: series.revisionStatus,
              evidenceClass: "Official data",
              note:
                id === "bankRate"
                  ? "Bank Rate remains current until the Monetary Policy Committee changes it; its observation date is not a monthly reference period."
                  : id === "unemployment"
                    ? "This is a rolling three-month Labour Force Survey estimate, not a single-month count."
                    : undefined,
            };
          })
        : [],
    [data, valid]
  );

  return (
    <div className="space-y-8">
      {valid && selected ? (
        <>
          <section aria-labelledby="indicator-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Three official series, three publication clocks</p>
            <h3
              id="indicator-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              Inflation is {formatValue(data.series.inflation!.value, "%")}, Bank Rate is {formatValue(data.series.bankRate!.value, "%")} and unemployment is {formatValue(data.series.unemployment!.value, "%")}.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              These figures do not describe the same month. Each value below keeps its own observation period, publication date, date last checked and revision status.
            </p>
          </section>

          <section aria-labelledby="indicator-series-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="indicator-series-title" className="mt-1 text-2xl font-semibold">
                Latest official readings, kept on separate clocks
              </h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                Select a series to inspect its own published history. public-data.org does not carry Bank Rate or unemployment forward onto the CPI timeline.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {data.order.map((id) => {
                const entry = data.series[id] as EconomicSeries;
                const active = metric === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMetric(id)}
                    className={`border-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black ${
                      active ? "border-black bg-black text-white" : "border-black bg-white"
                    }`}
                  >
                    <span className={`text-xs font-semibold ${active ? "text-gray-300" : "text-gray-600"}`}>
                      {entry.shortLabel}
                    </span>
                    <span
                      className={`mt-2 block text-3xl font-semibold tabular-nums ${active ? "text-white" : ""}`}
                      style={{ color: active ? undefined : "#111111" }}
                    >
                      {formatValue(entry.value, entry.unit)}
                    </span>
                    <span className={`mt-2 block text-xs leading-5 ${active ? "text-gray-300" : "text-gray-600"}`}>
                      {entry.period}
                    </span>
                    <span className={`mt-1 block text-xs font-semibold ${active ? "text-white" : "text-foreground"}`}>
                      {entry.publisher}
                    </span>
                    <span className={`mt-3 block border-t pt-2 text-xs tabular-nums ${active ? "border-white/25 text-gray-200" : "border-black/15 text-gray-600"}`}>
                      Annual change:{" "}
                      {entry.annualDelta === null
                        ? "not available"
                        : `${entry.annualDelta > 0 ? "+" : ""}${entry.annualDelta.toFixed(1)} percentage points`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <FinancialTimeSeriesChart
            title={`${selected.label}: published history`}
            description={`${selected.publisher}. Exact publication points; no smoothing, interpolation or filled area.`}
            data={chartData}
            series={[
              {
                key: "value",
                label: selected.label,
                color: selected.color,
                lineType: selected.id === "bankRate" ? "stepAfter" : "linear",
              },
            ]}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
            referenceValue={selected.id === "inflation" ? 2 : undefined}
            referenceLabel={selected.id === "inflation" ? "2% target" : undefined}
            heightClass="h-[280px]"
          />

          <CoreEvidenceExplanation
            idPrefix="indicator"
            why={
              <p>
                Inflation, Bank Rate and unemployment are widely watched signals for prices, monetary policy and labour-market conditions. They should be read together carefully, not treated as one composite score.
              </p>
            }
            definition={<p>{definitionFor(selected)}</p>}
            unit={`Percentage (${selected.unit})`}
            geography="United Kingdom"
            interpretation={<p>{interpretationFor(selected)}</p>}
            caveat={
              <p>
                {selected.revisionStatus} The three indicators use different periods and frequencies, so a change in one does not automatically explain a change in another.
              </p>
            }
            sourceLabel={`${selected.publisher}: ${selected.label}`}
            sourceUrl={selected.sourceUrl}
            sourceDate={`Published ${formatPublishedAt(selected.publishedAt)} · observation period ${selected.period}`}
          />

          <SeriesEvidence items={evidence} title="Freshness and provenance for each indicator" />
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Current economic indicators unavailable</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            public-data.org could not verify all three official series with their own periods and provenance, so it is not showing the old embedded values or carrying one series across another series&apos; timeline.
          </p>
        </section>
      )}

      <MetricsStatus section="sentimentPulse" status={metrics} />
    </div>
  );
}
