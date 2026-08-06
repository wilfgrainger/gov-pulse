import editorialWorker, { sectionDescriptors } from "./editorial-entry.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";
import { FEED_REGISTRY_VERSION } from "./feed-registry.js";
import { collectTaxRevenue } from "./live-tax-revenue-collector.js";
import {
  CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY,
  MAX_REQUESTS_PER_RUN as CONTRACT_MAX_REQUESTS_PER_RUN,
  refreshGovernmentContracts,
} from "./government-contracts-cloudflare.js";

const PUBLICATION_CURRENT_KEY = "v12:publication:current";
const PUBLICATION_STATUS_KEY = "v12:publication:status";
const PUBLICATION_HISTORY_PREFIX = "v12:publication:history:";
const PUBLICATION_HISTORY_TTL_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_SEED_URL = "https://public-data-org.pages.dev/data/metrics-snapshot.json";
const ROTATION = Object.freeze([
  ["gdpTracker", "sentimentPulse"],
  ["employmentStats", "taxRevenue"],
  ["nationalDebt", "migrationStats"],
  ["gdpTracker", "sentimentPulse"],
  ["employmentStats", "taxRevenue"],
  ["nationalDebt", "crimeStatistics"],
  ["migrationStats", "crimeStatistics"],
]);
const BOOTSTRAP_SECTIONS = Object.freeze([
  "gdpTracker",
  "sentimentPulse",
  "employmentStats",
  "taxRevenue",
  "nationalDebt",
  "migrationStats",
  "crimeStatistics",
]);

const FREE_TIER_BUDGET = Object.freeze({
  cronInvocationsPerDay: 1,
  officialSectionsPerDay: 2,
  contractRequestsPerDayMax: CONTRACT_MAX_REQUESTS_PER_RUN,
  kvWritesPerDayTargetMax: 12,
  kvReadsPerDayTargetMax: 40,
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSnapshot(value) {
  return (
    isRecord(value) &&
    isRecord(value.meta) &&
    value.meta.registryVersion === FEED_REGISTRY_VERSION &&
    isRecord(value.meta.sources)
  );
}

function json(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  }
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(JSON.stringify(payload), { ...init, headers });
}

async function kvGet(env, key) {
  return env?.METRICS_CACHE?.get ? env.METRICS_CACHE.get(key, "json") : null;
}

async function kvPut(env, key, value, options) {
  if (!env?.METRICS_CACHE?.put) throw new Error("METRICS_CACHE KV binding is required");
  await env.METRICS_CACHE.put(key, JSON.stringify(value), options);
}

function rotationIndex(now = new Date()) {
  const day = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
      (24 * 60 * 60 * 1000)
  );
  return ((day % ROTATION.length) + ROTATION.length) % ROTATION.length;
}

function sectionsForDay(now = new Date()) {
  return [...ROTATION[rotationIndex(now)]];
}

