"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import { describeChange } from "@/app/lib/changeLanguage";
import { useMetrics } from "@/app/lib/useMetrics";

type EarlyYearsHeadline = {
  mmrPeriod: string;
  mmrObservedAt: number;
  mmrRate: number;
  mmrDelta: number | null;
  schoolReadyPeriod: string;
  schoolReadyObservedAt: number;
  schoolReadyRate: number;
  schoolReadyDelta: number | null;
};

type EarlyYearsHistory = {
  mmrPeriod: string;
  mmrObservedAt: number;
  mmrRate: number | null;
  schoolReadyPeriod: string;
  schoolReadyObservedAt: number;
  schoolReadyRate: number | null;
};

type EarlyYearsPayload = {
  available: boolean;
  headline: EarlyYearsHeadline;
  history: EarlyYearsHistory[];
  source: {
    mmrPublisher: string;
    mmrEditionId: string;
    mmrUrl: string;
    mmrPublicationDate: string;
    mmrValidUntil: string;
    schoolReadyPublisher: string;
    schoolReadyEditionId: string;
    schoolReadyUrl: string;
    schoolReadyPublicationDate: string;
    schoolReadyValidUntil: string;
  };
};

const FALLBACK: EarlyYearsPayload = {
  available: false,
  headline: {
    mmrPeriod: "",
    mmrObservedAt: 0,
    mmrRate: 0,
    mmrDelta: null,
    schoolReadyPeriod: "",
    schoolReadyObservedAt: 0,
    schoolReadyRate: 0,
    schoolReadyDelta: null,
  },
  history: [],
  source: {
    mmrPublisher: "",
    mmrEditionId: "",
    mmrUrl: "",
    mmrPublicationDate: "",
    mmrValidUntil: "",
    schoolReadyPublisher: "",
    schoolReadyEditionId: "",
    schoolReadyUrl: "",
    schoolReadyPublicationDate: "",
    schoolReadyValidUntil: "",
  },
};

function dateOnly(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

function validPeriod(value: unknown): value is string {
  return typeof value === "string" && /^20\d{2}\/\d{2}$/.test(value) &&
    Number(value.slice(-2)) === (Number(value.slice(0, 4)) + 1) % 100;
}

function validRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validPayload(value: unknown, now = Date.now()): value is EarlyYearsPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<EarlyYearsPayload>;
  const headline = candidate.headline;
  const source = candidate.source;
  if (
    candidate.available !== true || !headline || !source ||
    !validPeriod(headline.mmrPeriod) || !validPeriod(headline.schoolReadyPeriod) ||
    !Number.isFinite(headline.mmrObservedAt) || headline.mmrObservedAt > now ||
    !Number.isFinite(headline.schoolReadyObservedAt) || headline.schoolReadyObservedAt > now ||
    !validRate(headline.mmrRate) || !validRate(headline.schoolReadyRate) ||
    !(headline.mmrDelta === null || (typeof headline.mmrDelta === "number" && Number.isFinite(headline.mmrDelta))) ||
    !(headline.schoolReadyDelta === null || (typeof headline.schoolReadyDelta === "number" && Number.isFinite(headline.schoolReadyDelta))) ||
    source.mmrPublisher !== "UK Health Security Agency" || source.schoolReadyPublisher !== "Department for Education" ||
    typeof source.mmrEditionId !== "string" || !source.mmrEditionId.trim() ||
    typeof source.schoolReadyEditionId !== "string" || !source.schoolReadyEditionId.trim() ||
    typeof source.mmrUrl !== "string" || !source.mmrUrl.startsWith("https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme") ||
    typeof source.schoolReadyUrl !== "string" || !source.schoolReadyUrl.startsWith("https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/")
  ) return false;
  const mmrPublishedAt = dateOnly(source.mmrPublicationDate);
  const schoolReadyPublishedAt = dateOnly(source.schoolReadyPublicationDate);
  const mmrValidUntil = Date.parse(source.mmrValidUntil);
  const schoolReadyValidUntil = Date.parse(source.schoolReadyValidUntil);
  if (
    mmrPublishedAt === null || schoolReadyPublishedAt === null ||
    mmrPublishedAt > now || schoolReadyPublishedAt > now ||
    mmrPublishedAt < headline.mmrObservedAt ||
    schoolReadyPublishedAt < headline.schoolReadyObservedAt ||
    !Number.isFinite(mmrValidUntil) || mmrValidUntil <= now ||
    !Number.isFinite(schoolReadyValidUntil) || schoolReadyValidUntil <= now
  ) return false;
  if (!Array.isArray(candidate.history) || candidate.history.length < 2) return false;
  const history = candidate.history as EarlyYearsHistory[];
  if (!history.every((point) =>
    validPeriod(point.mmrPeriod) && validPeriod(point.schoolReadyPeriod) &&
    Number.isFinite(point.mmrObservedAt) && point.mmrObservedAt <= now &&
    Number.isFinite(point.schoolReadyObservedAt) && point.schoolReadyObservedAt <= now &&
    (point.mmrRate === null || validRate(point.mmrRate)) &&
    (point.schoolReadyRate === null || validRate(point.schoolReadyRate))
  )) return false;
  const latest = history.at(-1);
  return history.slice(1).every((point, index) =>
    point.mmrObservedAt > history[index].mmrObservedAt &&
    point.schoolReadyObservedAt > history[index].schoolReadyObservedAt
  ) && latest?.mmrPeriod === headline.mmrPeriod &&
    latest.schoolReadyPeriod === headline.schoolReadyPeriod &&
    latest.mmrRate === headline.mmrRate &&
    latest.schoolReadyRate === headline.schoolReadyRate;
}

