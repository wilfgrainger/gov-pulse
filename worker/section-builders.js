/**
 * Flat section-builder map for the seven GENERIC publication sections.
 *
 * This replaces the former "Russian doll" of internal-worker fetch wrappers
 * (index.js / entry.js / evidence-entry.js / polling-entry.js / series-entry.js
 * / debt-entry.js / editorial-entry.js) that the live publication path reached
 * through refreshSectionPayload's editorialWorker.fetch("/metrics?section=X")
 * fake-HTTP hop. Each builder returns the SAME record shape the doll produced
 * ({ section, data, source, fetchedAt, sourceLabel, backend }) with the SAME
 * fail-closed currentness behaviour, so mergePublication's published snapshot is
 * unchanged.
 *
 * Fail-closed validators are MOVED VERBATIM from the deleted doll layers:
 *   - validDebtPayload + validDateOnly        (was worker/debt-entry.js)
 *   - publicationCurrent + isCurrentRecord    (was worker/series-entry.js)
 *   - buildCurrentEconomicIndicators          (was worker/series-entry.js)
 * In-place validators are reused where they already live:
 *   - isCurrentCrimeStatisticsPayload         (contracts/crime-statistics.js)
 *   - isEconomicIndicatorsPayload             (worker/economic-indicators.js)
 *   - isOfficialEconomyRecord                 (worker/economy-section-cache.js)
 *
 * The generic-economy sections (gdpTracker, employmentStats), and the ONS
 * observation-dated sections (migrationStats), keep the exact __observation /
 * expiresAt decoration and currentness gate they had in the doll by reusing the
 * shared observation-contract wrapper (applyObservationContracts), which itself
 * is unchanged. taxRevenue is intentionally NOT in this map: the live path
 * special-cases it to the live collector in publication-entry.js, exactly as
 * before.
 */
import {
  buildEmploymentStats,
  buildGdpTracker,
} from "./economy-evidence.js";
import {
  buildEconomicIndicators,
  isEconomicIndicatorsPayload,
} from "./economic-indicators.js";
import {
  DEBT_GDP_SERIES_URL,
  DEBT_SERIES_URL,
  buildNationalDebt,
} from "./national-debt.js";
import { buildMigrationStats } from "./migration.js";
import { buildRealWagesStats } from "./real-wages.js";
import {
  buildCrimeStatistics,
  isCurrentCrimeStatisticsPayload,
} from "./crime-statistics.js";
import { isOfficialEconomyRecord } from "./economy-section-cache.js";
import {
  FEED_REGISTRY,
  applyFeedRegistry,
  provenanceFor,
} from "./feed-registry.js";
import { applyFreshnessPolicy } from "./freshness-policy.js";
import { applyObservationContracts } from "./observation-contract.js";

const ONS_MAX_PUBLICATION_AGE_MS = 75 * 24 * 60 * 60 * 1000;
const DEBT_MAX_PUBLICATION_AGE_MS = 75 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Validators moved VERBATIM from worker/series-entry.js
// ---------------------------------------------------------------------------

function publicationCurrent(data, now = new Date()) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return false;

  return ["inflation", "unemployment"].every((id) => {
    const publishedAt = Date.parse(data?.series?.[id]?.publishedAt ?? "");
    return (
      Number.isFinite(publishedAt) &&
      Math.max(0, nowMs - publishedAt) <= ONS_MAX_PUBLICATION_AGE_MS
    );
  });
}

async function buildCurrentEconomicIndicators(
  fetchImpl = fetch,
  nowProvider = () => new Date()
) {
  const now = nowProvider();
  const data = await buildEconomicIndicators(fetchImpl, () => now);
  if (!isEconomicIndicatorsPayload(data, now) || !publicationCurrent(data, now)) {
    throw new Error("Official indicator series are outside their currentness contract");
  }
  return data;
}

// observationFor moved VERBATIM from worker/series-entry.js — the sentimentPulse
// section built its own three-series observation summary here (the shared
// observation-contract's sentimentPulse rule expects a different, retired
// economicData shape, so sentimentPulse must NOT be routed through it).
function observationFor(data) {
  const observedAt = Object.values(data.series)
    .map((series) => series.observedAt)
    .sort()
    .at(-1);
  const checkedAt = Object.values(data.series)
    .map((series) => series.retrievedAt)
    .sort()
    .at(-1);
  const period = data.order
    .map((id) => `${data.series[id].shortLabel} ${data.series[id].period}`)
    .join(" · ");

  return {
    status: "current",
    period,
    observedAt,
    checkedAt,
    maxAgeDays: 75,
  };
}

