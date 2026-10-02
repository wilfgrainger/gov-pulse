import {
  sectionCurrentness,
  sectionValidityDeadline,
} from "./publication-currentness.js";
import { validateMeasureRecord } from "../contracts/measure-record.js";
import { FEED_REGISTRY_VERSION } from "./feed-registry.js";

const DEFINITIONS = [
  { id: "gdp-threeMonthGrowth", section: "gdpTracker", label: "GDP: three-month growth", path: "headline.threeMonthGrowth", history: "history", historyValue: "threeMonthGrowth", period: "headline.period", published: "headline.releaseDate", unit: "%", basis: "Real GDP growth across the latest three months", geography: ["UK", "United Kingdom"], comparisonKey: "uk-real-gdp-three-month-growth", cadence: "monthly", status: "estimate", caveats: ["Early estimate; subject to revision."] },
  { id: "inflation", section: "sentimentPulse", label: "CPI inflation", path: "series.inflation.value", history: "series.inflation.history", historyValue: "value", period: "series.inflation.period", published: "series.inflation.publishedAt", unit: "%", basis: "Annual change in the Consumer Prices Index", geography: ["UK", "United Kingdom"], comparisonKey: "uk-cpi-annual-inflation", cadence: "monthly", status: "observed", caveats: ["CPI does not describe every household's personal inflation rate."] },
  { id: "unemployment", section: "employmentStats", label: "Unemployment rate", path: "headline.unemploymentRate", history: "history.labourForce", historyValue: "unemploymentRate", period: "headline.period", published: "headline.releaseDate", unit: "%", basis: "ILO unemployed people as a share of the economically active population", geography: ["GB", "Great Britain"], comparisonKey: "gb-labour-force-survey-unemployment-rate", cadence: "monthly-three-month-average", status: "estimate", caveats: ["Survey estimate; subject to sampling uncertainty and revision."] },
  { id: "waitingPathwaysEstimate", section: "nhsStats", label: "NHS waiting list", path: "headline.waitingPathwaysEstimate", history: "history", historyValue: "waitingPathwaysEstimate", period: "headline.period", published: "headline.publicationDate", unit: "pathways", basis: "Referral-to-treatment waiting pathways, not unique people", geography: ["ENG", "England"], comparisonKey: "england-nhs-rtt-waiting-pathways", cadence: "monthly", status: "estimate", caveats: ["A person can wait on more than one pathway."] },
  { id: "debt-ratio", section: "nationalDebt", label: "Debt as a share of GDP", path: "debtToGdp", history: "history", historyValue: "debtToGdp", period: "observationPeriod", published: "publicationDate", unit: "%", basis: "Public sector net debt excluding public sector banks divided by GDP", geography: ["UK", "United Kingdom"], comparisonKey: "uk-psnd-gdp-ratio", cadence: "monthly", status: "observed", caveats: ["A fiscal stock-to-GDP ratio, not an annual borrowing flow."] },
  { id: "receipts", section: "taxRevenue", label: "Central government receipts", path: "headline.receiptsBillion", history: "history", historyValue: "receiptsBillion", period: "headline.period", published: "headline.releaseDate", unit: "£bn", basis: "Nominal central-government receipts on the ONS accounting basis", geography: ["UK", "United Kingdom"], comparisonKey: "uk-central-government-monthly-receipts-nominal", cadence: "monthly", status: "observed", caveats: ["Nominal monthly flow; not all receipts are taxes."] },
  { id: "netMigration", section: "migrationStats", label: "Net migration", path: "headline.netMigration", history: "history", historyValue: "netMigration", period: "headline.period", published: "headline.releaseDate", unit: "people", basis: "Long-term immigration minus long-term emigration", geography: ["UK", "United Kingdom"], comparisonKey: "uk-ons-long-term-net-migration", cadence: "annual", status: "estimate", caveats: ["Provisional official statistics in development; subject to revision."] },
  { id: "regularPayRealGrowth", section: "realWages", label: "Real wages: regular pay growth", path: "headline.regularPayRealGrowthPercent", history: "history", historyValue: "regularPayRealGrowthPercent", period: "headline.period", published: "headline.releaseDate", unit: "%", basis: "ONS regular pay growth in real terms, CPIH-adjusted", geography: ["GB", "Great Britain"], comparisonKey: "gb-ons-regular-pay-real-growth-cpih", cadence: "monthly-three-month-average", status: "estimate", caveats: ["Published directly by ONS and subject to revision."] },
];

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
  if (range) {
    const startMonth = monthNames.findIndex((month) => month.toLowerCase() === range[1].toLowerCase());
    const endMonth = monthNames.findIndex((month) => month.toLowerCase() === range[2].toLowerCase());
    if (startMonth >= 0 && endMonth >= startMonth) {
      return { start: new Date(Date.UTC(Number(range[3]), startMonth, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(Number(range[3]), endMonth + 1, 0)).toISOString().slice(0, 10) };
    }
  }
  if (monthFirst || yearFirst) {
    const month = monthFirst
      ? monthNames.findIndex((name) => name.toLowerCase() === monthFirst[1].toLowerCase())
      : monthNames.findIndex((name) => name.toLowerCase() === yearFirst[2].toLowerCase());
    const year = Number(monthFirst ? monthFirst[2] : yearFirst[1]);
    if (month >= 0) return { start: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10) };
  }
  const date = dateString(at({ label }, "label"));
  return date ? { start: date, end: date } : null;
}

