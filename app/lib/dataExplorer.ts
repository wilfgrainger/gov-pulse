import { filterCurrentSnapshot } from "@/worker/publication-currentness";
import {
  isCompatibleMetricsSnapshot,
  type MetricsSnapshot,
} from "./metricsSnapshot";
import { hasNewerRelatedRelease } from "./nationalEvidence";
import { selectMeasure, type MeasureCatalog } from "./measureCatalog";
import { MEASURES, type Measure, type MeasureDefinition } from "./measureDefinitions";

export { MEASURES } from "./measureDefinitions";
export type { Measure, MeasureDefinition } from "./measureDefinitions";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function at(value: unknown, path: string | null): unknown {
  if (!path) return undefined;
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
  const meta = (raw as MetricsSnapshot | null)?.meta;
  const suppliedCatalog = meta?.measureCatalog;
  if (meta && Object.hasOwn(meta, "measureCatalog")) {
    return MEASURES.map((definition) => {
      const measure = selectMeasure(suppliedCatalog as MeasureCatalog, definition.id, now);
      const source = record(meta.sources[definition.section]);
      const section = definition.section === "employmentStats" ? "employmentStats"
        : definition.section === "nationalDebt" ? "nationalDebt" : null;
      const updateDue = measure?.availability === "historical" || Boolean(
        measure?.availability === "current" && source && (source.status !== "ok" || source.cacheState !== "fresh")
      ) || Boolean(
        measure?.availability === "current" && snapshot && section && hasNewerRelatedRelease(snapshot, section)
      );
      return {
        ...definition,
        value: measure?.availability === "current" ? measure.value : null,
        period: readablePeriod(measure?.observationPeriod.label ?? null),
        publishedAt: measure?.publishedAt ?? null,
        sourceUrl: measure?.sourceUrl ?? null,
        geography: measure?.geography.label ?? definition.geography,
        history: measure?.points.map((point) => ({
          date: Date.parse(`${point.observedAt}T00:00:00Z`),
          period: point.period,
          value: point.value ?? Number.NaN,
        })).filter((point) => Number.isFinite(point.value)) ?? [],
        updateDue,
      };
    });
  }
  return MEASURES.map((definition) => {
    const data = snapshot?.[definition.section];
    const sourceHistory = at(data, definition.historyPath);
    const rawValue = definition.valueFromLatestHistory && Array.isArray(sourceHistory)
      ? at(sourceHistory.at(-1), definition.historyValue)
      : at(data, definition.valuePath);
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
