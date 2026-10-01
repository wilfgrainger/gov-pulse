import { filterCurrentSnapshot } from "@/worker/publication-currentness";
import {
  isCompatibleMetricsSnapshot,
  type MetricsSnapshot,
} from "./metricsSnapshot";
import { hasNewerRelatedRelease } from "./nationalEvidence";

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
  updateDue: boolean;
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
  {
    ...base("gdpTracker", "gdp", "Economy"),
    ...headline,
    id: "gdp-threeMonthGrowth",
    label: "GDP: three-month growth",
    unit: "%",
    valuePath: "headline.threeMonthGrowth",
    historyValue: "threeMonthGrowth",
    note: "Real GDP across the latest three months. An early estimate that can be revised.",
  },
  {
    ...base("sentimentPulse", "economy", "Economy"),
    id: "inflation",
    label: "CPI inflation",
    unit: "%",
    valuePath: "series.inflation.value",
    periodPath: "series.inflation.period",
    publicationPath: "series.inflation.publishedAt",
    historyPath: "series.inflation.history",
    historyValue: "value",
    note: "Annual CPI rate. Lower inflation means prices rise more slowly, not that they have fallen.",
  },
  {
    ...labour,
    id: "unemployment",
    label: "Unemployment rate",
    unit: "%",
    valuePath: "headline.unemploymentRate",
    historyValue: "unemploymentRate",
    note: "A rolling three-month Labour Force Survey estimate; subject to sampling uncertainty and revision.",
  },
  {
    ...nhs,
    id: "waitingPathwaysEstimate",
    label: "NHS waiting list",
    unit: "pathways",
    valuePath: "headline.waitingPathwaysEstimate",
    historyValue: "waitingPathwaysEstimate",
    note: "NHS England referral-to-treatment pathways, not unique people. A person can wait on more than one pathway.",
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
  {
    ...base("migrationStats", "migration", "Population"),
    ...headline,
    id: "netMigration",
    label: "Net migration",
    unit: "people",
    valuePath: "headline.netMigration",
    historyValue: "netMigration",
    note: "ONS long-term migration estimates. Provisional and subject to revision; not a count of small-boat arrivals.",
  },
  {
    ...base("realWages", "real-wages", "Economy", "Great Britain"),
    ...headline,
    id: "regularPayRealGrowth",
    label: "Real wages: regular pay growth",
    unit: "%",
    valuePath: "headline.regularPayRealGrowthPercent",
    historyValue: "regularPayRealGrowthPercent",
    note: "ONS's own real-terms (CPIH-adjusted) regular pay growth figure, published directly in the average weekly earnings bulletin. Provisional and subject to revision.",
  },
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
function readablePeriod(value: string | null): string | null {
  const match = value?.match(/^(\d{4})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i);
  if (!match) return value;
  const month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(match[2].toUpperCase());
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), month, 1)));
}
function sourceLink(
  data: unknown,
  definition: MeasureDefinition,
  snapshot: MetricsSnapshot,
): string | null {
  const seriesKey = definition.valuePath.startsWith("series.")
    ? definition.valuePath.split(".")[1]
    : null;
  const candidates = [
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
    const period = readablePeriod(text(at(data, definition.periodPath)));
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
      value: valid ? rawValue : null,
      period: valid ? period : null,
      publishedAt: valid ? publishedAt : null,
      sourceUrl: valid ? sourceUrl : null,
      history,
      updateDue: Boolean(valid && snapshot && (
        (definition.section === "employmentStats" || definition.section === "nationalDebt") &&
        hasNewerRelatedRelease(snapshot, definition.section)
      )),
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