function changeDescription(value: number | null, current: number): string {
  const direction = describeChange(value);
  if (direction === "unavailable") return `change not available; latest rate ${current.toFixed(1)}%`;
  if (direction === "was unchanged") return `was unchanged at ${current.toFixed(1)}%`;
  return `${direction} by ${Math.abs(value as number).toFixed(1)} percentage points to ${current.toFixed(1)}%`;
}

export default function EarlyYearsStats() {
  const metrics = useMetrics("earlyYears", FALLBACK);
  const data = metrics.data;
  const valid = metrics.isLive && validPayload(data);
  const history = valid ? data.history.map((point) => ({
    observedAt: point.mmrObservedAt,
    period: point.mmrPeriod,
    mmrRate: point.mmrRate,
  })) : [];

  return (
    <div className="space-y-8">
      {valid ? (
        <>
          <section aria-labelledby="early-years-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">National Data Library Spotlight</p>
            <h3
              id="early-years-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              England MMR vaccination coverage {changeDescription(data.headline.mmrDelta, data.headline.mmrRate)} in {data.headline.mmrPeriod}
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              The percentage of children receiving their first dose of the MMR vaccine by age two is compared with the World Health Organisation target of 95.0%. School readiness at the end of reception {changeDescription(data.headline.schoolReadyDelta, data.headline.schoolReadyRate)} in {data.headline.schoolReadyPeriod}.
            </p>
          </section>

          <section aria-labelledby="early-years-numbers-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Key indicators</p>
              <h4 id="early-years-numbers-title" className="mt-1 text-2xl font-semibold">
                MMR vaccine coverage and school readiness outturns
              </h4>
            </div>
            <dl className="grid border-y border-black/20 md:grid-cols-2 md:divide-x md:divide-black/15">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">MMR 1st Dose (Age 2)</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums text-accent">
                  {data.headline.mmrRate.toFixed(1)}%
                </dd>
                <dd className="mt-2 text-sm text-gray-600">
                  {data.headline.mmrPeriod} · {data.headline.mmrDelta === null ? "matched annual change unavailable" : `${data.headline.mmrDelta > 0 ? "+" : ""}${data.headline.mmrDelta.toFixed(1)} percentage points since the previous comparable year`}.
                </dd>
              </div>
              <div className="border-t border-black/15 p-4 md:border-l md:border-t-0 md:p-5">
                <dt className="text-sm text-gray-600">School Readiness (GLD index)</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums">
                  {data.headline.schoolReadyRate.toFixed(1)}%
                </dd>
                <dd className="mt-2 text-sm text-gray-600">
                  {data.headline.schoolReadyPeriod} · percentage of children achieving Good Level of Development.
                </dd>
              </div>
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="MMR 1st dose vaccination rate history"
            description="The percentage of children immunized by age two in England. A standard WHO reference target is shown at 95%."
            citation={`${data.source.mmrPublisher} · ${data.source.mmrUrl} · edition ${data.source.mmrEditionId} · published ${data.source.mmrPublicationDate} · observation period ${data.headline.mmrPeriod} · 95% WHO reference target; school-readiness and MMR series have separate sources and periods.`}
            data={history}
            series={[{ key: "mmrRate", label: "MMR coverage rate", color: "#1f5c8a" }]}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
            referenceValue={95}
            referenceLabel="WHO Target (95%)"
            downloadLabel="Download full verified snapshot (JSON)"
          />

          <CoreEvidenceExplanation
            idPrefix="early-years"
            why={
              <p>
                Early years development is a primary driver of long-term social mobility, health outcomes, and educational attainment. Child immunisation and school readiness scores provide critical checks on the status of child health and development support.
              </p>
            }
            definition={
              <p>
                MMR1 coverage represents the percentage of children who had received their first MMR dose by age 24 months, published by the UK Health Security Agency. School readiness measures the proportion of children achieving a &quot;Good Level of Development&quot; (GLD) on the Early Years Foundation Stage Profile (EYFSP), published by the Department for Education.
              </p>
            }
            unit="Percentage of child population cohort"
            geography="England"
            interpretation={
              <p>
                A high vaccine rate (95%) ensures herd immunity against measles outbreaks. The GLD index reflects child performance across communication, physical development, and personal/social/emotional skills at reception end.
              </p>
            }
            caveat={
              <p>
                EYFSP profiles were cancelled during the COVID-19 pandemic (2019/20 and 2020/21 academic years), resulting in missing data points. A new baseline assessment model was introduced in 2021/22, meaning GLD rates before and after this period are not directly comparable.
              </p>
            }
            sourceLabel="UKHSA and DfE early years publications"
            sourceUrl={data.source.mmrUrl}
            sourceDate={`${data.source.mmrPublisher} published ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${data.source.mmrPublicationDate}T00:00:00Z`))} · MMR observation period ${data.headline.mmrPeriod}; ${data.source.schoolReadyPublisher} published ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${data.source.schoolReadyPublicationDate}T00:00:00Z`))} · school-readiness observation period ${data.headline.schoolReadyPeriod}`}
            additionalSources={[{ label: "DfE school-readiness publication", url: data.source.schoolReadyUrl }]}
          />
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Early years data unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            public-data.org could not verify current child vaccination or school readiness data, so no metrics are shown.
          </p>
        </section>
      )}

      <MetricsStatus section="earlyYears" status={metrics} />
    </div>
  );
}
