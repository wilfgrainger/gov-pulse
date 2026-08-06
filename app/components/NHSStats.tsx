"use client";

import { useSyncExternalStore } from "react";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";

const FALLBACK = {
  available: false,
  expiresAt: "",
  headline: {
    period: "",
    observedAt: 0,
    publicationDate: "",
    waitingPathwaysEstimate: 0,
    waitingPathwaysDisplay: "",
    uniquePatientsEstimate: 0,
    within18WeeksPercent: 0,
    standardPercent: 92,
    medianWaitWeeks: 0,
    percentile92WaitWeeks: 0,
    over52Weeks: 0,
    over65Weeks: 0,
    over78Weeks: 0,
    over104Weeks: 0,
    yearChangePercent: 0,
    yearChangePathways: 0,
    newPathways: 0,
    admittedCompleted: 0,
    nonAdmittedCompleted: 0,
  },
  specialties: [],
  missingTrusts: [],
  history: [] as Array<{
    period: string;
    observedAt: number;
    medianWaitWeeks: number | null;
    percentile92WaitWeeks: number | null;
    within18WeeksPercent: number | null;
    over52Weeks: number | null;
    over65Weeks: number | null;
    over78Weeks: number | null;
    over104Weeks: number | null;
    waitingPathwaysEstimate: number | null;
    uniquePatientsEstimate: number | null;
    admittedCompleted: number | null;
    nonAdmittedCompleted: number | null;
    newPathways: number | null;
  }>,
  annualDelta: {
    medianWaitWeeks: 0,
    percentile92WaitWeeks: 0,
    within18WeeksPercent: 0,
    over52Weeks: 0,
    over65Weeks: 0,
    over78Weeks: 0,
    over104Weeks: 0,
    waitingPathwaysEstimate: 0,
    uniquePatientsEstimate: 0,
    admittedCompleted: 0,
    nonAdmittedCompleted: 0,
    newPathways: 0,
  },
  methodology: {
    geography: "",
    measure: "",
    waitingListUnit: "",
    peopleCaveat: "",
    estimatesCaveat: "",
    revisionNote: "",
  },
  source: {
    publisher: "",
    landingUrl: "",
    dataPageUrl: "",
    pressNoticeUrl: "",
    timeseriesUrl: "",
  },
  evidencePolicy: {
    sourceClass: "official-primary",
    headlineIncludesMissingTrustEstimates: true,
    specialtiesIncludeMissingTrustEstimates: false,
    withdrawnSeries: [],
  },
};

type Specialty = {
  name: string;
  incompletePathways: number;
  within18WeeksPercent: number;
};

type MissingTrust = {
  name: string;
  code: string;
};

const CLOCK_INTERVAL_MS = 60_000;
const clockListeners = new Set<() => void>();
let clientNowMs = Date.now();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function publishClockTick() {
  clientNowMs = Date.now();
  for (const listener of clockListeners) listener();
}

function subscribeToClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockTimer === null) {
    clockTimer = setInterval(publishClockTick, CLOCK_INTERVAL_MS);
  }

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClientClockSnapshot() {
  return clientNowMs;
}

function getServerClockSnapshot() {
  return 0;
}

function parseDateOnlyUtc(value: unknown) {
  const match =
    typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return new Date(Number.NaN);
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? date
    : new Date(Number.NaN);
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNhsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "www.england.nhs.uk" ||
        url.hostname === "england.nhs.uk")
    );
  } catch {
    return false;
  }
}

function validSpecialty(value: unknown): value is Specialty {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<Specialty>;
  return (
    nonEmptyText(row.name) &&
    positiveInteger(row.incompletePathways) &&
    finite(row.within18WeeksPercent) &&
    Number(row.within18WeeksPercent) >= 0 &&
    Number(row.within18WeeksPercent) <= 100
  );
}

function validMissingTrust(value: unknown): value is MissingTrust {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const trust = value as Partial<MissingTrust>;
  return nonEmptyText(trust.name) && nonEmptyText(trust.code);
}

