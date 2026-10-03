const EVIDENCE_CLASSES = new Set([
  "official-statistics",
  "official-policy",
  "administrative-data",
  "polling",
  "market-signal",
]);
const AVAILABILITY = new Set(["current", "historical", "unavailable"]);
const VALUE_STATUS = new Set(["observed", "estimate", "projection"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_INSTANT = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requiredText(value, label, maximum = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`${label} must be a non-empty string of at most ${maximum} characters`);
  }
  return value.trim();
}

function date(value, label) {
  const normalized = requiredText(value, label, 40);
  if (!ISO_DATE.test(normalized)) throw new Error(`${label} must be an ISO calendar date`);
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${label} must be a valid calendar date`);
  }
  return normalized;
}

function instant(value, label) {
  const normalized = requiredText(value, label, 40);
  const match = normalized.match(UTC_INSTANT);
  if (!match || !Number.isFinite(Date.parse(normalized))) {
    throw new Error(`${label} must be an ISO 8601 UTC timestamp`);
  }
  date(normalized.slice(0, 10), `${label} date`);
  const fraction = normalized.match(/\.(\d{1,3})Z$/)?.[1] ?? "";
  const canonical = normalized.replace(/(?:\.\d{1,3})?Z$/, `.${fraction.padEnd(3, "0")}Z`);
  if (new Date(normalized).toISOString() !== canonical) throw new Error(`${label} must be a valid UTC timestamp`);
  return new Date(normalized).toISOString();
}

function finiteOrNull(value, label) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite or null`);
  return value;
}

function normalizePoint(value, index) {
  const point = record(value, `Observation ${index + 1}`);
  const normalizedValue = finiteOrNull(point.value, `Observation ${index + 1} value`);
  const valueStatus = requiredText(point.valueStatus, `Observation ${index + 1} value status`, 20);
  if (!VALUE_STATUS.has(valueStatus)) throw new Error(`Observation ${index + 1} value status is not supported`);
  return {
    period: requiredText(point.period, `Observation ${index + 1} period`, 160),
    observedAt: date(point.observedAt, `Observation ${index + 1} date`),
    value: normalizedValue,
    valueStatus,
    revisionId: requiredText(point.revisionId, `Observation ${index + 1} revision`, 160),
  };
}