function sourceUrl(data, source) {
  const upstreamUrl = source?.provenance?.upstreams?.[0]?.url;
  const candidate = [data?.source?.bulletinUrl, data?.source?.publicationUrl, data?.source?.sourceUrl, upstreamUrl]
    .find((value) => typeof value === "string" && /^https:\/\//.test(value));
  if (!candidate) return null;
  try { return new URL(candidate).protocol === "https:" ? new URL(candidate).href : null; } catch { return null; }
}

function editionId(data, source) {
  return text(data?.source?.edition) ?? text(data?.source?.editionId) ??
    text(data?.headline?.editionId) ?? text(source?.provenance?.editionId);
}

function normalizeObservation(point, definition, revisionId) {
  const observedAt = dateString(point?.observedAt ?? point?.date);
  const value = point?.[definition.historyValue];
  const period = text(point?.period) ?? (observedAt ? observedAt.slice(0, 7) : null);
  if (!observedAt || !period || !(value === null || finite(value))) return null;
  return { period, observedAt, value, valueStatus: definition.status, revisionId };
}

function makeMeasure(snapshot, definition, now) {
  const data = snapshot?.[definition.section];
  const source = snapshot?.meta?.sources?.[definition.section];
  if (!data || !source) return null;
  const rawValue = at(data, definition.path);
  const period = text(at(data, definition.period));
  const publishedAt = dateString(at(data, definition.published));
  const sourceEditionId = editionId(data, source);
  const url = sourceUrl(data, source);
  if (!finite(rawValue) || !period || !publishedAt || !sourceEditionId || !url) return null;
  const rawHistory = at(data, definition.history);
  if (!Array.isArray(rawHistory)) return null;
  const points = rawHistory.map((point) => normalizeObservation(point, definition, sourceEditionId));
  if (points.some((point) => !point)) return null;
  points.sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  if (points.length && points.at(-1).value !== rawValue) return null;
  const latestDate = points.at(-1)?.observedAt ?? dateString(data?.__observation?.observedAt);
  const periodWindow = dateRange(period);
  if (!latestDate || !periodWindow) return null;
  const checkedAt = new Date(now);
  const sourceDeadline = definition.section === "sentimentPulse"
    ? data.__measureValidity?.inflation?.validUntil
    : (() => {
        const deadline = sectionValidityDeadline(definition.section, data, source, checkedAt);
        return Number.isFinite(deadline) ? new Date(deadline).toISOString() : null;
      })();
  const sourceIsCurrent = definition.section === "sentimentPulse"
    ? source.status === "ok" && source.cacheState === "fresh"
    : sectionCurrentness(definition.section, data, source, checkedAt).current;
  const explicitDeadline = sourceDeadline ?? data.expiresAt;
  if (!explicitDeadline || !Number.isFinite(Date.parse(explicitDeadline))) return null;
  const deadline = new Date(explicitDeadline).toISOString();
  const fetchedAt = dateString(source.fetchedAt) ? new Date(source.fetchedAt).toISOString() : null;
  if (!fetchedAt) return null;
  const availableNow = sourceIsCurrent && Date.parse(deadline) > checkedAt.getTime();
  const record = {
    id: definition.id,
    label: definition.label,
    evidenceClass: "official-statistics",
    comparisonKey: definition.comparisonKey,
    cadence: definition.cadence,
    unit: definition.unit,
    basis: definition.basis,
    geography: { code: definition.geography[0], label: definition.geography[1] },
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
  return validateMeasureRecord(record);
}

function buildMeasureCatalog(snapshot, now = new Date()) {
  const generatedAt = new Date(now);
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("Catalog generation time is invalid");
  const measures = {};
  const compatible = snapshot?.meta?.registryVersion === FEED_REGISTRY_VERSION &&
    snapshot?.meta?.sources && typeof snapshot.meta.sources === "object";
  for (const definition of compatible ? DEFINITIONS : []) {
    try {
      const measure = makeMeasure(snapshot, definition, generatedAt);
      if (measure) measures[measure.id] = measure;
    } catch {
      // A source row that fails the common record contract is omitted, not guessed.
    }
  }
  const deadlines = Object.values(measures).filter((measure) => measure.availability === "current").map((measure) => Date.parse(measure.validUntil));
  const editionIds = [...new Set(Object.values(measures).map((measure) => measure.sourceEditionId))].sort();
  return {
    schemaVersion: 2,
    editionId: `catalog-${editionIds.join(".") || "empty"}`,
    generatedAt: generatedAt.toISOString(),
    validUntil: deadlines.length ? new Date(Math.min(...deadlines)).toISOString() : null,
    measures,
  };
}

const MEASURE_IDS = Object.freeze(DEFINITIONS.map(({ id }) => id));

export { buildMeasureCatalog, MEASURE_IDS };
