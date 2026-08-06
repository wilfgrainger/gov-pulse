import worker, { sectionDescriptors } from "./index.js";
import {
  buildEmploymentStats,
  buildGdpTracker,
  buildTaxRevenue,
} from "./economy-evidence.js";
import {
  MANAGED_SECTIONS,
  createEconomySectionCache,
} from "./economy-section-cache.js";
import { applyFreshnessPolicy } from "./freshness-policy.js";
import { buildMigrationStats } from "./migration.js";
import { buildNationalDebt } from "./national-debt.js";
import { buildCrimeStatistics } from "./crime-statistics.js";
import { applyObservationContracts } from "./observation-contract.js";
import {
  FEED_REGISTRY_VERSION,
  applyFeedRegistry,
  provenanceFor,
  registrySnapshot,
} from "./feed-registry.js";
import {
  DEFAULT_FRESH_TTL_SECONDS,
  DEFAULT_STALE_TTL_SECONDS,
  buildHealthReport,
  logHealthReport,
  readManifest,
  renderHealthPage,
  strictHealthStatus,
} from "./health-report.js";

const NATIONAL_DEBT_CACHE_KEY = "v10:section:nationalDebt";
const MIGRATION_CACHE_KEY = "v10:section:migrationStats";
const CRIME_CACHE_KEY = "v10:section:crimeStatistics";
let inMemoryNationalDebtRecord = null;
let inMemoryMigrationRecord = null;
let inMemoryCrimeRecord = null;

sectionDescriptors.gdpTracker.build = buildGdpTracker;
sectionDescriptors.employmentStats.build = buildEmploymentStats;
sectionDescriptors.taxRevenue.build = buildTaxRevenue;
sectionDescriptors.nationalDebt.build = buildNationalDebt;
sectionDescriptors.migrationStats.build = buildMigrationStats;
sectionDescriptors.crimeStatistics.build = buildCrimeStatistics;
applyFeedRegistry(sectionDescriptors);
applyFreshnessPolicy(sectionDescriptors);
applyObservationContracts(sectionDescriptors);
const economySectionCache = createEconomySectionCache(sectionDescriptors);