function validateMeasureRecord(input) {
  const value = record(input, "Measure record");
  const evidenceClass = requiredText(value.evidenceClass, "Evidence class", 40);
  if (!EVIDENCE_CLASSES.has(evidenceClass)) throw new Error("Evidence class is not supported");
  const availability = requiredText(value.availability, "Availability", 20);
  if (!AVAILABILITY.has(availability)) throw new Error("Availability is not supported");
  const geography = record(value.geography, "Geography");
  const observationPeriod = record(value.observationPeriod, "Observation period");
  const start = date(observationPeriod.start, "Observation period start");
  const end = date(observationPeriod.end, "Observation period end");
  if (start > end) throw new Error("Observation period starts after it ends");
  const publishedAt = instant(value.publishedAt, "Publication time");
  const fetchedAt = instant(value.fetchedAt, "Fetch time");
  if (Date.parse(publishedAt) > Date.parse(fetchedAt)) throw new Error("Publication time cannot follow fetch time");
  const validUntil = value.validUntil === null ? null : instant(value.validUntil, "Validity deadline");
  const normalizedValue = finiteOrNull(value.value, "Measure value");
  if (availability === "current" && (normalizedValue === null || validUntil === null || Date.parse(validUntil) <= Date.parse(fetchedAt))) {
    throw new Error("Current measures require a value and a source-owned deadline after retrieval");
  }
  if (availability === "unavailable" && normalizedValue !== null) {
    throw new Error("Unavailable measures cannot publish a current value");
  }
  const points = Array.isArray(value.points) ? value.points.map(normalizePoint) : null;
  if (!points) throw new Error("Measure observations must be an array");
  for (let index = 1; index < points.length; index += 1) {
    if (points[index - 1].observedAt >= points[index].observedAt) {
      throw new Error("Measure observations must be strictly chronological");
    }
  }
  const latestNumericObservation = [...points].reverse().find((point) => point.value !== null);
  if (availability === "current" && points.length && latestNumericObservation?.value !== normalizedValue) {
    throw new Error("Current value must match the latest observation");
  }
  const caveats = Array.isArray(value.caveats)
    ? value.caveats.map((caveat, index) => requiredText(caveat, `Caveat ${index + 1}`, 500))
    : null;
  if (!caveats) throw new Error("Caveats must be an array");
  const note = value.note === undefined ? undefined : requiredText(value.note, "Measure note", 1000);
  const publisher = value.publisher === undefined ? undefined : requiredText(value.publisher, "Publisher", 200);
  return {
    id: requiredText(value.id, "Measure id", 160),
    label: requiredText(value.label, "Measure label", 200),
    evidenceClass,
    comparisonKey: requiredText(value.comparisonKey, "Comparison key", 200),
    cadence: requiredText(value.cadence, "Cadence", 80),
    unit: requiredText(value.unit, "Unit", 80),
    basis: requiredText(value.basis, "Measure basis", 300),
    ...(note ? { note } : {}),
    ...(publisher ? { publisher } : {}),
    geography: {
      code: requiredText(geography.code, "Geography code", 30),
      label: requiredText(geography.label, "Geography label", 100),
    },
    sourceId: requiredText(value.sourceId, "Source id", 160),
    sourceUrl: approvedSourceUrl(value.sourceUrl),
    sourceEditionId: requiredText(value.sourceEditionId, "Source edition id", 200),
    observationPeriod: { start, end, label: requiredText(observationPeriod.label, "Observation period label", 160) },
    publishedAt,
    fetchedAt,
    validUntil,
    availability,
    value: normalizedValue,
    revisionId: requiredText(value.revisionId, "Revision id", 200),
    points,
    caveats,
  };
}

function approvedSourceUrl(value) {
  const sourceUrl = requiredText(value, "Source URL", 1000);
  let parsed;
  try { parsed = new URL(sourceUrl); } catch { throw new Error("Source URL must be valid"); }
  if (parsed.protocol !== "https:") throw new Error("Source URL must use HTTPS");
  parsed.hash = "";
  return parsed.toString();
}

function compareEligibility(left, right) {
  return left.evidenceClass === right.evidenceClass &&
    left.comparisonKey === right.comparisonKey &&
    left.cadence === right.cadence &&
    left.unit === right.unit &&
    left.basis === right.basis &&
    left.geography.code === right.geography.code &&
    left.geography.label === right.geography.label
    ? "overlay"
    : "panels";
}

function selectMeasure(catalog, id, now = new Date()) {
  if (!catalog || typeof catalog !== "object" || catalog.schemaVersion !== 2 ||
    typeof catalog.editionId !== "string" || !catalog.editionId.trim() ||
    !(catalog.validUntil === null || typeof catalog.validUntil === "string") ||
    !catalog.measures || typeof catalog.measures !== "object" || Array.isArray(catalog.measures) ||
    !Object.hasOwn(catalog.measures, id)) return null;
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) return null;
  let generatedAt;
  let validUntil;
  try {
    generatedAt = Date.parse(instant(catalog.generatedAt, "Catalogue generation time"));
    validUntil = catalog.validUntil === null ? null : Date.parse(instant(catalog.validUntil, "Catalogue validity deadline"));
  } catch {
    return null;
  }
  if (generatedAt > date.getTime() || (validUntil !== null && validUntil <= generatedAt)) return null;
  let measure;
  try { measure = validateMeasureRecord(catalog.measures[id]); } catch { return null; }
  if (measure.id !== id) return null;
  if (Date.parse(measure.fetchedAt) > date.getTime()) return null;
  if (Date.parse(measure.validUntil) <= date.getTime()) return null;
  return measure;
}

export { compareEligibility, selectMeasure, validateMeasureRecord };