async function fetchSeedSnapshot(env, fetchImpl = fetch) {
  const url = String(env?.STATIC_SNAPSHOT_SEED_URL || DEFAULT_SEED_URL).trim();
  if (!url) return null;
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    assertSameHttpsHost(response, url, "Pages seed");
    const payload = await readResponseJson(response, { label: "Pages seed JSON" });
    return isSnapshot(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function readCurrentPublication(env) {
  const payload = await kvGet(env, PUBLICATION_CURRENT_KEY);
  return isSnapshot(payload) ? payload : null;
}

function sourceMetaFromPayload(payload) {
  return {
    status: "ok",
    cacheState: payload.cacheState ?? "fresh",
    fetchedAt: payload.timestamp ?? null,
    backend: payload.backend ?? "cloudflare-worker",
    source:
      payload.provenance?.upstreams?.map((item) => item.label).join(" + ") ||
      sectionDescriptors[payload.section]?.source ||
      "Cloudflare data worker",
    provenance: payload.provenance ?? sectionDescriptors[payload.section]?.registry ?? null,
  };
}

async function refreshSectionPayload(section, env, ctx) {
  if (section === "taxRevenue") {
    return collectTaxRevenue(fetch, new Date());
  }

  const response = await editorialWorker.fetch(
    new Request(`https://data-worker.internal/metrics?section=${encodeURIComponent(section)}`),
    env,
    ctx
  );
  if (!response.ok) throw new Error(`${section} returned ${response.status}`);
  const payload = await readResponseJson(response, { label: `${section} internal JSON` });
  if (payload?.section !== section || !isRecord(payload?.data)) {
    throw new Error(`${section} returned an invalid section payload`);
  }
  return {
    section,
    data: payload.data,
    source: sourceMetaFromPayload(payload),
    fetchedAt: payload.timestamp ?? null,
  };
}

async function refreshSections(sections, env, ctx) {
  const records = [];
  const results = [];
  for (const section of sections) {
    try {
      const record = await refreshSectionPayload(section, env, ctx);
      records.push(record);
      results.push({ section, status: "ok", fetchedAt: record.fetchedAt });
    } catch (error) {
      results.push({
        section,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { records, results };
}

function mergePublication(previous, refreshedRecords, contractsRecord, now = new Date()) {
  const base = isSnapshot(previous)
    ? structuredClone(previous)
    : {
        meta: {
          registryVersion: FEED_REGISTRY_VERSION,
          sources: {},
        },
      };

  for (const record of refreshedRecords ?? []) {
    if (!record?.section || !isRecord(record.data)) continue;
    base[record.section] = record.data;
    base.meta.sources[record.section] = record.source;
  }

  if (contractsRecord?.data) {
    base.governmentContracts = contractsRecord.data;
    base.meta.sources.governmentContracts = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt: contractsRecord.fetchedAt,
      backend: contractsRecord.backend,
      source: contractsRecord.sourceLabel,
      provenance: {
        registryVersion: FEED_REGISTRY_VERSION,
        section: "governmentContracts",
        title: "Government contract award releases",
        evidenceClass: "official-data",
        geography: "United Kingdom",
        retrieval: "cloudflare-daily-shards",
        refreshCadence: "daily",
        publicationCadence: "continuous notice publication",
        operationalStatus: "active",
        publicationRequirement: "optional",
        upstreams: [
          {
            publisher: "Cabinet Office",
            label: "Find a Tender OCDS award releases",
            url: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
            sourceClass: "official-primary",
          },
        ],
      },
    };
  }

  base.meta = {
    ...base.meta,
    registryVersion: FEED_REGISTRY_VERSION,
    generatedAt: now.toISOString(),
    fetchedAt: now.toISOString(),
    generator: "cloudflare-free-publication-worker",
    backend: "cloudflare-worker-kv",
    publicationMode: "daily-rotating-free-tier",
    freeTierBudget: FREE_TIER_BUDGET,
  };
  return base;
}

async function runPublicationCycle(env, ctx, options = {}) {
  const now = options.now ?? new Date();
  const current = await readCurrentPublication(env);
  const seed = current ?? (await fetchSeedSnapshot(env, options.fetchImpl ?? fetch));
  const bootstrap = options.bootstrap === true || !seed;
  const selected = bootstrap ? BOOTSTRAP_SECTIONS : sectionsForDay(now);
  const refreshed = await refreshSections(selected, env, ctx);

  let contractResult;
  try {
    contractResult = await refreshGovernmentContracts(env, {
      now,
      fetchImpl: options.fetchImpl,
    });
  } catch (error) {
    contractResult = {
      updated: false,
      collected: [],
      completeDays: 0,
      requestsMade: 0,
      error: error instanceof Error ? error.message : String(error),
      record: await kvGet(env, CONTRACT_CURRENT_RECORD_KEY),
    };
  }

  const publication = mergePublication(seed, refreshed.records, contractResult.record, now);
  if (!isSnapshot(publication)) throw new Error("Publication snapshot failed schema validation");

  await kvPut(env, PUBLICATION_CURRENT_KEY, publication);
  await kvPut(
    env,
    `${PUBLICATION_HISTORY_PREFIX}${now.toISOString().slice(0, 10)}`,
    publication,
    { expirationTtl: PUBLICATION_HISTORY_TTL_SECONDS }
  );

  const status = {
    status: "ok",
    generatedAt: publication.meta.generatedAt,
    bootstrap,
    refreshedSections: refreshed.results,
    contracts: {
      updated: contractResult.updated === true,
      collectedDays: contractResult.collected ?? [],
      completeDays: contractResult.completeDays ?? 0,
      requestsMade: contractResult.requestsMade ?? 0,
      error: contractResult.error ?? null,
    },
    budget: FREE_TIER_BUDGET,
  };
  await kvPut(env, PUBLICATION_STATUS_KEY, status);
  return { publication, status };
}

async function publicationResponse(request, env, ctx) {
  let publication = await readCurrentPublication(env);
  if (!publication) {
    const result = await runPublicationCycle(env, ctx, { bootstrap: true });
    publication = result.publication;
  }
  const headers = {
    "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    ETag: `W/"${publication.meta.generatedAt ?? "current"}"`,
  };
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return json(publication, { headers });
}

const publicationWorker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      url.pathname === "/data/metrics-snapshot.json"
    ) {
      try {
        return await publicationResponse(request, env, ctx);
      } catch (error) {
        return json(
          {
            error: "Cloudflare data publication is temporarily unavailable",
            details: error instanceof Error ? error.message : String(error),
          },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
    return editorialWorker.fetch(request, env, ctx);
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runPublicationCycle(env, ctx).catch((error) => {
        console.error("Cloudflare daily publication cycle failed", {
          cron: controller.cron,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  },
};

export {
  BOOTSTRAP_SECTIONS,
  FREE_TIER_BUDGET,
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_HISTORY_PREFIX,
  PUBLICATION_STATUS_KEY,
  ROTATION,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
  refreshSectionPayload,
  refreshSections,
  rotationIndex,
  runPublicationCycle,
  sectionsForDay,
};
export default publicationWorker;
