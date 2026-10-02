import {
  sectionCurrentness,
  sectionValidityDeadline,
} from "./publication-currentness.js";
import { validateMeasureRecord } from "../contracts/measure-record.js";
import { FEED_REGISTRY_VERSION } from "./feed-registry.js";
import measureInventory from "../contracts/measure-definitions.json" with { type: "json" };

const DEFINITIONS = measureInventory.measures;

function at(value, path) {
  return path.split(".").reduce((current, key) => current && typeof current === "object" ? current[key] : undefined, value);
}

function text(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }

function dateString(value) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString().slice(0, 10);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))) return value;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
  }
  return null;
}

function dateRange(label) {
  const normalized = String(label).replace(/^YE\s+/i, "Year ending ").trim();
  const monthNames = "January February March April May June July August September October November December".split(" ");
  const yearEnd = normalized.match(/^Year ending ([A-Za-z]+) (20\d{2})$/i);
  if (yearEnd) {
    const endMonth = monthNames.findIndex((month) => month.toLowerCase() === yearEnd[1].toLowerCase());
    if (endMonth >= 0) {
      const year = Number(yearEnd[2]);
      const startMonth = (endMonth + 1) % 12;
      const startYear = endMonth === 11 ? year : year - 1;
      return {
        start: new Date(Date.UTC(startYear, startMonth, 1)).toISOString().slice(0, 10),
        end: new Date(Date.UTC(year, endMonth + 1, 0)).toISOString().slice(0, 10),
      };
    }
  }
  const range = normalized.match(/^([A-Za-z]+) to ([A-Za-z]+) (20\d{2})$/i);
  const monthFirst = normalized.match(/^([A-Za-z]+) (20\d{2})$/i);
  const yearFirst = normalized.match(/^(20\d{2}) ([A-Za-z]+)$/i);
  const abbreviatedYearFirst = normalized.match(/^(20\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i);
  if (range) {
    const startMonth = monthNames.findIndex((month) => month.toLowerCase() === range[1].toLowerCase());
    const endMonth = monthNames.findIndex((month) => month.toLowerCase() === range[2].toLowerCase());
    if (startMonth >= 0 && endMonth >= startMonth) {
      return { start: new Date(Date.UTC(Number(range[3]), startMonth, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(Number(range[3]), endMonth + 1, 0)).toISOString().slice(0, 10) };
    }
  }
  if (monthFirst || yearFirst || abbreviatedYearFirst) {
    const month = monthFirst
      ? monthNames.findIndex((name) => name.toLowerCase() === monthFirst[1].toLowerCase())
      : yearFirst
        ? monthNames.findIndex((name) => name.toLowerCase() === yearFirst[2].toLowerCase())
        : ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(abbreviatedYearFirst[2].toUpperCase());
    const year = Number(monthFirst ? monthFirst[2] : yearFirst ? yearFirst[1] : abbreviatedYearFirst[1]);
    if (month >= 0) return { start: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10) };
  }
  const date = dateString(at({ label }, "label"));
  return date ? { start: date, end: date } : null;
}

function sourceUrl(data, source, definition) {
  const preferred = at(data, definition.sourceUrlPath);
  const upstreamUrls = source?.provenance?.upstreams?.map((upstream) => upstream?.url) ?? [];
  const upstreamHosts = new Set(upstreamUrls.flatMap((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? [url.hostname] : [];
    } catch { return []; }
  }));
  for (const candidate of [preferred, ...upstreamUrls]) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && upstreamHosts.has(url.hostname)) return url.href;
    } catch { /* Ignore malformed publisher URLs. */ }
  }
  return null;
}

function editionId(data, source, definition, url, publishedAt, period) {
  const explicit = text(data?.source?.edition) ?? text(data?.source?.editionId) ??
    text(data?.headline?.editionId) ?? text(source?.provenance?.editionId);
  if (explicit) return explicit;

  // ONS collectors can provide a dated bulletin and publication date without
  // a publisher-issued edition ID. Use those source-owned fields and the
  // observation period for a stable local identity, never a retrieval clock.
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.ons.gov.uk" || !publishedAt || !period) return null;
    return `ons-${definition.id}-${publishedAt}-${fnv64(`${parsed.pathname}\n${period}`)}`;
  } catch {
    return null;
  }
}

function normalizeObservation(point, definition, revisionId) {
  const observedAt = dateString(point?.observedAt ?? point?.date);
  const value = point?.[definition.historyValue ?? "value"];
  const period = text(point?.period) ?? (observedAt ? observedAt.slice(0, 7) : null);
  if (!observedAt || !period || !(value === null || finite(value))) return null;
  return { period, observedAt, value, valueStatus: definition.valueStatus, revisionId };
}

