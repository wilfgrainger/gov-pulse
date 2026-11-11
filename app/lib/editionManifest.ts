// Edition manifest and emitted-file classification for the per-edition static
// build (scripts/build-edition-site.mjs). Build-time only: never imported by a
// page, route or Worker. The static gate Worker (plan Task 15) consumes the
// manifest this produces.
import fs from "node:fs";
import path from "node:path";

/** Gate entry for one evidence-bearing file. Keys are file paths in the output ("/section/gdp/index.html"). */
export type GatedFile = { validUntil: string | null; feeds: string[]; unavailable: string | { status: 503 } };
export type EditionManifest = {
  editionId: string;
  builtAt: string;
  sha: string;
  /** Feeds held by publication config at build time; their data is absent from every file. */
  held: string[];
  files: Record<string, GatedFile>;
};

const embedding = new Map<string, string[]>();

/** Records that an emitted file (output-relative path) serialises data from these feeds. */
export function recordFeedEmbedding(file: string, feedIds: string[]): void {
  if (feedIds.length === 0) return;
  embedding.set(file, [...new Set([...(embedding.get(file) ?? []), ...feedIds])].sort());
}

export function feedEmbedding(): Record<string, string[]> {
  return Object.fromEntries(embedding);
}

export function resetFeedEmbedding(): void {
  embedding.clear();
}

/* ------------------------------ scan backstop ------------------------------ */

const SCALES: Record<string, number> = { bn: 1e9, billion: 1e9, m: 1e6, million: 1e6, k: 1e3, thousand: 1e3 };
const BINARY = /\.(woff2?|ico|png|jpe?g|gif|webp|avif)$/i;
// A number not glued to a CSS/SVG unit or identifier ("4.75rem", "9.4c", "a1"), with an optional scale word.
const TOKEN = /(?<![\w.])(\d+(?:\.\d+)?)(?:\s?(bn|billion|million|thousand|m|k))?(?![a-z]|\.?\d)/gi;
// Hashed compiled assets: if one serialised the build input its bytes (and hash) would
// differ between the two variant builds, so the embedding record lists it. Scanning
// minified code and CSS for three-digit numbers only produces false alarms.
const SCAN_EXEMPT = /^_next\/static\//;

const significantDigits = (digits: string) => digits.replace(".", "").replace(/^0+/, "").length;

/**
 * Numeric leaves of every feed section in a snapshot, as strings, that are
 * distinctive enough to scan for: at least three significant digits for a
 * fraction, at least five non-trailing-zero digits for an integer (so years,
 * small counts and round numbers in code do not match).
 */
export function evidenceValues(snapshot: unknown): string[] {
  const values = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      const text = String(Math.abs(value));
      if (/e/i.test(text)) return;
      const distinctive = Number.isInteger(value)
        ? text.replace(/0+$/, "").length >= 5
        : significantDigits(text) >= 3;
      if (distinctive) values.add(text);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  const record = snapshot as { meta?: { sources?: Record<string, unknown> } } & Record<string, unknown>;
  for (const id of Object.keys(record?.meta?.sources ?? {})) visit(record[id]);
  return [...values].sort();
}

/**
 * evidenceValues per feed: the feed's section plus the catalogue measures it
 * sources, so values a page shows from either place are attributed to the feed.
 */
export function evidenceValuesByFeed(snapshot: unknown): Record<string, string[]> {
  const record = snapshot as { meta?: { sources?: Record<string, unknown>; measureCatalog?: { measures?: Record<string, { sourceId?: string }> } } } & Record<string, unknown>;
  const measures = Object.values(record?.meta?.measureCatalog?.measures ?? {});
  return Object.fromEntries(Object.keys(record?.meta?.sources ?? {}).map((id) => [id, evidenceValues({
    meta: { sources: { [id]: {} } },
    [id]: [record[id], measures.filter((measure) => measure?.sourceId === id)],
  })]));
}

