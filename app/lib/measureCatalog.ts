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
  return selectMeasure(catalog as never, id, now);
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
