import { validateMeasureRecord, type MeasurePoint, type MeasureRecord } from "./measureCatalog";

export type DateWindow = { start: string; end: string };
export type ExportPublication = {
  id: string;
  publisher: string;
  sourceUrl: string;
  methodologyUrl: string;
  publishedAt: string;
  fieldworkStart: string;
  fieldworkEnd: string;
  disclosures: string[];
};
export type ExportPackage = {
  title: string;
  measures: MeasureRecord[];
  publications: ExportPublication[];
  dateWindow: DateWindow;
  caveats: string[];
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
}): ExportPackage {
  const title = input.title.trim();
  if (!title) throw new Error("An export package needs a chart title");
  const dateWindow = validateDateWindow(input.dateWindow);
  const measures = input.measures.map(validateMeasureRecord);
  if (measures.length === 0) throw new Error("An export package needs at least one measure");
  const caveats = [...new Set(measures.flatMap((measure) => measure.caveats))];
  return { title, measures, publications: [], dateWindow, caveats };
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
    if (!publication.id.trim() || !publication.publisher.trim() || !/^https:\/\//.test(publication.sourceUrl) || !/^https:\/\//.test(publication.methodologyUrl)) {
      throw new Error("Export publication identity and HTTPS publisher links are required");
    }
    if (!isDate(publication.publishedAt) || !isDate(publication.fieldworkStart) || !isDate(publication.fieldworkEnd) || publication.fieldworkStart > publication.fieldworkEnd) {
      throw new Error("Export publication dates must be valid and ordered");
    }
    return { ...publication, disclosures: publication.disclosures.map((entry) => entry.trim()).filter(Boolean) };
  });
  const caveats = [...new Set(input.caveats.map((caveat) => caveat.trim()).filter(Boolean))];
  return { title, measures: [], publications, dateWindow, caveats };
}

export function exportPackageCitation(pkg: ExportPackage): string {
  const sources = pkg.measures.map((measure) =>
    `${measure.label}: ${measure.sourceEditionId} (${measure.observationPeriod.label}), ${measure.sourceUrl}`
  );
  sources.push(...pkg.publications.map((publication) =>
    `${publication.publisher}: ${publication.id}, published ${publication.publishedAt}, ${publication.sourceUrl}`
  ));
  return [`${pkg.dateWindow.start} to ${pkg.dateWindow.end}`, sources.join(" · ")].join(" · ");
}
