import {
  compareEligibility,
  selectMeasure,
  validateMeasureRecord,
} from "@/contracts/measure-record.js";

export type {
  Availability,
  EvidenceClass,
  MeasureCatalog,
  MeasurePoint,
  MeasureRecord,
  ValueStatus,
} from "@/contracts/measure-record.js";

export { compareEligibility, selectMeasure, validateMeasureRecord };

const MONTH_CODES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const monthName = (code: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, MONTH_CODES.indexOf(code.toUpperCase()), 1)));

/** ONS period codes ("2026 AUG", "2026 JUN-AUG") as reader text; anything else is returned unchanged. */
export function readablePeriod(value: string | null): string | null {
  const match = value?.match(/^(\d{4})\s+([A-Z]{3})(?:-([A-Z]{3}))?$/i);
  if (!match || [match[2], match[3]].some((code) => code && !MONTH_CODES.includes(code.toUpperCase()))) return value;
  return match[3] ? `${monthName(match[2])} to ${monthName(match[3])} ${match[1]}` : `${monthName(match[2])} ${match[1]}`;
}

// Display copy only: the stored catalog keeps the publisher's period codes.
function readable<T extends { observationPeriod: { label: string }; points: { period: string }[] } | null>(measure: T): T {
  if (!measure) return measure;
  return {
    ...measure,
    observationPeriod: { ...measure.observationPeriod, label: readablePeriod(measure.observationPeriod.label) ?? measure.observationPeriod.label },
    points: measure.points.map((point) => ({ ...point, period: readablePeriod(point.period) ?? point.period })),
  };
}

export function measureForDisplay(catalog: unknown, id: string, now = new Date()) {
  return readable(selectMeasure(catalog as never, id, now));
}

export function availableMeasures(catalog: unknown, now = new Date()) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return [];
  const measures = (catalog as { measures?: unknown }).measures;
  if (!measures || typeof measures !== "object" || Array.isArray(measures)) return [];
  return Object.keys(measures)
    .sort()
    .flatMap((id) => {
      const measure = readable(selectMeasure(catalog as never, id, now));
      return measure ? [measure] : [];
    });
}
