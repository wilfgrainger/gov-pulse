"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";

const FALLBACK = {
  available: true,
  headline: {
    period: "2024/25",
    mmrPeriod: "2024/25",
    schoolReadyPeriod: "2024/25",
    mmrRate: 88.9,
    mmrDelta: 0.0,
    schoolReadyRate: 68.3,
    schoolReadyDelta: 0.6,
  },
  history: [
    { period: "2021/22", observedAt: 1648684800000, mmrRate: null, schoolReadyRate: 65.2 },
    { period: "2022/23", observedAt: 1680220800000, mmrRate: null, schoolReadyRate: 67.2 },
    { period: "2023/24", observedAt: 1711843200000, mmrRate: 88.9, schoolReadyRate: 67.7 },
    { period: "2024/25", observedAt: 1743379200000, mmrRate: 88.9, schoolReadyRate: 68.3 },
  ],
  source: {
    mmrUrl: "https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-annual-reports/vaccination-coverage-statistics-for-children-aged-up-to-5-years-england-cover-programme-report-april-2024-to-march-2025",
    mmrPublicationDate: "2025-08-28",
    schoolReadyUrl: "https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/2024-25",
    schoolReadyPublicationDate: "2025-11-27",
  }
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPublicationDate(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function changeText(value: number): string {
  if (value === 0) return "unchanged";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} percentage points`;
}

export default function EarlyYearsStats() {
  const metrics = useMetrics("earlyYears", FALLBACK);
  const data = metrics.data;
  const mmrRate = finiteNumber(data?.headline?.mmrRate);
  const mmrDelta = finiteNumber(data?.headline?.mmrDelta);
  const schoolReadyRate = finiteNumber(data?.headline?.schoolReadyRate);
  const schoolReadyDelta = finiteNumber(data?.headline?.schoolReadyDelta);
  const mmrPublicationDate = formatPublicationDate(data?.source?.mmrPublicationDate);
  const schoolReadyPublicationDate = formatPublicationDate(data?.source?.schoolReadyPublicationDate);
  const valid =
    data?.available === true &&
    typeof data.headline?.mmrPeriod === "string" &&
    typeof data.headline?.schoolReadyPeriod === "string" &&
    data.headline.mmrPeriod.trim().length > 0 &&
    data.headline.schoolReadyPeriod.trim().length > 0 &&
    mmrRate !== null &&
    mmrDelta !== null &&
    schoolReadyRate !== null &&
    schoolReadyDelta !== null &&
    mmrPublicationDate !== null &&
    schoolReadyPublicationDate !== null &&
    typeof data.source?.mmrUrl === "string" &&
    typeof data.source?.schoolReadyUrl === "string";

  const mmrMovement =
    mmrDelta === null || mmrDelta === 0 ? "was unchanged at" : mmrDelta > 0 ? "rose to" : "fell to";

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
              England child MMR vaccination rate {mmrMovement} {mmrRate ?? 0}% in {data.headline.mmrPeriod}
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              The percentage of children receiving their first dose of the MMR vaccine by age two is measured against the World Health Organisation target of 95.0%. School readiness at the end of reception was last observed at {schoolReadyRate ?? 0}% in {data.headline.schoolReadyPeriod}; the two measures use different publications and should not be read as one combined score.
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
                  {(mmrRate ?? 0).toFixed(1)}%
                </dd>
                <dd className="mt-2 text-sm text-gray-600">
                  {data.headline.mmrPeriod} · {changeText(mmrDelta ?? 0)} since previous year.
                </dd>
              </div>
              <div className="border-t border-black/15 p-4 md:border-l md:border-t-0 md:p-5">
                <dt className="text-sm text-gray-600">School Readiness (GLD index)</dt>
                <dd className="mt-1 text-4xl font-semibold tabular-nums">
                  {(schoolReadyRate ?? 0).toFixed(1)}%
                </dd>
                <dd className="mt-2 text-sm text-gray-600">
                  {data.headline.schoolReadyPeriod} · {changeText(schoolReadyDelta ?? 0)} since previous year; percentage of children achieving Good Level of Development.
                </dd>
              </div>
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="MMR 1st dose vaccination rate history"
            description="The percentage of children immunized by age two in England. A standard WHO reference target is shown at 95%."
            data={data.history}
            series={[{ key: "mmrRate", label: "MMR coverage rate", color: "#b23a20" }]}
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
                The 95% figure is a WHO public-health target and comparison benchmark; coverage alone is not proof of local herd immunity. The GLD index reflects child performance across communication, physical development, and personal/social/emotional skills at reception end.
              </p>
            }
            caveat={
              <p>
                EYFSP profiles were cancelled during the COVID-19 pandemic (2019/20 and 2020/21 academic years), resulting in missing data points. A new baseline assessment model was introduced in 2021/22, meaning GLD rates before and after this period are not directly comparable.
              </p>
            }
            sourceLabel="UKHSA and DfE early years publications"
            sourceUrl={data.source.mmrUrl}
            sourceDate={`UKHSA published ${mmrPublicationDate ?? "date unavailable"} · MMR observation period ${data.headline.mmrPeriod}; DfE published ${schoolReadyPublicationDate ?? "date unavailable"} · school-readiness observation period ${data.headline.schoolReadyPeriod}`}
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
