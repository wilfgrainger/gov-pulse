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

export function measureForDisplay(catalog: unknown, id: string, now = new Date()) {
  const selected = selectMeasure(catalog as never, id, now);
  if (selected) return selected;
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return null;
  const measures = (catalog as { measures?: unknown }).measures;
  if (!measures || typeof measures !== "object" || Array.isArray(measures)) return null;
  const raw = (measures as Record<string, unknown>)[id];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    const record = validateMeasureRecord(raw);
    if (record.availability !== "current" || !record.validUntil || Date.parse(record.validUntil) > now.getTime()) return null;
    return validateMeasureRecord({ ...record, availability: "historical" });
  } catch {
    return null;
  }
}

export function availableMeasures(catalog: unknown, now = new Date()) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return [];
  const measures = (catalog as { measures?: unknown }).measures;
  if (!measures || typeof measures !== "object" || Array.isArray(measures)) return [];
  return Object.keys(measures)
    .sort()
    .flatMap((id) => {
      const measure = selectMeasure(catalog as never, id, now);
      return measure ? [measure] : [];
    });
}
