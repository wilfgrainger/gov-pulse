import { filterCurrentSnapshot } from "@/worker/publication-currentness";
import {
  isCompatibleMetricsSnapshot,
  type MetricsSnapshot,
} from "./metricsSnapshot";

export type MeasureDefinition = {
  id: string;
  label: string;
  topic: string;
  section: string;
  route: string;
  geography: string;
  unit: string;
  valuePath: string;
  periodPath: string;
  publicationPath: string;
  historyPath: string;
  historyValue: string;
  note: string;
};
export type Measure = MeasureDefinition & {
  value: number | null;
  period: string | null;
  publishedAt: string | null;
  sourceUrl: string | null;
  history: { date: number; period: string; value: number }[];
};
const base = (
  section: string,
  route: string,
  topic: string,
  geography = "United Kingdom",
) => ({ section, route: `/section/${route}/`, topic, geography });
const headline = {
  periodPath: "headline.period",
  publicationPath: "headline.releaseDate",
  historyPath: "history",
};
const labour = {
  ...base("employmentStats", "employment", "Jobs"),
  ...headline,
  historyPath: "history.labourForce",
};
const nhs = {
  ...base("nhsStats", "nhs", "Health", "England"),
  ...headline,
  publicationPath: "headline.publicationDate",
};

export const MEASURES: MeasureDefinition[] = [
  ...[
    ["monthlyGrowth", "GDP: monthly growth", "%"],
    ["threeMonthGrowth", "GDP: three-month growth", "%"],
    ["annualGrowth", "GDP: annual growth", "%"],
  ].map(([key, label, unit]) => ({
    ...base("gdpTracker", "gdp", "Economy"),
    ...headline,
    id: `gdp-${key}`,
    label,
    unit,
    valuePath: `headline.${key}`,
    historyValue: key,
    note: "Real GDP, seasonally adjusted. Early estimates can be revised.",
  })),
  ...[
    ["inflation", "CPI inflation"],
    ["bankRate", "Bank Rate"],
    ["unemployment", "Unemployment rate"],
  ].map(([key, label]) => ({
    ...base("sentimentPulse", "economy", "Economy"),
    id: key,
    label,
    unit: "%",
    valuePath: `series.${key}.value`,
    periodPath: `series.${key}.period`,
    publicationPath: `series.${key}.publishedAt`,
    historyPath: `series.${key}.history`,
    historyValue: "value",
    note:
      key === "bankRate"
        ? "Event-dated policy rate. History contains rate decisions, not monthly observations."
        : key === "inflation"
          ? "Annual CPI rate. Lower inflation does not mean prices have fallen."
          : "Rolling three-month Labour Force Survey estimate; subject to sampling uncertainty.",
  })),
  ...[
    ["employmentRate", "Employment rate"],
    ["inactivityRate", "Economic inactivity rate"],
  ].map(([key, label]) => ({
    ...labour,
    id: key,
    label,
    unit: "%",
    valuePath: `headline.${key}`,
    historyValue: key,
    note: "People aged 16–64. Rolling three-month survey estimate; revisions and sampling uncertainty apply.",
  })),
  {
    ...labour,
    id: "vacancies",
    label: "Job vacancies",
    unit: "vacancies",
    valuePath: "headline.vacancies",
    periodPath: "headline.vacanciesPeriod",
    historyPath: "history.vacancies",
    historyValue: "vacancies",
    note: "Separate employer survey; its rolling period differs from the labour-force rates.",
  },
  {
    ...base("nationalDebt", "national-debt", "Public finances"),
    id: "debt",
    label: "Public sector net debt",
    unit: "£bn",
    valuePath: "baseDebt",
    periodPath: "observationPeriod",
    publicationPath: "publicationDate",
    historyPath: "history",
    historyValue: "debtBillion",
    note: "Excludes public sector banks. A stock at a stated date, not cumulative spending.",
  },
  {
    ...base("nationalDebt", "national-debt", "Public finances"),
    id: "debt-ratio",
    label: "Debt as a share of GDP",
    unit: "%",
    valuePath: "debtToGdp",
    periodPath: "observationPeriod",
    publicationPath: "publicationDate",
    historyPath: "history",
    historyValue: "debtToGdp",
    note: "Public sector net debt excluding public sector banks, divided by GDP.",
  },
  {
    ...base("taxRevenue", "tax", "Public finances"),
    ...headline,
    id: "receipts",
    label: "Central government receipts",
    unit: "£bn",
    valuePath: "headline.receiptsBillion",
    historyValue: "receiptsBillion",
    note: "Monthly nominal receipts on the ONS accounting basis. Not all receipts are taxes. Compare the same month across years to avoid seasonality.",
  },
  ...[
    ["immigration", "Long-term immigration"],
    ["emigration", "Long-term emigration"],
    ["netMigration", "Net migration"],
  ].map(([key, label]) => ({
    ...base("migrationStats", "migration", "Population"),
    ...headline,
    id: key,
    label,
    unit: "people",
    valuePath: `headline.${key}`,
    historyValue: key,
    note: "ONS long-term migration estimates. Provisional and subject to revision; not a count of small-boat arrivals.",
  })),
  ...[
    ["waitingPathwaysEstimate", "NHS waiting list", "pathways"],
    ["uniquePatientsEstimate", "People on the waiting list", "people"],
    ["within18WeeksPercent", "Waiting within 18 weeks", "%"],
    ["medianWaitWeeks", "Median waiting time", "weeks"],
    ["percentile92WaitWeeks", "92nd-percentile waiting time", "weeks"],
    ["over52Weeks", "Waiting over one year", "pathways"],
    ["over65Weeks", "Waiting over 65 weeks", "pathways"],
    ["over78Weeks", "Waiting over 78 weeks", "pathways"],
    ["over104Weeks", "Waiting over two years", "pathways"],
    ["newPathways", "New treatment pathways", "pathways"],
    ["admittedCompleted", "Completed admitted pathways", "pathways"],
    ["nonAdmittedCompleted", "Completed non-admitted pathways", "pathways"],
  ].map(([key, label, unit]) => ({
    ...nhs,
    id: key,
    label,
    unit,
    valuePath: `headline.${key}`,
    historyValue: key,
    note: "NHS England referral-to-treatment statistics. Pathways are not unique patients; waiting-time thresholds overlap and must not be summed.",
  })),
];

