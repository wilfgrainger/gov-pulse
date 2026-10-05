import {
  type MetricsSnapshot,
  type SnapshotSourceStatus,
} from "./metricsSnapshot";
import { selectMeasure, type MeasureCatalog, type MeasureRecord } from "./measureCatalog";
import {
  type EvidenceState,
  type SignalId,
  type SignalPresentation,
  SIGNAL_META,
  record,
  timestamp,
} from "./nationalEvidenceSupport";

const CATALOG_BINDINGS = [
  { id: "inflation", section: "sentimentPulse", valuePath: "series.inflation.value", periodPath: "series.inflation.period", publishedPath: "series.inflation.publishedAt", historyPath: "series.inflation.history", historyKey: "value" },
  { id: "unemployment", section: "employmentStats", valuePath: "headline.unemploymentRate", periodPath: "headline.period", publishedPath: "headline.releaseDate", historyPath: "history.labourForce", historyKey: "unemploymentRate" },
  { id: "debt-ratio", section: "nationalDebt", valuePath: "debtToGdp", periodPath: "observationPeriod", publishedPath: "publicationDate", historyPath: "history", historyKey: "debtToGdp" },
  { id: "waitingPathwaysEstimate", section: "nhsStats", valuePath: "headline.waitingPathwaysEstimate", periodPath: "headline.period", publishedPath: "headline.publicationDate", historyPath: "history", historyKey: "waitingPathwaysEstimate" },
] as const;

/**
 * Catalog measures that only gate a card's state. Their section carries other
 * series (house prices share housePriceIndex with rents), so the catalog
 * must not overwrite the section's values or history.
 */
const CATALOG_STATE_BINDINGS = [
  { id: "privateRentAnnualChange", section: "housePriceIndex" },
] as const;

function recordCatalogState(
  snapshot: MetricsSnapshot,
  section: string,
  id: string,
  measure: MeasureRecord | null,
  current: MeasureRecord | null
) {
  const sources = snapshot.meta.sources as Record<string, Record<string, unknown> | undefined>;
  const source = { ...(record(sources[section]) ?? {}) };
  const states = { ...(record(source.catalogMeasureStates) ?? {}) };
  const urls = { ...(record(source.catalogMeasureSources) ?? {}) };
  states[id] = current ? "current" : measure ? "historical" : "unavailable";
  if (measure) urls[id] = measure.sourceUrl;
  source.catalogMeasureStates = states;
  source.catalogMeasureSources = urls;
  sources[section] = source;
}

function setPath(root: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let target = root;
  for (const part of parts.slice(0, -1)) {
    const child = record(target[part]);
    if (!child) target[part] = {};
    target = target[part] as Record<string, unknown>;
  }
  target[parts.at(-1)!] = value;
}

export function projectCatalogMeasures(snapshot: MetricsSnapshot, now: Date): MetricsSnapshot {
  if (!Object.hasOwn(snapshot.meta, "measureCatalog")) return snapshot;
  const rawCatalog = record(snapshot.meta.measureCatalog);
  const projected = structuredClone(snapshot);
  const catalog = rawCatalog as unknown as MeasureCatalog;
  for (const binding of CATALOG_BINDINGS) {
    const measure = selectMeasure(catalog, binding.id, now);
    const current: MeasureRecord | null = measure?.availability === "current" ? measure : null;
    const section = record(projected[binding.section]) ?? {};
    projected[binding.section] = section;
    section.available = current !== null;
    setPath(section, binding.valuePath, current?.value ?? null);
    setPath(section, binding.periodPath, current?.observationPeriod.label ?? null);
    setPath(section, binding.publishedPath, current?.publishedAt ?? null);
    const history = current?.points.flatMap((point) => point.value === null ? [] : [{
      observedAt: Date.parse(`${point.observedAt}T00:00:00.000Z`),
      period: point.period,
      [binding.historyKey]: point.value,
    }]) ?? [];
    setPath(section, binding.historyPath, history);
    recordCatalogState(projected, binding.section, binding.id, measure, current);
  }
  for (const binding of CATALOG_STATE_BINDINGS) {
    const measure = selectMeasure(catalog, binding.id, now);
    const current: MeasureRecord | null = measure?.availability === "current" ? measure : null;
    recordCatalogState(projected, binding.section, binding.id, measure, current);
  }
  return projected;
}

export function sourceState(source: SnapshotSourceStatus | undefined): EvidenceState {
  if (!source || (source.status !== "ok" && source.status !== "stale")) return "unavailable";
  if (source.cacheState === "missing" || source.cacheState === "expired") return "unavailable";
  if (source.status === "stale" || source.cacheState === "stale") return "update-due";
  return "current";
}

export function hasNewerRelatedRelease(snapshot: MetricsSnapshot, section: "employmentStats" | "nationalDebt"): boolean {
  const sibling = section === "employmentStats" ? "sentimentPulse" : "taxRevenue";
  if (sourceState(snapshot.meta.sources[sibling]) !== "current") return false;
  const relatedDate = section === "employmentStats"
    ? timestamp(record(record(record(snapshot.sentimentPulse)?.series)?.unemployment)?.publishedAt)
    : timestamp(record(record(snapshot.taxRevenue)?.headline)?.releaseDate);
  const storedDate = section === "employmentStats"
    ? timestamp(record(record(snapshot.employmentStats)?.headline)?.releaseDate)
    : timestamp(record(snapshot.nationalDebt)?.publicationDate);
  return relatedDate !== null && storedDate !== null &&
    Math.floor(relatedDate / 86_400_000) > Math.floor(storedDate / 86_400_000);
}

export function unavailable(id: SignalId): SignalPresentation {
  return {
    ...SIGNAL_META[id],
    state: "unavailable",
    value: null,
    comparison: null,
    period: null,
    publishedAt: null,
    sourceUrl: null,
    history: [],
    leadHeadline: null,
    leadSummary: null,
    caveat: null,
  };
}

export function applySourceState(
  signal: SignalPresentation,
  source: SnapshotSourceStatus | undefined
): SignalPresentation {
  const catalogIds: Partial<Record<SignalId, string>> = {
    inflation: "inflation",
    unemployment: "unemployment",
    "national-debt": "debt-ratio",
    "private-rents": "privateRentAnnualChange",
    "nhs-waiting-list": "waitingPathwaysEstimate",
  };
  const catalogId = catalogIds[signal.id];
  const catalogState = catalogId
    ? record(record(source)?.catalogMeasureStates)?.[catalogId]
    : undefined;
  const sourceUrl = catalogId
    ? record(record(source)?.catalogMeasureSources)?.[catalogId]
    : undefined;
  if (catalogState === "historical" || catalogState === "unavailable") return unavailable(signal.id);
  if (catalogState === "current") {
    const currentness = source?.status === "ok" && source.cacheState === "fresh" ? "current" : "update-due";
    return { ...signal, state: currentness, sourceUrl: typeof sourceUrl === "string" ? sourceUrl : null };
  }
  const state = sourceState(source);
  return state === "unavailable"
    ? unavailable(signal.id)
    : { ...signal, state };
}
