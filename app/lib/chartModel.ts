import { validateMeasureRecord, type MeasurePoint, type MeasureRecord } from "./measureCatalog";

export type DateWindow = { start: string; end: string };
export type ExportMeasure = Omit<MeasureRecord, "availability" | "points" | "revisionId" | "validUntil" | "value"> & {
  sourceAvailability: MeasureRecord["availability"];
  sourceRevisionId: string;
  observations: MeasurePoint[];
};
export type ExportPublication = {
  id: string;
  publisher: string;
  title: string;
  commissioner: string | null;
  questionText: string | null;
  headlineMethod: string;
  population: string;
  geography: string;
  mode: string | null;
  sampleSize: number;
  sampleSizeNote: string | null;
  partyResults: Record<string, number>;
  sourceUrl: string;
  methodologyUrl: string;
  publishedAt: string | null;
  publicationDateStatus: "published" | "not-disclosed";
  fieldworkStart: string;
  fieldworkEnd: string;
  disclosures: string[];
};
export type ExportPackage = {
  schemaVersion: 1;
  title: string;
  measures: ExportMeasure[];
  publications: ExportPublication[];
  dateWindow: DateWindow;
  caveats: string[];
  comparison?: {
    displayMode: "panels" | "overlay";
    transformations: string[];
  };
};

const DAY_MS = 86_400_000;

/** Give a one-date chart a readable axis without adding or shifting observations. */
export function timeAxisDomain(values: number[]): [number, number] {
  const dates = values.filter(Number.isFinite);
  if (dates.length === 0) return [0, 1];
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  return min === max ? [min - 31 * DAY_MS, max + 31 * DAY_MS] : [min, max];
}

/** Map a timestamp into a plot range; a single observed date stays centred. */
export function timePosition(value: number, min: number, max: number, start: number, width: number): number {
  return min === max ? start + width / 2 : start + ((value - min) / (max - min)) * width;
}