// ---------------------------------------------------------------------------
// Validators moved VERBATIM from worker/debt-entry.js
// ---------------------------------------------------------------------------

function validDateOnly(value) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

function validDebtPayload(data, now = new Date()) {
  const nowMs = now.getTime();
  const publishedAt = validDateOnly(data?.publicationDate) ? Date.parse(`${data.publicationDate}T00:00:00.000Z`) : Number.NaN;
  return (
    Number.isFinite(nowMs) &&
    data?.series?.debt === "HF6W" &&
    data?.series?.debtToGdp === "HF6X" &&
    typeof data?.baseDebt === "number" && Number.isFinite(data.baseDebt) && data.baseDebt > 0 &&
    typeof data?.baseDate === "number" && Number.isFinite(data.baseDate) &&
    typeof data?.debtToGdp === "number" && Number.isFinite(data.debtToGdp) &&
    typeof data?.observationPeriod === "string" && /^\d{4}\s+[A-Z]{3}$/.test(data.observationPeriod) &&
    Number.isFinite(publishedAt) && Math.max(0, nowMs - publishedAt) <= DEBT_MAX_PUBLICATION_AGE_MS &&
    typeof data?.revisionStatus === "string" && data.revisionStatus.trim().length > 0 &&
    data?.source?.publisher === "Office for National Statistics" &&
    data?.source?.debtUrl === DEBT_SERIES_URL && data?.source?.debtToGdpUrl === DEBT_GDP_SERIES_URL &&
    Array.isArray(data?.history) && data.history.length >= 13 && data.history.at(-1)?.observedAt === data.baseDate &&
    Number.isFinite(data?.annualDelta?.debtBillion) && Number.isFinite(data?.annualDelta?.debtToGdpPoints)
  );
}

// ---------------------------------------------------------------------------
// Internal descriptor map.
//
// gdpTracker / employmentStats / migrationStats keep the SAME __observation +
// expiresAt decoration and the SAME currentness gate they had in the doll by
// reusing the shared observation-contract wrapper. sentimentPulse is validated
// by buildCurrentEconomicIndicators (moved above) and observation-decorated by
// the same wrapper; its raw build is fixed here so applyObservationContracts
// finds a build to wrap. crimeStatistics and nationalDebt are decorated
// bespoke (see the builders below) and are excluded from the shared descriptor
// wrapping so their behaviour matches the doll exactly.
// ---------------------------------------------------------------------------

const GENERIC_SECTIONS = Object.freeze([
  "gdpTracker",
  "sentimentPulse",
  "employmentStats",
  "nationalDebt",
  "migrationStats",
  "realWages",
  "crimeStatistics",
]);

function sectionLabel(section) {
  return FEED_REGISTRY[section].upstreams.map((upstream) => upstream.label).join(" + ");
}

// A descriptor map limited to the sections whose observation contract we reuse.
// Building this locally (instead of importing the doll's) keeps the flat module
// free of the deleted index.js/entry.js while preserving the observation-gate
// behaviour verbatim.
const observationDescriptors = Object.fromEntries(
  Object.keys(FEED_REGISTRY).map((section) => [
    section,
    {
      section,
      source: sectionLabel(section),
      registry: provenanceFor(section),
      ingestOnly: false,
      freshTtlSeconds: Math.floor(FEED_REGISTRY[section].retrievalMaxAgeMs / 1000),
      staleTtlSeconds: Math.floor(FEED_REGISTRY[section].retrievalMaxAgeMs / 1000),
      build: async () => {
        throw new Error(`Section '${section}' has no configured builder`);
      },
    },
  ])
);

observationDescriptors.gdpTracker.build = buildGdpTracker;
observationDescriptors.employmentStats.build = buildEmploymentStats;
observationDescriptors.migrationStats.build = buildMigrationStats;
observationDescriptors.realWages.build = buildRealWagesStats;
observationDescriptors.nationalDebt.build = buildNationalDebt;
observationDescriptors.sentimentPulse.build = () => buildCurrentEconomicIndicators(fetch);
observationDescriptors.taxRevenue.build = async () => {
  throw new Error("taxRevenue is served by the live collector, not this map");
};
observationDescriptors.crimeStatistics.build = (now = new Date()) =>
  buildCrimeStatistics(now, fetch);
