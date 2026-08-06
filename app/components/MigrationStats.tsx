"use client";

import CoreEvidenceExplanation from "@/app/components/CoreEvidenceExplanation";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";
import MetricsStatus from "@/app/components/MetricsStatus";
import { useMetrics } from "@/app/lib/useMetrics";

type MigrationHeadline = {
  period: string;
  observedAt: number;
  releaseDate: string;
  netMigration: number;
  immigration: number;
  emigration: number;
  previousPeriod: string;
  previousNetMigration: number;
  changePercent: number;
  provisional: boolean;
};

type MigrationComparison = {
  period: string;
  netMigration: number;
};

type MigrationHistory = {
  period: string;
  observedAt: number;
  immigration: number;
  emigration: number;
  netMigration: number;
};

type MigrationPayload = {
  headline: MigrationHeadline;
  comparison: MigrationComparison[];
  history: MigrationHistory[];
  annualDelta: {
    immigration: number;
    emigration: number;
    netMigration: number;
  };
  methodology: {
    definition: string;
    status: string;
    revisionNote: string;
  };
  source: {
    edition: string;
    bulletinUrl: string;
    datasetUrl: string;
    historyUrl: string;
  };
};

const FALLBACK: MigrationPayload = {
  headline: {
    period: "",
    observedAt: 0,
    releaseDate: "",
    netMigration: 0,
    immigration: 0,
    emigration: 0,
    previousPeriod: "",
    previousNetMigration: 0,
    changePercent: 0,
    provisional: true,
  },
  comparison: [],
  history: [],
  annualDelta: {
    immigration: 0,
    emigration: 0,
    netMigration: 0,
  },
  methodology: {
    definition: "",
    status: "",
    revisionNote: "",
  },
  source: {
    edition: "",
    bulletinUrl: "",
    datasetUrl: "",
    historyUrl: "",
  },
};

function formatPeople(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
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

function validHeadline(value: unknown): value is MigrationHeadline {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<MigrationHeadline>;
  const releaseDate = nonEmptyString(candidate.releaseDate)
    ? parseDateOnlyUtc(candidate.releaseDate)
    : new Date(Number.NaN);

  return (
    nonEmptyString(candidate.period) &&
    nonEmptyString(candidate.previousPeriod) &&
    typeof candidate.observedAt === "number" &&
    Number.isFinite(candidate.observedAt) &&
    typeof candidate.immigration === "number" &&
    Number.isFinite(candidate.immigration) &&
    typeof candidate.emigration === "number" &&
    Number.isFinite(candidate.emigration) &&
    typeof candidate.netMigration === "number" &&
    Number.isFinite(candidate.netMigration) &&
    typeof candidate.previousNetMigration === "number" &&
    Number.isFinite(candidate.previousNetMigration) &&
    typeof candidate.changePercent === "number" &&
    Number.isFinite(candidate.changePercent) &&
    !Number.isNaN(releaseDate.getTime()) &&
    typeof candidate.provisional === "boolean" &&
    candidate.immigration - candidate.emigration === candidate.netMigration
  );
}

function validComparison(value: unknown): value is MigrationComparison {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<MigrationComparison>;
  return (
    nonEmptyString(candidate.period) &&
    typeof candidate.netMigration === "number" &&
    Number.isFinite(candidate.netMigration)
  );
}

function validPayload(value: unknown): value is MigrationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<MigrationPayload>;
  return (
    validHeadline(candidate.headline) &&
    Array.isArray(candidate.comparison) &&
    candidate.comparison.length >= 2 &&
    candidate.comparison.every(validComparison) &&
    Array.isArray(candidate.history) &&
    candidate.history.length >= 2 &&
    candidate.history.every(
      (point) =>
        nonEmptyString(point?.period) &&
        typeof point?.observedAt === "number" &&
        Number.isFinite(point.observedAt) &&
        typeof point?.immigration === "number" &&
        typeof point?.emigration === "number" &&
        typeof point?.netMigration === "number" &&
        Math.abs(point.immigration - point.emigration - point.netMigration) <= 1_000
    ) &&
    typeof candidate.annualDelta?.immigration === "number" &&
    typeof candidate.annualDelta?.emigration === "number" &&
    typeof candidate.annualDelta?.netMigration === "number" &&
    nonEmptyString(candidate.methodology?.definition) &&
    nonEmptyString(candidate.methodology?.status) &&
    nonEmptyString(candidate.methodology?.revisionNote) &&
    nonEmptyString(candidate.source?.edition) &&
    candidate.source?.bulletinUrl?.startsWith("https://www.ons.gov.uk/") === true &&
    candidate.source?.datasetUrl?.startsWith("https://www.ons.gov.uk/") === true &&
    candidate.source?.historyUrl?.startsWith("https://www.ons.gov.uk/") === true
  );
}

function displayPeriod(period: string) {
  return period.replace(/^YE\s+/i, "the year ending ");
}