/** Every rendering the scan accepts for a value: fixed-decimal roundings and bn/m/k scalings. */
function renderings(text: string): string[] {
  const value = Number(text);
  const decimals = text.split(".")[1]?.length ?? 0;
  const keys = new Set<string>([`${text}|1`]);
  for (let d = 1; d <= Math.min(decimals, 4); d += 1) {
    const rounded = value.toFixed(d);
    if (significantDigits(rounded) >= 3) keys.add(`${rounded}|1`);
  }
  for (const scale of [1e3, 1e6, 1e9]) {
    if (value < scale) continue;
    for (let d = 1; d <= 3; d += 1) keys.add(`${(value / scale).toFixed(d)}|${scale}`);
  }
  return [...keys];
}

/** Strips thousands separators, currency signs and minus variants before tokenising. */
function normalise(text: string): string {
  return text.replace(/(\d),(?=\d{3}(?!\d))/g, "$1").replace(/[£$€]/g, " ").replace(/[−–]/g, "-");
}

function feedsIn(text: string, owner: Map<string, string>): Set<string> {
  const found = new Set<string>();
  for (const match of normalise(text).matchAll(TOKEN)) {
    const feed = owner.get(`${match[1]}|${match[2] ? SCALES[match[2].toLowerCase()] : 1}`);
    if (feed) found.add(feed);
  }
  return found;
}

/**
 * Verifies the per-route record: a file that carries a value, at full
 * precision, that identifies one feed while its record does not list that feed
 * embeds undeclared evidence (the serialised-payload leak this guards against
 * keeps full precision). Identifying values have at least four significant
 * digits and match no rendering (rounding or scaling) of another feed's values,
 * so a page's own rounded figures and chart geometry are not mistaken for
 * another feed.
 */
export function undeclaredFeedEvidence(
  outDir: string,
  embeddingRecord: Record<string, string[]>,
  valuesByFeed: Record<string, string[]>,
): { file: string; feeds: string[] }[] {
  const owner = new Map<string, string>();
  const renderedBy = new Map<string, Set<string>>();
  for (const [feed, values] of Object.entries(valuesByFeed)) {
    for (const key of values.flatMap(renderings)) renderedBy.set(key, (renderedBy.get(key) ?? new Set()).add(feed));
  }
  for (const [feed, values] of Object.entries(valuesByFeed)) {
    for (const text of values) {
      const key = `${text}|1`;
      if (significantDigits(text) >= 4 && renderedBy.get(key)?.size === 1) owner.set(key, feed);
    }
  }
  const leaks: { file: string; feeds: string[] }[] = [];
  if (owner.size === 0) return leaks;
  for (const file of walk(outDir).sort()) {
    if (BINARY.test(file) || SCAN_EXEMPT.test(file)) continue;
    const declared = new Set(embeddingRecord[file] ?? []);
    const extra = [...feedsIn(fs.readFileSync(path.join(outDir, file), "utf8"), owner)].filter((feed) => !declared.has(feed));
    if (extra.length > 0) leaks.push({ file, feeds: extra.sort() });
  }
  return leaks;
}

function containsValue(text: string, wanted: Set<string>): boolean {
  for (const match of normalise(text).matchAll(TOKEN)) {
    const scale = match[2] ? SCALES[match[2].toLowerCase()] : 1;
    if (wanted.has(`${match[1]}|${scale}`)) return true;
  }
  return false;
}

function walk(root: string, dir = root): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(root, full) : [path.relative(root, full).split(path.sep).join("/")];
  });
}

/**
 * Classifies every file under outDir. Primary: the embedding record (output-
 * relative path → feeds). Backstop: a normalised value scan. A file the scan
 * flags but the record does not list is `unexplained`, which fails the build.
 */
export function classifyEmittedFiles(
  outDir: string,
  embeddingRecord: Record<string, string[]>,
  values: string[],
): { evidenceBearing: string[]; clean: string[]; unexplained: string[] } {
  const wanted = new Set(values.flatMap(renderings));
  const result = { evidenceBearing: [] as string[], clean: [] as string[], unexplained: [] as string[] };
  for (const file of walk(outDir).sort()) {
    const recorded = (embeddingRecord[file]?.length ?? 0) > 0;
    const flagged = wanted.size > 0 && !BINARY.test(file) && !SCAN_EXEMPT.test(file) && containsValue(fs.readFileSync(path.join(outDir, file), "utf8"), wanted);
    if (recorded || flagged) result.evidenceBearing.push(file);
    else result.clean.push(file);
    if (flagged && !recorded) result.unexplained.push(file);
  }
  return result;
}