observationDescriptors.electionPolling.build = async () => {
  throw new Error("electionPolling is served by the live collector, not this map");
};
observationDescriptors.nhsStats.build = async () => {
  throw new Error("nhsStats is served by the live collector, not this map");
};
observationDescriptors.bettingOdds.build = async () => {
  throw new Error("bettingOdds is served by the live collector, not this map");
};

applyFeedRegistry(observationDescriptors);
applyFreshnessPolicy(observationDescriptors);
applyObservationContracts(observationDescriptors);

// ---------------------------------------------------------------------------
// Record assembly. Mirrors publication-entry.js's former sourceMetaFromPayload
// so the merged snapshot's meta.sources[section] shape is unchanged.
// ---------------------------------------------------------------------------

function sectionRecord(section, data, backend, now) {
  const provenance = provenanceFor(section);
  const fetchedAt = now.toISOString();
  return {
    section,
    data,
    source: {
      status: "ok",
      cacheState: "fresh",
      fetchedAt,
      backend,
      source: provenance?.upstreams?.map((item) => item.label).join(" + ") ?? sectionLabel(section),
      provenance,
    },
    fetchedAt,
    sourceLabel: sectionLabel(section),
    backend,
  };
}

// ---------------------------------------------------------------------------
// The flat SECTION_BUILDERS map. Each value is async (section, now) => record.
// The record is the same shape refreshSectionPayload returned via the doll.
// ---------------------------------------------------------------------------

async function buildGenericObservationSection(section, backend, now) {
  // observationDescriptors[section].build is the observation-contract-wrapped
  // build: it throws fail-closed when the feed is outside its currentness
  // contract and returns data already carrying __observation (+ expiresAt).
  const data = await observationDescriptors[section].build();
  return sectionRecord(section, { ...data, __provenance: provenanceFor(section) }, backend, now);
}

async function buildSentimentPulse(now) {
  // Reproduce worker/series-entry.js verbatim: build + currentness gate, then
  // decorate with the section's own three-series observation and provenance
  // (dataWithEvidence). NOT the shared observation contract, whose sentimentPulse
  // rule targets a retired data shape.
  const data = await buildCurrentEconomicIndicators(fetch, () => now);
  const decorated = {
    ...data,
    __observation: observationFor(data),
    __provenance: provenanceFor("sentimentPulse"),
  };
  return sectionRecord("sentimentPulse", decorated, "verified-data-service-series-contract", now);
}

async function buildNationalDebtSection(now) {
  const data = await buildNationalDebt(fetch);
  if (!validDebtPayload(data, now)) {
    throw new Error("National debt evidence is outside its editorial contract");
  }
  // observationFor moved VERBATIM from worker/debt-entry.js dataWithEvidence().
  const decorated = {
    ...data,
    __observation: {
      status: "current",
      period: data.observationPeriod,
      observedAt: new Date(data.baseDate).toISOString(),
      checkedAt: now.toISOString(),
      maxAgeDays: 75,
    },
    __provenance: provenanceFor("nationalDebt"),
  };
  return sectionRecord("nationalDebt", decorated, "verified-data-service-editorial-contract", now);
}

async function buildCrimeStatisticsSection(now) {
  const data = await buildCrimeStatistics(now, fetch);
  if (!isCurrentCrimeStatisticsPayload(data, now)) {
    throw new Error("Crime evidence is outside its modular publication contract");
  }
  return sectionRecord("crimeStatistics", { ...data, __provenance: provenanceFor("crimeStatistics") }, "cloudflare-official-publication", now);
}

const SECTION_BUILDERS = Object.freeze({
  gdpTracker: (now = new Date()) =>
    buildGenericObservationSection("gdpTracker", "verified-data-service", now),
  employmentStats: (now = new Date()) =>
    buildGenericObservationSection("employmentStats", "verified-data-service", now),
  migrationStats: (now = new Date()) =>
    buildGenericObservationSection("migrationStats", "verified-data-service", now),
  realWages: (now = new Date()) =>
    buildGenericObservationSection("realWages", "verified-data-service", now),
  sentimentPulse: (now = new Date()) => buildSentimentPulse(now),
  nationalDebt: (now = new Date()) => buildNationalDebtSection(now),
  crimeStatistics: (now = new Date()) => buildCrimeStatisticsSection(now),
});

export {
  GENERIC_SECTIONS,
  SECTION_BUILDERS,
  buildCurrentEconomicIndicators,
  isOfficialEconomyRecord,
  publicationCurrent,
  validDateOnly,
  validDebtPayload,
};