function validPayload(value: typeof FALLBACK, nowMs: number) {
  const headline = value?.headline;
  return (
    value?.available === true &&
    Number.isFinite(Date.parse(value.expiresAt)) &&
    Date.parse(value.expiresAt) >= nowMs &&
    nonEmptyText(headline?.period) &&
    positiveInteger(headline?.observedAt) &&
    !Number.isNaN(parseDateOnlyUtc(headline?.publicationDate).getTime()) &&
    positiveInteger(headline?.waitingPathwaysEstimate) &&
    positiveInteger(headline?.uniquePatientsEstimate) &&
    finite(headline?.within18WeeksPercent) &&
    finite(headline?.standardPercent) &&
    finite(headline?.medianWaitWeeks) &&
    finite(headline?.percentile92WaitWeeks) &&
    positiveInteger(headline?.over52Weeks) &&
    positiveInteger(headline?.over65Weeks) &&
    positiveInteger(headline?.over78Weeks) &&
    positiveInteger(headline?.over104Weeks) &&
    finite(headline?.yearChangePercent) &&
    Number.isSafeInteger(headline?.yearChangePathways) &&
    positiveInteger(headline?.newPathways) &&
    positiveInteger(headline?.admittedCompleted) &&
    positiveInteger(headline?.nonAdmittedCompleted) &&
    Array.isArray(value.specialties) &&
    value.specialties.length >= 5 &&
    value.specialties.every(validSpecialty) &&
    Array.isArray(value.missingTrusts) &&
    value.missingTrusts.every(validMissingTrust) &&
    Array.isArray(value.history) &&
    value.history.length >= 13 &&
    Object.values(value.annualDelta).every(
      (entry) => entry === null || finite(entry)
    ) &&
    nonEmptyText(value.methodology?.peopleCaveat) &&
    nonEmptyText(value.methodology?.estimatesCaveat) &&
    isNhsUrl(value.source?.pressNoticeUrl) &&
    isNhsUrl(value.source?.timeseriesUrl)
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateOnlyUtc(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

function changeSentence(percent: number, pathways: number) {
  if (percent === 0 || pathways === 0) {
    return "was unchanged from a year earlier";
  }
  return `${percent < 0 ? "fell" : "rose"} by ${Math.abs(percent).toFixed(
    1
  )}% (${formatNumber(Math.abs(pathways))} pathways) from a year earlier`;
}

function formatMissingTrusts(trusts: MissingTrust[]) {
  return new Intl.ListFormat("en-GB", {
    style: "long",
    type: "conjunction",
  }).format(trusts.map((trust) => `${trust.name} (${trust.code})`));
}

export default function NHSStats() {
  const metrics = useMetrics("nhsStats", FALLBACK);
  const data = metrics.data;
  const nowMs = useSyncExternalStore(
    subscribeToClock,
    getClientClockSnapshot,
    getServerClockSnapshot
  );
  const valid = nowMs > 0 && validPayload(data, nowMs);
  const specialties = valid ? (data.specialties as Specialty[]) : [];
  const missingTrusts = valid ? (data.missingTrusts as MissingTrust[]) : [];
  const missingTrustLabel =
    missingTrusts.length > 0 ? formatMissingTrusts(missingTrusts) : "";
  const annualChanges = valid
    ? [
        ["Waiting pathways", data.annualDelta.waitingPathwaysEstimate, "count"],
        ["Estimated unique patients", data.annualDelta.uniquePatientsEstimate, "count"],
        ["Within 18 weeks", data.annualDelta.within18WeeksPercent, "points"],
        ["Median wait", data.annualDelta.medianWaitWeeks, "weeks"],
        ["92nd percentile wait", data.annualDelta.percentile92WaitWeeks, "weeks"],
        ["Over 52 weeks", data.annualDelta.over52Weeks, "count"],
        ["Over 65 weeks", data.annualDelta.over65Weeks, "count"],
        ["Over 78 weeks", data.annualDelta.over78Weeks, "count"],
        ["Over 104 weeks", data.annualDelta.over104Weeks, "count"],
        ["New pathways", data.annualDelta.newPathways, "count"],
        ["Admitted completions", data.annualDelta.admittedCompleted, "count"],
        ["Other completions", data.annualDelta.nonAdmittedCompleted, "count"],
      ] as const
    : [];

  function formatAnnualDelta(value: number, unit: "count" | "points" | "weeks") {
    const sign = value > 0 ? "+" : "";
    if (unit === "count") return `${sign}${formatNumber(value)}`;
    return `${sign}${value.toFixed(1)} ${unit === "points" ? "percentage points" : "weeks"}`;
  }

  return (
    <div className="space-y-8">
      {valid ? (
        <>
          <section
            aria-labelledby="nhs-rtt-title"
            className="border-y border-foreground py-6"
          >
            <p className="text-sm font-semibold text-accent">
              Latest NHS England RTT publication
            </p>
            <h3
              id="nhs-rtt-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              {data.headline.waitingPathwaysDisplay} treatment pathways were
              waiting at the end of {data.headline.period}.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              The waiting list{" "}
              {changeSentence(
                data.headline.yearChangePercent,
                data.headline.yearChangePathways
              )}. NHS England estimates that the pathways represented around{" "}
              {(data.headline.uniquePatientsEstimate / 1_000_000).toFixed(1)}
              million unique patients.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {formatDate(data.headline.publicationDate)} · England ·
              consultant-led elective care. Some patients are waiting on more
              than one pathway.
            </p>
          </section>

          <section aria-labelledby="nhs-rtt-performance-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4
                id="nhs-rtt-performance-title"
                className="mt-1 text-2xl font-semibold"
              >
                Waiting-time performance in the same monthly release
              </h4>
            </div>
            <dl className="grid border-y border-black/20 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-black/15">
              <div className="p-4">
                <dt className="text-sm text-gray-600">Within 18 weeks</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums text-accent">
                  {data.headline.within18WeeksPercent.toFixed(1)}%
                </dd>
                <dd className="mt-1 text-xs text-gray-600">
                  NHS Constitution standard: {data.headline.standardPercent.toFixed(0)}%
                </dd>
              </div>
              <div className="border-t border-black/15 p-4 sm:border-l sm:border-t-0">
                <dt className="text-sm text-gray-600">Median wait</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {data.headline.medianWaitWeeks.toFixed(1)} weeks
                </dd>
                <dd className="mt-1 text-xs text-gray-600">
                  Half of incomplete pathways waited less, half longer.
                </dd>
              </div>
              <div className="border-t border-black/15 p-4 lg:border-l lg:border-t-0">
                <dt className="text-sm text-gray-600">92nd percentile wait</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {data.headline.percentile92WaitWeeks.toFixed(1)} weeks
                </dd>
                <dd className="mt-1 text-xs text-gray-600">
                  Eight in 100 pathways waited longer.
                </dd>
              </div>
              <div className="border-t border-black/15 p-4 sm:border-l lg:border-t-0">
                <dt className="text-sm text-gray-600">Over 52 weeks</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {formatNumber(data.headline.over52Weeks)}
                </dd>
                <dd className="mt-1 text-xs text-gray-600">
                  Including {formatNumber(data.headline.over104Weeks)} over 104
                  weeks.
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="nhs-rtt-flow-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">
                Activity in {data.headline.period}
              </p>
              <h4
                id="nhs-rtt-flow-title"
                className="mt-1 text-2xl font-semibold"
              >
                Pathways entering and completing RTT care
              </h4>
            </div>
            <dl className="grid border-y border-black/20 md:grid-cols-3 md:divide-x md:divide-black/15">
              <div className="p-4">
                <dt className="text-sm text-gray-600">New RTT pathways</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatNumber(data.headline.newPathways)}
                </dd>
              </div>
              <div className="border-t border-black/15 p-4 md:border-l md:border-t-0">
                <dt className="text-sm text-gray-600">
                  Completed with admitted treatment
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatNumber(data.headline.admittedCompleted)}
                </dd>
              </div>
              <div className="border-t border-black/15 p-4 md:border-l md:border-t-0">
                <dt className="text-sm text-gray-600">Completed in other ways</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatNumber(data.headline.nonAdmittedCompleted)}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="nhs-annual-change-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Annual delta</p>
              <h4 id="nhs-annual-change-title" className="mt-1 text-2xl font-semibold">
                Change from the same month one year earlier
              </h4>
            </div>
            <dl className="grid gap-px border border-black/20 bg-black/15 sm:grid-cols-2 lg:grid-cols-3">
              {annualChanges.map(([label, value, unit]) => (
                <div key={label} className="bg-white p-4">
                  <dt className="text-xs leading-5 text-gray-600">{label}</dt>
                  <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {formatAnnualDelta(value, unit)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <FinancialTimeSeriesChart
            title="RTT waiting list: ten-year direction"
            description="Incomplete consultant-led pathways and, where published, estimated unique patients. Gaps mean NHS England did not publish that measure for the period."
            data={data.history}
            series={[
              { key: "waitingPathwaysEstimate", label: "Waiting pathways", color: "#172234" },
              { key: "uniquePatientsEstimate", label: "Estimated unique patients", color: "#6b7280", dashed: true },
            ]}
            valueFormatter={formatNumber}
            axisFormatter={(value) => `${(value / 1_000_000).toFixed(1)}m`}
          />

          <FinancialTimeSeriesChart
            title="18-week performance"
            description="Share of incomplete pathways waiting no more than 18 weeks, compared with the 92% NHS Constitution standard. Pandemic-era service and reporting disruption is visible in 2020."
            data={data.history}
            series={[{ key: "within18WeeksPercent", label: "Within 18 weeks", color: "#b23a20" }]}
            valueFormatter={(value) => `${value.toFixed(1)}%`}
            referenceValue={92}
            referenceLabel="92% standard"
          />

          <FinancialTimeSeriesChart
            title="Typical and upper-end waits"
            description="Median and 92nd-percentile waits in weeks. These show the centre and the long end of the distribution; pandemic-era disruption is visible in 2020."
            data={data.history}
            series={[
              { key: "medianWaitWeeks", label: "Median wait", color: "#172234" },
              { key: "percentile92WaitWeeks", label: "92nd percentile", color: "#b23a20" },
            ]}
            valueFormatter={(value) => `${value.toFixed(1)} weeks`}
          />

          <FinancialTimeSeriesChart
            title="Very long waits"
            description="Published counts above 52, 65, 78 and 104 weeks. A gap is retained where a threshold was not yet reported."
            data={data.history}
            series={[
              { key: "over52Weeks", label: "Over 52 weeks", color: "#172234" },
              { key: "over65Weeks", label: "Over 65 weeks", color: "#596579" },
              { key: "over78Weeks", label: "Over 78 weeks", color: "#8a4b3a" },
              { key: "over104Weeks", label: "Over 104 weeks", color: "#b23a20" },
            ]}
            valueFormatter={formatNumber}
            axisFormatter={(value) => `${Math.round(value / 1_000)}k`}
          />

          <FinancialTimeSeriesChart
            title="RTT pathway activity"
            description="New pathways and completed admitted or non-admitted pathways in each month, including NHS England estimates where supplied."
            data={data.history}
            series={[
              { key: "newPathways", label: "New pathways", color: "#172234" },
              { key: "admittedCompleted", label: "Admitted completions", color: "#b23a20" },
              { key: "nonAdmittedCompleted", label: "Other completions", color: "#6b7280" },
            ]}
            valueFormatter={formatNumber}
            axisFormatter={(value) => `${(value / 1_000_000).toFixed(1)}m`}
          />

          <section aria-labelledby="nhs-specialties-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">
                Treatment functions
              </p>
              <h4
                id="nhs-specialties-title"
                className="mt-1 text-2xl font-semibold"
              >
                Largest published incomplete-pathway lists
              </h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                These rows use the same {data.headline.period} publication but
                exclude estimates for non-reporting trusts, unlike the national
                headline. NHS England&apos;s national overview workbook does not
                provide a comparable treatment-function history, so annual
                specialty changes are not inferred.
              </p>
            </div>
            <div className="grid gap-px border border-black/20 bg-black/20 md:grid-cols-2">
              {specialties.map((row) => (
                <article key={row.name} className="bg-white p-4 md:p-5">
                  <h5 className="font-semibold leading-snug">{row.name}</h5>
                  <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-black/10 pt-4">
                    <div>
                      <dt className="text-xs leading-4 text-gray-500">Incomplete pathways</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums">
                        {formatNumber(row.incompletePathways)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs leading-4 text-gray-500">Within 18 weeks</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums">
                        {row.within18WeeksPercent.toFixed(1)}%
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="nhs-why-title"
            className="border-l-4 border-foreground pl-4"
          >
            <h3 id="nhs-why-title" className="text-lg font-semibold">
              Why it matters
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              RTT measures the time from referral to the start of consultant-led
              elective treatment. The pathway count shows the scale of unfinished
              care; the 18-week share and long-wait thresholds show how long that
              care is taking.
            </p>
          </section>

          <details className="border-y border-black/20 py-4">
            <summary className="cursor-pointer text-lg font-semibold">
              Explain these numbers
            </summary>
            <div className="mt-4 grid gap-5 text-sm leading-6 text-gray-700 md:grid-cols-2">
              <div>
                <strong className="text-foreground">Measure</strong>
                <p>
                  {data.methodology.measure}. {data.methodology.peopleCaveat}
                </p>
              </div>
              <div>
                <strong className="text-foreground">Missing submissions</strong>
                <p>
                  {missingTrusts.length > 0
                    ? `${missingTrustLabel} did not submit. ${data.methodology.estimatesCaveat}`
                    : data.methodology.estimatesCaveat}
                </p>
              </div>
              <div>
                <strong className="text-foreground">Revision status</strong>
                <p>{data.methodology.revisionNote}</p>
              </div>
              <div>
                <strong className="text-foreground">Official source</strong>
                <p>
                  <a
                    className="font-semibold underline underline-offset-4"
                    href={data.source.pressNoticeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    NHS England RTT statistical press notice
                  </a>
                </p>
              </div>
            </div>
          </details>
        </>
      ) : (
        <section
          role="status"
          className="border border-black/20 bg-white p-6"
        >
          <h3 className="text-xl font-semibold">
            Current NHS RTT evidence unavailable
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            public-data.org could not verify a complete current NHS England
            referral-to-treatment publication. It will not show an older
            waiting-list snapshot or unrelated embedded health measures as
            current.
          </p>
        </section>
      )}

      <section
        aria-labelledby="nhs-withdrawn-title"
        className="border-l-4 border-foreground pl-4"
      >
        <h3 id="nhs-withdrawn-title" className="text-lg font-semibold">
          Unaligned health measures withdrawn
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
          A&amp;E performance, GP waiting time, NHS workforce and life expectancy
          came from different publications, periods and geographies. They remain
          unavailable until each has a verified primary source and visible
          observation date.
        </p>
      </section>

      <MetricsStatus section="nhsStats" status={metrics} />
    </div>
  );
}