/** Avoid a generated center tick sharing a key with a lone published date. */
export function timeAxisTicks(values: number[]): number[] | undefined {
  const dates = values.filter(Number.isFinite);
  if (dates.length === 0 || Math.min(...dates) !== Math.max(...dates)) return undefined;
  return timeAxisDomain(dates);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateDateWindow(window: DateWindow): DateWindow {
  if (!isDate(window?.start) || !isDate(window?.end) || window.start > window.end) {
    throw new Error("Chart date window must contain ordered ISO calendar dates");
  }
  return { start: window.start, end: window.end };
}

export function barWidthPercent(value: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.min(100, Math.max(0, (value / maximum) * 100));
}

export function clipPoints(points: MeasurePoint[], window: DateWindow): MeasurePoint[] {
  const checked = validateDateWindow(window);
  return points.filter((point) =>
    isDate(point.observedAt) && point.observedAt >= checked.start && point.observedAt <= checked.end
  );
}

/** Split line geometry at missing observations and revision identities. */
function expectedInterval(cadence: string | undefined): number | null {
  const normalized = cadence?.toLowerCase() ?? "";
  const day = 86_400_000;
  if (/annual|yearly/.test(normalized)) return 365.25 * day;
  if (/quarter/.test(normalized)) return 91.3125 * day;
  if (/month/.test(normalized)) return 30.4375 * day;
  if (/week/.test(normalized)) return 7 * day;
  if (/daily|day/.test(normalized)) return day;
  return null;
}

export function segmentPoints(points: MeasurePoint[], cadence?: string): MeasurePoint[][] {
  const segments: MeasurePoint[][] = [];
  let current: MeasurePoint[] = [];
  let revision: string | null = null;
  const intervals = points.slice(1).map((point, index) =>
    Date.parse(`${point.observedAt}T00:00:00.000Z`) - Date.parse(`${points[index].observedAt}T00:00:00.000Z`)
  ).filter((interval) => Number.isFinite(interval) && interval > 0).sort((left, right) => left - right);
  const expected = expectedInterval(cadence) ?? intervals[Math.floor(intervals.length / 2)] ?? null;
  const maxGap = expected === null ? null : expected * 1.7;
  let previousDate: number | null = null;
  for (const point of points) {
    if (point.value === null) {
      if (current.length) segments.push(current);
      current = [];
      revision = null;
      previousDate = Date.parse(`${point.observedAt}T00:00:00.000Z`);
      continue;
    }
    const observedAt = Date.parse(`${point.observedAt}T00:00:00.000Z`);
    const gap = previousDate !== null && maxGap !== null && observedAt - previousDate > maxGap;
    if ((revision !== null && point.revisionId !== revision) || gap) {
      if (current.length) segments.push(current);
      current = [];
    }
    revision = point.revisionId;
    current.push(point);
    previousDate = observedAt;
  }
  if (current.length) segments.push(current);
  return segments;
}

export function buildExportPackage(input: {
  title: string;
  measures: unknown[];
  dateWindow: DateWindow;
  comparison?: ExportPackage["comparison"];
}): ExportPackage {
  const title = input.title.trim();
  if (!title) throw new Error("An export package needs a chart title");
  const dateWindow = validateDateWindow(input.dateWindow);
  const sourceMeasures = input.measures.map(validateMeasureRecord);
  if (sourceMeasures.length === 0) throw new Error("An export package needs at least one measure");
  const measures = sourceMeasures.map((measure) => {
    const provenance = {
      id: measure.id,
      label: measure.label,
      evidenceClass: measure.evidenceClass,
      comparisonKey: measure.comparisonKey,
      cadence: measure.cadence,
      unit: measure.unit,
      basis: measure.basis,
      ...(measure.note ? { note: measure.note } : {}),
      ...(measure.publisher ? { publisher: measure.publisher } : {}),
      geography: measure.geography,
      sourceId: measure.sourceId,
      sourceUrl: measure.sourceUrl,
      sourceEditionId: measure.sourceEditionId,
      observationPeriod: measure.observationPeriod,
      publishedAt: measure.publishedAt,
      fetchedAt: measure.fetchedAt,
      caveats: measure.caveats,
    };
    return { ...provenance, sourceAvailability: measure.availability, sourceRevisionId: measure.revisionId, observations: clipPoints(measure.points, dateWindow) };
  });
  const caveats = [...new Set(sourceMeasures.flatMap((measure) => measure.caveats))];
  const comparison = input.comparison
    ? {
        displayMode: input.comparison.displayMode,
        transformations: [...new Set(input.comparison.transformations.map((entry) => entry.trim()).filter(Boolean))],
      }
    : undefined;
  if (comparison && (!['panels', 'overlay'].includes(comparison.displayMode) || comparison.transformations.length === 0)) {
    throw new Error("A comparison export needs a display mode and a clear transformation statement");
  }
  return { schemaVersion: 1, title, measures, publications: [], dateWindow, caveats, ...(comparison ? { comparison } : {}) };
}

export function buildPublicationExportPackage(input: {
  title: string;
  publications: ExportPublication[];
  dateWindow: DateWindow;
  caveats: string[];
}): ExportPackage {
  const title = input.title.trim();
  const dateWindow = validateDateWindow(input.dateWindow);
  if (!title || input.publications.length === 0) throw new Error("A publication export needs a title and at least one source publication");
  const publications = input.publications.map((publication) => {
    if (!publication.id.trim() || !publication.publisher.trim() || !/^https:\/\//.test(publication.sourceUrl) || !/^https:\/\//.test(publication.methodologyUrl) || !Number.isSafeInteger(publication.sampleSize) || publication.sampleSize < 1 || !Object.keys(publication.partyResults).length || Object.values(publication.partyResults).some((share) => !Number.isFinite(share) || share < 0 || share > 100)) {
      throw new Error("Export publication identity and HTTPS publisher links are required");
    }
    const publicationDateValid = publication.publicationDateStatus === "published"
      ? isDate(publication.publishedAt)
      : publication.publicationDateStatus === "not-disclosed" && publication.publishedAt === null;
    if (!publicationDateValid || !isDate(publication.fieldworkStart) || !isDate(publication.fieldworkEnd) || publication.fieldworkStart > publication.fieldworkEnd) {
      throw new Error("Export publication dates must be valid and ordered");
    }
    return { ...publication, disclosures: publication.disclosures.map((entry) => entry.trim()).filter(Boolean) };
  });
  const caveats = [...new Set(input.caveats.map((caveat) => caveat.trim()).filter(Boolean))];
  return { schemaVersion: 1, title, measures: [], publications, dateWindow, caveats };
}

export function exportPackageCitation(pkg: ExportPackage): string {
  const sources = pkg.measures.map((measure) =>
    `${measure.publisher ?? measure.sourceId}: ${measure.label}, ${measure.sourceEditionId} (${measure.observations.length} selected observations), ${measure.sourceUrl}`
  );
  sources.push(...pkg.publications.map((publication) =>
    `${publication.publisher}: ${publication.id}, ${publication.publishedAt ? `published ${publication.publishedAt}` : "publication date not disclosed"}, ${publication.sourceUrl}`
  ));
  const comparison = pkg.comparison
    ? [`Display mode: ${pkg.comparison.displayMode}`, ...pkg.comparison.transformations].join("; ")
    : null;
  return [`${pkg.dateWindow.start} to ${pkg.dateWindow.end}`, comparison, sources.join(" · ")].filter(Boolean).join(" · ");
}

export function safeCsvCell(value: string | number | boolean | null): string {
  const text = typeof value === "string" && /^\s*[=+\-@\t\r]/.test(value) ? `'${value}` : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeMeasureExportCsv(pkg: ExportPackage): string {
  const columns = ["chart_title", "window_start", "window_end", "display_mode", "transformations", "measure_id", "measure", "evidence_class", "geography", "unit", "basis", "cadence", "publisher", "source_id", "source_edition_id", "source_revision_id", "source_url", "published_at", "publication_date_status", "observation_period", "observed_at", "period", "value", "value_status", "point_revision_id", "source_availability", "caveats", "poll_id", "pollster", "party", "party_share_percent", "sample_size", "sample_size_basis", "poll_title", "question_text", "commissioner", "headline_method", "population", "geography_sample", "mode", "fieldwork_start", "fieldwork_end", "methodology_url", "disclosures"];
  const measureRows = pkg.measures.flatMap((measure) => measure.observations.map((point) => [
    pkg.title, pkg.dateWindow.start, pkg.dateWindow.end, pkg.comparison?.displayMode ?? "", pkg.comparison?.transformations.join("; ") ?? "", measure.id, measure.label, measure.evidenceClass,
    measure.geography.label, measure.unit, measure.basis, measure.cadence, measure.publisher ?? measure.sourceId,
    measure.sourceId, measure.sourceEditionId, measure.sourceRevisionId, measure.sourceUrl, measure.publishedAt, "published",
    measure.observationPeriod.label, point.observedAt, point.period, point.value, point.valueStatus,
    point.revisionId, measure.sourceAvailability, measure.caveats.join(" "),
  ].map(safeCsvCell).join(",")));
  const publicationRows = pkg.publications.flatMap((publication) => Object.entries(publication.partyResults)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([party, share]) => {
      const fieldworkStart = Date.parse(`${publication.fieldworkStart}T00:00:00.000Z`);
      const fieldworkEnd = Date.parse(`${publication.fieldworkEnd}T00:00:00.000Z`);
      const midpoint = new Date(fieldworkStart + (fieldworkEnd - fieldworkStart) / 2).toISOString();
      return [
        pkg.title, pkg.dateWindow.start, pkg.dateWindow.end, "", "", "", "", "polling", publication.geography, "%",
        "Publisher-reported voting intention", "poll publication", publication.publisher, "", publication.id, "",
        publication.sourceUrl, publication.publishedAt, publication.publicationDateStatus, `${publication.fieldworkStart} to ${publication.fieldworkEnd}`,
        midpoint, `${publication.fieldworkStart} to ${publication.fieldworkEnd}`, "", "published", "",
        "source publication", pkg.caveats.join(" "), publication.id, publication.publisher, party, share,
        publication.sampleSize, publication.sampleSizeNote, publication.title, publication.questionText, publication.commissioner, publication.headlineMethod,
        publication.population, publication.geography, publication.mode, publication.fieldworkStart,
        publication.fieldworkEnd, publication.methodologyUrl, publication.disclosures.join(" · "),
      ].map(safeCsvCell).join(",");
    }));
  return [columns.map(safeCsvCell).join(","), ...measureRows, ...publicationRows].join("\r\n") + "\r\n";
}

export function serializeMeasureExportJson(pkg: ExportPackage): string {
  return JSON.stringify(pkg, null, 2);
}
