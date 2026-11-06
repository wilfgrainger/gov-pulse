import type { MetricsSnapshot, SnapshotSourceStatus } from "./metricsSnapshot";
import { downloadGeography, downloadIds } from "../../feeds/registry.js";

// Feeds declared under feeds/ list their own download (feeds/<slug>/feed.js);
// the rest are still listed here until they migrate. The cast keeps the literal
// id union; tests/worker/feed-registry-projection.test.ts pins the list and
// order to the pre-migration list.
const HAND_LISTED_IDS = [
  "electionPolling", "nationalDebt", "sentimentPulse",
  "taxRevenue",
] as const;
// Published order of the download list. Until every feed is declared, the two
// sources are merged into this order; afterwards FEEDS order is this order.
const DOWNLOAD_ORDER = [
  "electionPolling", "nationalDebt", "gdpTracker", "sentimentPulse",
  "taxRevenue", "employmentStats", "crimeStatistics", "nhsStats", "migrationStats",
  "housePriceIndex", "realWages",
] as const;
const LISTED = new Set<string>([...HAND_LISTED_IDS, ...downloadIds()]);
export const SECTION_DOWNLOAD_IDS = DOWNLOAD_ORDER.filter((id) => LISTED.has(id)) as unknown as typeof DOWNLOAD_ORDER;

const DECLARED_GEOGRAPHY: Record<string, string> = downloadGeography();

const GEOGRAPHY: Record<(typeof SECTION_DOWNLOAD_IDS)[number], string> = {
  electionPolling: "United Kingdom (check each poll's sample)",
  nationalDebt: "United Kingdom",
  gdpTracker: DECLARED_GEOGRAPHY.gdpTracker,
  sentimentPulse: "United Kingdom (check each series)",
  taxRevenue: "United Kingdom",
  employmentStats: DECLARED_GEOGRAPHY.employmentStats,
  crimeStatistics: DECLARED_GEOGRAPHY.crimeStatistics,
  nhsStats: DECLARED_GEOGRAPHY.nhsStats,
  migrationStats: DECLARED_GEOGRAPHY.migrationStats,
  housePriceIndex: DECLARED_GEOGRAPHY.housePriceIndex,
  realWages: DECLARED_GEOGRAPHY.realWages,
};

const OGL = {
  name: "Open Government Licence v3.0, except where otherwise stated",
  url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
  attribution: "Contains public sector information licensed under the Open Government Licence v3.0, except where the named source states otherwise.",
};
const POLLING_TERMS = {
  name: "No reuse licence asserted by public-data.org",
  url: "https://yougov.co.uk/about/terms-combined",
  attribution: "YouGov primary publication; reuse is subject to YouGov's terms.",
};

export type SectionDistribution = {
  contractVersion: number;
  section: (typeof SECTION_DOWNLOAD_IDS)[number];
  generatedAt: string | null;
  geography: string;
  licence: typeof OGL;
  source: SnapshotSourceStatus;
  data: unknown;
};

export function sectionDistribution(snapshot: MetricsSnapshot, section: string): SectionDistribution | null {
  if (!SECTION_DOWNLOAD_IDS.some((id) => id === section)) return null;
  if (!Object.prototype.hasOwnProperty.call(snapshot.meta.sources, section) ||
      !Object.prototype.hasOwnProperty.call(snapshot, section)) return null;
  const id = section as (typeof SECTION_DOWNLOAD_IDS)[number];
  return {
    contractVersion: 1,
    section: id,
    generatedAt: snapshot.meta.generatedAt ?? null,
    geography: GEOGRAPHY[id],
    licence: id === "electionPolling" ? POLLING_TERMS : OGL,
    source: snapshot.meta.sources[id],
    data: snapshot[id],
  };
}

export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r\t]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function flatten(value: unknown, path = "$", rows: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flatten(entry, `${path}[${index}]`, rows));
    if (value.length === 0) rows.push([path, "[]"]);
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en-GB"));
    entries.forEach(([key, entry]) => flatten(entry, `${path}.${key}`, rows));
    if (entries.length === 0) rows.push([path, "{}"]);
  } else {
    rows.push([path, value === null ? "null" : value]);
  }
  return rows;
}

export function sectionCsv(distribution: SectionDistribution): string {
  return ["path,value", ...flatten(distribution).map(([path, value]) => `${csvCell(path)},${csvCell(value)}`)].join("\n") + "\n";
}
