"use client";

import MetricsStatus from "@/app/components/MetricsStatus";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import SeriesEvidence, {
  type SeriesEvidenceItem,
} from "@/app/components/SeriesEvidence";
import { useMetrics } from "@/app/lib/useMetrics";

const FALLBACK = {
  available: false,
  headline: {
    period: "",
    observedAt: 0,
    releaseDate: "",
    employmentRate: 0,
    unemploymentRate: 0,
    inactivityRate: 0,
    vacancies: 0,
    vacanciesPeriod: "",
  },
  annualDelta: {
    employmentRatePoints: 0,
    unemploymentRatePoints: 0,
    inactivityRatePoints: 0,
    vacancies: 0,
  },
  history: {
    labourForce: [] as Array<{
      period: string;
      observedAt: number;
      employmentRate: number;
      unemploymentRate: number;
      inactivityRate: number;
    }>,
    vacancies: [] as Array<{
      period: string;
      observedAt: number;
      vacancies: number;
    }>,
  },
  methodology: {
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

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function validPayload(value: typeof FALLBACK) {
  return (
    value?.available === true &&
    typeof value.headline?.period === "string" &&
    value.headline.period.trim().length > 0 &&
    finite(value.headline.observedAt) &&
    !Number.isNaN(parseDateOnlyUtc(value.headline.releaseDate).getTime()) &&
    finite(value.headline.employmentRate) &&
    finite(value.headline.unemploymentRate) &&
    finite(value.headline.inactivityRate) &&
    finite(value.headline.vacancies) &&
    value.headline.vacancies >= 0 &&
    value.annualDelta !== undefined &&
    Object.values(value.annualDelta).every(finite) &&
    value.history !== undefined &&
    Array.isArray(value.history.labourForce) &&
    value.history.labourForce.length >= 13 &&
    Array.isArray(value.history.vacancies) &&
    value.history.vacancies.length >= 13 &&
    typeof value.headline.vacanciesPeriod === "string" &&
    value.headline.vacanciesPeriod.trim().length > 0 &&
    typeof value.methodology?.caveat === "string" &&
    typeof value.source?.bulletinUrl === "string" &&
    value.source.bulletinUrl.startsWith("https://www.ons.gov.uk/")
  );
}

function formatPeople(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

export default function EmploymentStats() {
  const metrics = useMetrics("employmentStats", FALLBACK);
  const data = metrics.data;
  const valid = validPayload(data);
  const evidence: SeriesEvidenceItem[] = valid
    ? [
        {
          id: "labour-force-survey-rates",
          label: "Employment, unemployment and inactivity rates",
          period: data.headline.period,
          publisher: "Office for National Statistics",
          sourceUrl: data.source.bulletinUrl,
          retrievedAt: metrics.lastUpdated,
          publishedAt: data.headline.releaseDate,
          revisionStatus:
            "Labour Force Survey estimates carry sampling uncertainty and may be revised in later releases.",
          evidenceClass: "Official data",
          note: "These three rates use the same rolling three-month Labour Force Survey period.",
        },
        {
          id: "vacancies",
          label: "Vacancies",
          period: data.headline.vacanciesPeriod,
          publisher: "Office for National Statistics",
          sourceUrl: data.source.bulletinUrl,
          retrievedAt: metrics.lastUpdated,
          publishedAt: data.headline.releaseDate,
          revisionStatus:
            "Vacancy estimates come from a separate employer survey and may be revised.",
          evidenceClass: "Official data",
          note: "The vacancies period is kept separate from the Labour Force Survey rates rather than blended into one date.",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {valid ? (
        <>
          <section aria-labelledby="employment-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Latest ONS labour-market release</p>
            <h3
              id="employment-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              Employment was {data.headline.employmentRate.toFixed(1)}% and unemployment was {data.headline.unemploymentRate.toFixed(1)}%.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              The rates cover {data.headline.period}. Economic inactivity was {data.headline.inactivityRate.toFixed(1)}%.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
                parseDateOnlyUtc(data.headline.releaseDate)
              )}. Labour Force Survey estimates are rolling three-month estimates and carry sampling uncertainty.
            </p>
          </section>

          <section aria-labelledby="employment-numbers-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="employment-numbers-title" className="mt-1 text-2xl font-semibold">
                Four measures, two reporting periods
              </h4>
            </div>
            <dl className="grid border-y border-black/20 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-black/15">
              <div className="p-4"><dt className="text-sm text-gray-600">Employment rate</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{data.headline.employmentRate.toFixed(1)}%</dd><dd className="mt-2 text-xs text-gray-600">Annual change {data.annualDelta.employmentRatePoints > 0 ? "+" : ""}{data.annualDelta.employmentRatePoints.toFixed(1)} points</dd></div>
              <div className="border-t border-black/15 p-4 sm:border-l sm:border-t-0"><dt className="text-sm text-gray-600">Unemployment rate</dt><dd className="mt-1 text-3xl font-semibold tabular-nums text-accent">{data.headline.unemploymentRate.toFixed(1)}%</dd><dd className="mt-2 text-xs text-gray-600">Annual change {data.annualDelta.unemploymentRatePoints > 0 ? "+" : ""}{data.annualDelta.unemploymentRatePoints.toFixed(1)} points</dd></div>
              <div className="border-t border-black/15 p-4 lg:border-l lg:border-t-0"><dt className="text-sm text-gray-600">Inactivity rate</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{data.headline.inactivityRate.toFixed(1)}%</dd><dd className="mt-2 text-xs text-gray-600">Annual change {data.annualDelta.inactivityRatePoints > 0 ? "+" : ""}{data.annualDelta.inactivityRatePoints.toFixed(1)} points</dd></div>
              <div className="border-t border-black/15 p-4 sm:border-l lg:border-t-0"><dt className="text-sm text-gray-600">Vacancies</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{formatPeople(data.headline.vacancies)}</dd><dd className="mt-1 text-xs text-gray-600">{data.headline.vacanciesPeriod}</dd><dd className="mt-2 text-xs text-gray-600">Annual change {data.annualDelta.vacancies > 0 ? "+" : ""}{formatPeople(data.annualDelta.vacancies)}</dd></div>
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="Labour-force rates: ten-year direction"
            description="Rolling three-month ONS estimates. Each line uses the same Labour Force Survey period; straight segments join published observations."
            data={data.history.labourForce}
            series={[
              { key: "employmentRate", label: "Employment", color: "#172234" },
              { key: "unemploymentRate", label: "Unemployment", color: "#b23a20" },
              { key: "inactivityRate", label: "Inactivity", color: "#6b7280", dashed: true },
            ]}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
          />

          <FinancialTimeSeriesChart
            title="UK vacancies: ten-year direction"
            description="Rolling three-month ONS Vacancy Survey estimate. This is a separate employer survey and is not forced onto the Labour Force Survey clock."
            data={data.history.vacancies}
            series={[{ key: "vacancies", label: "Vacancies", color: "#172234" }]}
            valueFormatter={formatPeople}
            axisFormatter={(value) => `${Math.round(value / 1_000)}k`}
          />

          <SeriesEvidence items={evidence} title="Freshness and provenance for each labour-market series" />

          <section aria-labelledby="employment-why-title" className="border-l-4 border-foreground pl-4">
            <h3 id="employment-why-title" className="text-lg font-semibold">Why it matters</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              Employment, unemployment and inactivity describe different parts of the labour market. Vacancies come from a separate employer survey, so their period is shown separately rather than blended into one headline.
            </p>
          </section>

          <details className="border-y border-black/20 py-4">
            <summary className="cursor-pointer text-lg font-semibold">Explain these numbers</summary>
            <div className="mt-4 grid gap-5 text-sm leading-6 text-gray-700 md:grid-cols-2">
              <div><strong className="text-foreground">Important caveat</strong><p>{data.methodology.caveat}</p></div>
              <div><strong className="text-foreground">Official source</strong><p><a className="font-semibold underline underline-offset-4" href={data.source.bulletinUrl} target="_blank" rel="noopener noreferrer">ONS UK labour-market bulletin</a></p></div>
            </div>
          </details>
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Current labour-market release unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            public-data.org could not verify one complete current ONS release, so it is not showing the older embedded rates or workforce estimates.
          </p>
        </section>
      )}

      <section aria-labelledby="employment-withdrawn-title" className="border-l-4 border-foreground pl-4">
        <h3 id="employment-withdrawn-title" className="text-lg font-semibold">Workforce breakdowns withdrawn</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
          The previous page mixed Labour Force Survey rates with public/private employment totals, public-sector categories and a hand-built annual trend. Those series remain unavailable until each has a named source and matching period.
        </p>
      </section>

      <MetricsStatus section="employmentStats" status={metrics} />
    </div>
  );
}