function makeMeasure(snapshot, definition, now, reportOmission) {
  const omit = (reason) => {
    reportOmission?.({ measureId: definition.id, reason });
    return null;
  };
  const data = snapshot?.[definition.section];
  const source = snapshot?.meta?.sources?.[definition.section];
  if (!data || !source) return omit("source-section-missing");
  const sectionHistory = definition.historyPath ? at(data, definition.historyPath) : null;
  const rawValue = definition.valueFromLatestHistory && Array.isArray(sectionHistory)
    ? sectionHistory.at(-1)?.[definition.historyValue]
    : at(data, definition.valuePath);
  const rawHistory = definition.historyPath
    ? sectionHistory
    : definition.observationPath
      ? [{
          period: at(data, definition.periodPath),
          observedAt: at(data, definition.observationPath),
          [definition.historyValue ?? "value"]: rawValue,
        }]
      : [];
  const period = text(at(data, definition.periodPath));
  const publishedAt = dateString(at(data, definition.publishedPath));
  const url = sourceUrl(data, source, definition);
  const sourceEditionId = editionId(data, source, definition, url, publishedAt, period);
  if (!finite(rawValue) || !period || !publishedAt || !sourceEditionId || !url) return omit("headline-or-provenance-incomplete");
  if (!Array.isArray(rawHistory)) return omit("history-missing");
  const points = rawHistory.map((point) => normalizeObservation(point, definition, sourceEditionId));
  if (points.some((point) => !point)) return omit("history-shape-invalid");
  points.sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  const latestNumericPoint = [...points].reverse().find((point) => point.value !== null);
  if ((definition.historyPath && !latestNumericPoint) ||
      (latestNumericPoint && latestNumericPoint.value !== rawValue)) return omit("headline-history-mismatch");
  const latestDate = latestNumericPoint?.observedAt ??
    dateString(definition.observationPath ? at(data, definition.observationPath) : null) ??
    dateString(data?.__observation?.observedAt);
  const periodWindow = dateRange(period);
  if (!latestDate || !periodWindow) return omit("observation-period-invalid");
  const checkedAt = new Date(now);
  const sourceDeadline = definition.validityPath
    ? at(data, definition.validityPath)
    : (() => {
        const deadline = sectionValidityDeadline(definition.section, data, source, checkedAt);
        return Number.isFinite(deadline) ? new Date(deadline).toISOString() : null;
      })();
  const sourceIsCurrent = definition.validityPath
    ? source.status === "ok" && source.cacheState === "fresh"
    : sectionCurrentness(definition.section, data, source, checkedAt).current;
  const explicitDeadline = sourceDeadline ?? data.expiresAt;
  if (!explicitDeadline || !Number.isFinite(Date.parse(explicitDeadline))) return omit("validity-deadline-missing");
  const deadline = new Date(explicitDeadline).toISOString();
  const fetchedAt = dateString(source.fetchedAt) ? new Date(source.fetchedAt).toISOString() : null;
  if (!fetchedAt) return omit("retrieval-time-invalid");
  const availableNow = sourceIsCurrent && Date.parse(deadline) > checkedAt.getTime();
  const record = {
    id: definition.id,
    label: definition.label,
    evidenceClass: "official-statistics",
    comparisonKey: definition.comparisonKey,
    cadence: definition.cadence,
    unit: definition.unit,
    basis: definition.basis,
    geography: definition.geography,
    sourceId: definition.section,
    sourceUrl: url,
    sourceEditionId,
    observationPeriod: { ...periodWindow, label: period },
    publishedAt: new Date(publishedAt).toISOString(),
    fetchedAt,
    validUntil: deadline,
    availability: availableNow ? "current" : "historical",
    value: rawValue,
    revisionId: sourceEditionId,
    points,
    caveats: definition.caveats,
  };
  try {
    return validateMeasureRecord(record);
  } catch {
    return omit("measure-contract-rejected");
  }
}

function catalogRevisionIdentity(measures) {
  const revisionInput = Object.values(measures).sort((left, right) => left.id.localeCompare(right.id)).map((measure) => ({
    id: measure.id,
    label: measure.label,
    evidenceClass: measure.evidenceClass,
    comparisonKey: measure.comparisonKey,
    cadence: measure.cadence,
    unit: measure.unit,
    basis: measure.basis,
    geography: measure.geography,
    sourceId: measure.sourceId,
    sourceUrl: measure.sourceUrl,
    sourceEditionId: measure.sourceEditionId,
    observationPeriod: measure.observationPeriod,
    publishedAt: measure.publishedAt,
    availability: measure.availability,
    value: measure.value,
    revisionId: measure.revisionId,
    points: measure.points,
    caveats: measure.caveats,
  }));
  return `catalog-${fnv64(JSON.stringify(revisionInput))}`;
}

function buildMeasureCatalog(snapshot, now = new Date(), { onOmission } = {}) {
  const generatedAt = new Date(now);
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("Catalog generation time is invalid");
  const measures = {};
  const compatible = snapshot?.meta?.registryVersion === FEED_REGISTRY_VERSION &&
    snapshot?.meta?.sources && typeof snapshot.meta.sources === "object";
  for (const definition of compatible ? DEFINITIONS : []) {
    try {
      const measure = makeMeasure(snapshot, definition, generatedAt, onOmission);
      if (measure) measures[measure.id] = measure;
    } catch {
      onOmission?.({ measureId: definition.id, reason: "adapter-error" });
    }
  }
  const deadlines = Object.values(measures).filter((measure) => measure.availability === "current").map((measure) => Date.parse(measure.validUntil));
  return {
    schemaVersion: 2,
    editionId: catalogRevisionIdentity(measures),
    generatedAt: generatedAt.toISOString(),
    validUntil: deadlines.length ? new Date(Math.min(...deadlines)).toISOString() : null,
    measures,
  };
}

function fnv64(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

const MEASURE_IDS = Object.freeze(DEFINITIONS.map(({ id }) => id));

export { buildMeasureCatalog, catalogRevisionIdentity, MEASURE_IDS, fnv64 };