function json(payload, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=300");
  }
  if (!headers.has("Access-Control-Allow-Origin")) {
    headers.set("Access-Control-Allow-Origin", "*");
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function configuredTtl(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isOfficialNationalDebtRecord(record) {
  return (
    record?.data?.series?.debt === "HF6W" &&
    record?.data?.series?.debtToGdp === "HF6X" &&
    Number.isFinite(record?.data?.baseDebt) &&
    Number.isFinite(record?.data?.baseDate) &&
    Number.isFinite(record?.data?.debtToGdp) &&
    Array.isArray(record?.data?.history) &&
    record.data.history.length >= 13 &&
    Number.isFinite(record?.data?.annualDelta?.debtBillion) &&
    Number.isFinite(record?.data?.annualDelta?.debtToGdpPoints)
  );
}

function isOfficialMigrationRecord(record) {
  const headline = record?.data?.headline;
  return (
    typeof record?.data?.source?.edition === "string" &&
    /^yearending[a-z]+\d{4}$/i.test(record.data.source.edition) &&
    Number.isFinite(headline?.netMigration) &&
    Number.isFinite(headline?.immigration) &&
    Number.isFinite(headline?.emigration) &&
    headline.immigration - headline.emigration === headline.netMigration &&
    Number.isFinite(headline?.observedAt) &&
    typeof headline?.releaseDate === "string" &&
    Array.isArray(record?.data?.history) &&
    record.data.history.length >= 2 &&
    Number.isFinite(record?.data?.annualDelta?.immigration) &&
    Number.isFinite(record?.data?.annualDelta?.emigration) &&
    Number.isFinite(record?.data?.annualDelta?.netMigration)
  );
}

function isOfficialCrimeRecord(record) {
  return (
    Array.isArray(record?.data?.crimeSurveyVictimisation?.overall) &&
    record.data.crimeSurveyVictimisation.overall.length > 0 &&
    Array.isArray(record?.data?.policeRecordedCrime) &&
    record.data.policeRecordedCrime.length > 0 &&
    Array.isArray(record?.data?.justiceOutcomes?.caseProcessingTime) &&
    record.data.justiceOutcomes.caseProcessingTime.length > 0
  );
}

function isFreshRecord(record, section, validator, nowMs = Date.now()) {
  if (!validator(record)) {
    return false;
  }

  const fetchedAt = Date.parse(record?.fetchedAt ?? "");
  const freshTtlMs =
    (sectionDescriptors[section].freshTtlSeconds ?? DEFAULT_FRESH_TTL_SECONDS) * 1000;
  return Number.isFinite(fetchedAt) && Math.max(0, nowMs - fetchedAt) <= freshTtlMs;
}

function isFreshNationalDebtRecord(record, nowMs = Date.now()) {
  return isFreshRecord(record, "nationalDebt", isOfficialNationalDebtRecord, nowMs);
}

function isFreshMigrationRecord(record, nowMs = Date.now()) {
  return isFreshRecord(record, "migrationStats", isOfficialMigrationRecord, nowMs);
}

function isFreshCrimeRecord(record, nowMs = Date.now()) {
  return isFreshRecord(record, "crimeStatistics", isOfficialCrimeRecord, nowMs);
}

async function readCachedRecord(env, key, memoryValue, label) {
  if (env?.METRICS_CACHE?.get) {
    try {
      return await env.METRICS_CACHE.get(key, "json");
    } catch (error) {
      console.warn(`public-data.org could not read the ${label} cache during migration`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  return memoryValue;
}

async function writeCachedRecord(env, key, record, setMemory) {
  if (env?.METRICS_CACHE?.put) {
    await env.METRICS_CACHE.put(key, JSON.stringify(record));
  } else {
    setMemory(record);
  }
}

async function ensureOfficialRecord({
  env,
  section,
  key,
  memoryValue,
  setMemory,
  isFresh,
}) {
  const cached = await readCachedRecord(env, key, memoryValue, section);
  if (isFresh(cached)) {
    return cached;
  }

  const data = await sectionDescriptors[section].build();
  const record = {
    section,
    data,
    fetchedAt: new Date().toISOString(),
    sourceLabel: sectionDescriptors[section].source,
    backend: "verified-data-service",
  };
  await writeCachedRecord(env, key, record, setMemory);
  return record;
}

function ensureOfficialNationalDebtRecord(env) {
  return ensureOfficialRecord({
    env,
    section: "nationalDebt",
    key: NATIONAL_DEBT_CACHE_KEY,
    memoryValue: inMemoryNationalDebtRecord,
    setMemory: (record) => {
      inMemoryNationalDebtRecord = record;
    },
    isFresh: isFreshNationalDebtRecord,
  });
}

function ensureOfficialMigrationRecord(env) {
  return ensureOfficialRecord({
    env,
    section: "migrationStats",
    key: MIGRATION_CACHE_KEY,
    memoryValue: inMemoryMigrationRecord,
    setMemory: (record) => {
      inMemoryMigrationRecord = record;
    },
    isFresh: isFreshMigrationRecord,
  });
}

function ensureOfficialCrimeRecord(env) {
  return ensureOfficialRecord({
    env,
    section: "crimeStatistics",
    key: CRIME_CACHE_KEY,
    memoryValue: inMemoryCrimeRecord,
    setMemory: (record) => {
      inMemoryCrimeRecord = record;
    },
    isFresh: isFreshCrimeRecord,
  });
}

async function healthReport(env) {
  const manifest = await readManifest(env);
  return buildHealthReport({
    manifest,
    descriptors: sectionDescriptors,
    defaultFreshTtlSeconds: configuredTtl(
      env?.DATA_REFRESH_TTL_SECONDS,
      DEFAULT_FRESH_TTL_SECONDS
    ),
    defaultStaleTtlSeconds: configuredTtl(
      env?.DATA_STALE_TTL_SECONDS,
      DEFAULT_STALE_TTL_SECONDS
    ),
  });
}

async function decorateJsonResponse(request, response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }

  const url = new URL(request.url);
  if (!["/health", "/metrics", "/all"].includes(url.pathname)) {
    return response;
  }

  let payload;
  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response;
  }

  if (url.pathname === "/health") {
    payload.registryVersion = FEED_REGISTRY_VERSION;
    payload.feedCount = Object.keys(sectionDescriptors).length;
  }

  if (url.pathname === "/metrics" && payload?.section) {
    const provenance = provenanceFor(payload.section);
    payload.provenance = provenance;
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      payload.data = { ...payload.data, __provenance: provenance };
    }
  }

  if (url.pathname === "/all") {
    const existingMeta =
      payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta)
        ? payload.meta
        : {};
    payload.meta = {
      ...existingMeta,
      registryVersion: FEED_REGISTRY_VERSION,
    };

    for (const section of Object.keys(sectionDescriptors)) {
      const provenance = provenanceFor(section);
      const sourceMeta = payload.meta?.sources?.[section];
      if (sourceMeta && typeof sourceMeta === "object" && !Array.isArray(sourceMeta)) {
        payload.meta.sources[section] = {
          ...sourceMeta,
          provenance,
        };
      }
      if (payload[section] && typeof payload[section] === "object" && !Array.isArray(payload[section])) {
        payload[section] = {
          ...payload[section],
          __provenance: provenance,
        };
      }
    }
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return json(payload, { status: response.status, headers });
}

async function officialSectionResponse(request, env, section, ensureRecord) {
  try {
    const record = await ensureRecord(env);
    return decorateJsonResponse(
      request,
      json(
        {
          section,
          data: record.data,
          source: "worker",
          timestamp: record.fetchedAt,
          cacheState: "fresh",
          backend: record.backend,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          },
        }
      )
    );
  } catch (error) {
    return json(
      {
        error: `Unable to fetch section '${section}'`,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function handleFetch(request, env, ctx) {
  if (request.method === "OPTIONS") {
    return worker.fetch(request, env, ctx);
  }

  const url = new URL(request.url);

  if (url.pathname === "/registry") {
    return json(registrySnapshot());
  }

  if (url.pathname === "/health") {
    const report = await healthReport(env);
    const strict = url.searchParams.get("strict") === "1";
    const sectionNames = Object.keys(sectionDescriptors);
    return json(
      {
        ...report,
        status: "ok",
        sourceStatus: report.status,
        cache: env?.METRICS_CACHE ? "persistent" : "memory",
        registryVersion: FEED_REGISTRY_VERSION,
        feedCount: sectionNames.length,
        sections: sectionNames,
        sources: report.sections,
      },
      {
        status: strictHealthStatus(report, strict),
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  if (url.pathname === "/status") {
    const report = await healthReport(env);
    return new Response(renderHealthPage(report), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (url.pathname === "/metrics") {
    const section = url.searchParams.get("section");
    if (section && MANAGED_SECTIONS.has(section)) {
      return officialSectionResponse(
        request,
        env,
        section,
        (runtimeEnv) => economySectionCache.ensure(section, runtimeEnv)
      );
    }
    if (section === "nationalDebt") {
      return officialSectionResponse(
        request,
        env,
        "nationalDebt",
        ensureOfficialNationalDebtRecord
      );
    }
    if (section === "migrationStats") {
      return officialSectionResponse(
        request,
        env,
        "migrationStats",
        ensureOfficialMigrationRecord
      );
    }
    if (section === "crimeStatistics") {
      return officialSectionResponse(
        request,
        env,
        "crimeStatistics",
        ensureOfficialCrimeRecord
      );
    }
  }

  const response = await worker.fetch(request, env, ctx);

  if (url.pathname === "/refresh") {
    if (response.ok) {
      logHealthReport("manual-refresh", await healthReport(env));
    } else {
      console.error("public-data.org refresh endpoint failed", { status: response.status });
    }
  }

  return decorateJsonResponse(request, response);
}

const registryAwareWorker = {
  async fetch(request, env, ctx) {
    const response = await handleFetch(request, env, ctx);
    
    // Strict Origin check for CORS policy hardening
    const origin = request.headers.get("Origin");
    if (origin) {
      const allowed =
        origin === "https://public-data.org" ||
        origin === "https://www.public-data.org" ||
        origin.endsWith(".gitlab.io") ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);

      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", allowed ? origin : "https://public-data.org");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },

  async scheduled(controller, env, ctx) {
    const observedCtx = {
      waitUntil(promise) {
        ctx.waitUntil(
          Promise.resolve(promise)
            .then(async () => {
              logHealthReport(`cron:${controller.cron}`, await healthReport(env));
            })
            .catch((error) => {
              console.error("public-data.org scheduled health observation failed", {
                cron: controller.cron,
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            })
        );
      },
    };

    return worker.scheduled(controller, env, observedCtx);
  },
};

export {
  decorateJsonResponse,
  ensureOfficialMigrationRecord,
  ensureOfficialNationalDebtRecord,
  ensureOfficialCrimeRecord,
  healthReport,
  isFreshMigrationRecord,
  isFreshNationalDebtRecord,
  isFreshCrimeRecord,
  isOfficialMigrationRecord,
  isOfficialNationalDebtRecord,
  isOfficialCrimeRecord,
  sectionDescriptors,
};
export default registryAwareWorker;