export default function MigrationStats() {
  const metrics = useMetrics("migrationStats", FALLBACK);
  const payload = metrics.data as unknown;
  const valid =
    metrics.isLive && metrics.cacheState === "fresh" && validPayload(payload);
  const headline = valid ? payload.headline : null;
  const comparison = valid ? payload.comparison : [];
  const change = headline ? headline.changePercent : 0;
  const direction = change >= 0 ? "rose" : "fell";
  const comparisonDirection = change >= 0 ? "higher" : "lower";

  return (
    <div className="space-y-8">
      {valid && headline ? (
        <>
          <section aria-labelledby="migration-briefing-title" className="border-y border-foreground py-6">
            <p className="text-sm font-semibold text-accent">Latest ONS estimate</p>
            <h3
              id="migration-briefing-title"
              className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl"
            >
              Net migration {direction} to {formatPeople(headline.netMigration)} in {displayPeriod(headline.period)}.
            </h3>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              The provisional estimate is {Math.abs(change)}% {comparisonDirection} than the updated {headline.previousPeriod} estimate of {formatPeople(headline.previousNetMigration)}.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Published {formatReleaseDate(headline.releaseDate)}. These figures are official statistics in development and remain subject to revision.
            </p>
          </section>

          <section aria-labelledby="migration-components-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">Latest observation</p>
              <h4 id="migration-components-title" className="mt-1 text-2xl font-semibold">
                Immigration minus emigration equals net migration
              </h4>
            </div>
            <dl className="grid border-y border-black/20 md:grid-cols-3 md:divide-x md:divide-black/15">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">Long-term immigration</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{formatPeople(headline.immigration)}</dd>
                <dd className="mt-2 text-xs text-gray-600">Annual change {payload.annualDelta.immigration > 0 ? "+" : ""}{formatPeople(payload.annualDelta.immigration)}</dd>
              </div>
              <div className="border-y border-black/15 p-4 md:border-y-0 md:p-5">
                <dt className="text-sm text-gray-600">Long-term emigration</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{formatPeople(headline.emigration)}</dd>
                <dd className="mt-2 text-xs text-gray-600">Annual change {payload.annualDelta.emigration > 0 ? "+" : ""}{formatPeople(payload.annualDelta.emigration)}</dd>
              </div>
              <div className="p-4 md:p-5">
                <dt className="text-sm text-gray-600">Net migration</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums text-accent">{formatPeople(headline.netMigration)}</dd>
                <dd className="mt-2 text-xs text-gray-600">Annual change {payload.annualDelta.netMigration > 0 ? "+" : ""}{formatPeople(payload.annualDelta.netMigration)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="migration-change-title">
            <div className="mb-4 border-b border-black/15 pb-3">
              <p className="text-sm font-semibold text-accent">What changed?</p>
              <h4 id="migration-change-title" className="mt-1 text-2xl font-semibold">
                Year-on-year change
              </h4>
            </div>
            <p className="text-3xl font-semibold tabular-nums">
              {payload.annualDelta.netMigration > 0 ? "+" : ""}{formatPeople(payload.annualDelta.netMigration)}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {comparison.at(-2)?.period} to {comparison.at(-1)?.period}
            </p>
          </section>

          <FinancialTimeSeriesChart
            title="Long-term migration: ten annual observations"
            description="December year-ending estimates from the latest ONS revised time series. Components are independently rounded, so older arithmetic can differ from published net migration by up to 1,000."
            data={payload.history}
            series={[
              { key: "immigration", label: "Immigration", color: "#172234" },
              { key: "emigration", label: "Emigration", color: "#6b7280" },
              { key: "netMigration", label: "Net migration", color: "#b23a20" },
            ]}
            valueFormatter={formatPeople}
            axisFormatter={(value) => `${Math.round(value / 1_000)}k`}
            referenceValue={0}
          />

          <CoreEvidenceExplanation
            idPrefix="migration"
            why={
              <p>
                Long-term migration changes the size and composition of the resident population and informs planning for housing, public services and the labour market. This estimate does not by itself explain those impacts.
              </p>
            }
            definition={
              <p>
                {payload.methodology.definition}. Net migration is long-term immigration minus long-term emigration.
              </p>
            }
            unit="People"
            geography="United Kingdom"
            interpretation={
              <p>
                The year-on-year comparison uses revised estimates on the same long-term migration definition. A lower estimate means the balance between immigration and emigration narrowed.
              </p>
            }
            caveat={<p>{payload.methodology.revisionNote}</p>}
            sourceLabel="ONS long-term international migration bulletin"
            sourceUrl={payload.source.bulletinUrl}
            sourceDate={`Published ${formatReleaseDate(headline.releaseDate)} · observation period ${headline.period}`}
          />
        </>
      ) : (
        <section role="status" className="border border-black/20 bg-white p-6">
          <h3 className="text-xl font-semibold">Migration estimate unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            public-data.org could not verify one complete, reconciled current ONS migration release, so no embedded or older headline estimate is shown.
          </p>
        </section>
      )}

      <section aria-labelledby="migration-withdrawn-title" className="border-l-4 border-foreground pl-4">
        <h3 id="migration-withdrawn-title" className="text-lg font-semibold">
          Visa and nationality tables withdrawn
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
          The previous page mixed Home Office visa grants with ONS long-term migration estimates and labelled nationality counts as net migration without aligning their definitions, periods and denominators. Those tables remain unavailable until each measure can be reproduced separately.
        </p>
      </section>

      <MetricsStatus section="migrationStats" status={metrics} />
    </div>
  );
}