function at(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (obj, key) =>
        obj && typeof obj === "object"
          ? (obj as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;
function sourceLink(
  data: unknown,
  definition: MeasureDefinition,
  snapshot: MetricsSnapshot,
): string | null {
  const seriesKey = definition.valuePath.startsWith("series.")
    ? definition.valuePath.split(".")[1]
    : null;
  const candidates = [
    definition.id === "debt" ? at(data, "source.debtUrl") : null,
    definition.id === "debt-ratio" ? at(data, "source.debtToGdpUrl") : null,
    seriesKey ? at(data, `series.${seriesKey}.sourceUrl`) : null,
    at(data, "source.bulletinUrl"),
    at(data, "source.pressNoticeUrl"),
    at(data, "source.publicationUrl"),
    at(snapshot.meta.sources[definition.section], definition.id === "debt-ratio" ? "provenance.upstreams.1.url" : "provenance.upstreams.0.url"),
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (
        url.protocol === "https:" &&
        [
          "www.ons.gov.uk",
          "www.bankofengland.co.uk",
          "www.england.nhs.uk",
        ].includes(url.hostname)
      )
        return url.href;
    } catch {
      /* No unsupported links. */
    }
  }
  return null;
}
export function exploreMeasures(raw: unknown, now = new Date()): Measure[] {
  const snapshot = isCompatibleMetricsSnapshot(raw)
    ? (filterCurrentSnapshot(raw, now) as MetricsSnapshot | null)
    : null;
  return MEASURES.map((definition) => {
    const data = snapshot?.[definition.section];
    const rawValue = at(data, definition.valuePath);
    const period = text(at(data, definition.periodPath));
    const publishedAt = text(at(data, definition.publicationPath));
    const sourceUrl = snapshot ? sourceLink(data, definition, snapshot) : null;
    const valid =
      finite(rawValue) &&
      period &&
      publishedAt &&
      Number.isFinite(Date.parse(publishedAt)) &&
      Date.parse(publishedAt) <= now.getTime() &&
      sourceUrl;
    const rawHistory = valid ? at(data, definition.historyPath) : null;
    const history = Array.isArray(rawHistory)
      ? rawHistory
          .flatMap((point) => {
            const dateValue = at(point, "observedAt");
            const date =
              typeof dateValue === "number"
                ? dateValue
                : typeof dateValue === "string"
                  ? Date.parse(dateValue)
                  : NaN;
            const value = at(point, definition.historyValue);
            return Number.isFinite(date) &&
              date <= now.getTime() &&
              finite(value)
              ? [
                  {
                    date,
                    period:
                      text(at(point, "period")) ??
                      new Date(date).toISOString().slice(0, 10),
                    value,
                  },
                ]
              : [];
          })
          .sort((a, b) => a.date - b.date)
      : [];
    return {
      ...definition,
      value: valid
        ? definition.id === "debt"
          ? rawValue / 1e9
          : rawValue
        : null,
      period: valid ? period : null,
      publishedAt: valid ? publishedAt : null,
      sourceUrl: valid ? sourceUrl : null,
      history,
    };
  });
}
export function formatMeasure(value: number, unit: string): string {
  const digits = ["%", "£bn", "weeks", "percentage points"].includes(unit)
    ? 2
    : 0;
  const formatted = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
  }).format(value);
  return unit === "£bn"
    ? `£${formatted}bn`
    : unit === "%"
      ? `${formatted}%`
      : `${formatted} ${unit}`;
}
export function comparePoints(points: Measure["history"], unit: string) {
  if (points.length < 2) return null;
  const first = points[0],
    last = points.at(-1)!;
  const delta = Number((last.value - first.value).toFixed(4));
  return {
    first,
    last,
    delta,
    unit: unit === "%" ? "percentage points" : unit,
    percent: first.value > 0 ? (delta / first.value) * 100 : null,
  };
}
export function measuresCsv(measures: Measure[]): string {
  // Quote every cell and neutralise spreadsheet formula prefixes.
  const cell = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  const rows = [
    [
      "Measure",
      "Value",
      "Unit",
      "Period",
      "Published",
      "Geography",
      "Source",
      "Caveat",
    ],
    ...measures.map((m) => [
      m.label,
      m.value ?? "",
      m.unit,
      m.period,
      m.publishedAt,
      m.geography,
      m.sourceUrl,
      m.note,
    ]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
