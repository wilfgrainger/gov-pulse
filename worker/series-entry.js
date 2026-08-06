import worker, { sectionDescriptors } from "./evidence-entry.js";
import {
  buildEconomicIndicators,
  isEconomicIndicatorsPayload,
} from "./economic-indicators.js";

const SECTION = "sentimentPulse";
const CACHE_KEY = "v10:section:sentimentPulse";
const ONS_MAX_PUBLICATION_AGE_MS = 75 * 24 * 60 * 60 * 1000;
let inMemoryRecord = null;

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

sectionDescriptors[SECTION].build = buildCurrentEconomicIndicators;

function json(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  if (!headers.has("Access-Control-Allow-Origin")) {
    headers.set("Access-Control-Allow-Origin", "*");
  }
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function rewriteResponse(response, payload, status = response.status) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return json(payload, { status, headers });
}

async function readRecord(env) {
  if (env?.METRICS_CACHE?.get) {
    try {
      return await env.METRICS_CACHE.get(CACHE_KEY, "json");
    } catch (error) {
      console.warn("public-data.org could not read the series-level indicator cache", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
  return inMemoryRecord;
}

async function writeRecord(env, record) {
  if (env?.METRICS_CACHE?.put) {
    await env.METRICS_CACHE.put(CACHE_KEY, JSON.stringify(record));
  } else {
    inMemoryRecord = record;
  }
}

function freshTtlSeconds() {
  const value = sectionDescriptors[SECTION]?.freshTtlSeconds;
  return Number.isFinite(value) && value > 0 ? value : 36 * 60 * 60;
}

function isCurrentRecord(record, now = new Date()) {
  if (
    !record ||
    record.section !== SECTION ||
    !isEconomicIndicatorsPayload(record.data, now) ||
    !publicationCurrent(record.data, now)
  ) {
    return false;
  }

  const fetchedAt = Date.parse(record.fetchedAt ?? "");
  const nowMs = now.getTime();
  return (
    Number.isFinite(fetchedAt) &&
    Number.isFinite(nowMs) &&
    Math.max(0, nowMs - fetchedAt) <= freshTtlSeconds() * 1000
  );
}

async function currentRecord(env, now = new Date()) {
  const record = await readRecord(env);
  return isCurrentRecord(record, now) ? record : null;
}

async function refreshRecord(env, nowProvider = () => new Date()) {
  const now = nowProvider();
  const data = await buildCurrentEconomicIndicators(fetch, () => now);
  const record = {
    section: SECTION,
    data,
    fetchedAt: now.toISOString(),
    sourceLabel: sectionDescriptors[SECTION].source,
    backend: "verified-data-service-series-contract",
  };
  await writeRecord(env, record);
  return record;
}

async function ensureRecord(env, nowProvider = () => new Date()) {
  const now = nowProvider();
  const cached = await currentRecord(env, now);
  return cached ?? refreshRecord(env, () => now);
}

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

function dataWithEvidence(record) {
  return {
    ...record.data,
    __observation: observationFor(record.data),
    __provenance: sectionDescriptors[SECTION].registry,
  };
}

function sectionPayload(record) {
  const provenance = sectionDescriptors[SECTION].registry;
  return {
    section: SECTION,
    data: dataWithEvidence(record),
    source: "worker",
    timestamp: record.fetchedAt,
    cacheState: "fresh",
    backend: record.backend,
    provenance,
  };
}

async function sectionResponse(env) {
  try {
    const record = await ensureRecord(env);
    return json(sectionPayload(record), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    return json(
      {
        error: `Unable to fetch section '${SECTION}'`,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function parseJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) return null;
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function sourceMeta(record) {
  return {
    status: "ok",
    cacheState: "fresh",
    fetchedAt: record.fetchedAt,
    backend: record.backend,
    source: record.sourceLabel,
    provenance: sectionDescriptors[SECTION].registry,
  };
}

async function enforceCombinedDataset(response, env) {
  if (!response.ok) return response;
  const payload = await parseJson(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return response;

  if (!payload.meta || typeof payload.meta !== "object" || Array.isArray(payload.meta)) {
    payload.meta = {};
  }
  if (
    !payload.meta.sources ||
    typeof payload.meta.sources !== "object" ||
    Array.isArray(payload.meta.sources)
  ) {
    payload.meta.sources = {};
  }

  try {
    const record = await ensureRecord(env);
    payload[SECTION] = dataWithEvidence(record);
    payload.meta.sources[SECTION] = sourceMeta(record);
  } catch (error) {
    delete payload[SECTION];
    payload.meta.sources[SECTION] = {
      status: "error",
      cacheState: "missing",
      fetchedAt: null,
      source: sectionDescriptors[SECTION].source,
      error: error instanceof Error ? error.message : "Unknown error",
      provenance: sectionDescriptors[SECTION].registry,
    };
  }

  return rewriteResponse(response, payload);
}

function healthEntry(record, nowMs = Date.now()) {
  const ttl = freshTtlSeconds();
  if (!record || !isCurrentRecord(record, new Date(nowMs))) {
    return {
      section: SECTION,
      status: "expired",
      healthy: false,
      source: sectionDescriptors[SECTION].source,
      fetchedAt: null,
      ageSeconds: null,
      cacheState: "expired",
      freshTtlSeconds: ttl,
      staleTtlSeconds: ttl,
      ingestOnly: false,
      error: "No current verified series-level indicator record is available",
    };
  }

  return {
    section: SECTION,
    status: "ok",
    healthy: true,
    source: record.sourceLabel,
    fetchedAt: record.fetchedAt,
    ageSeconds: Math.max(
      0,
      Math.floor((nowMs - Date.parse(record.fetchedAt)) / 1000)
    ),
    cacheState: "fresh",
    freshTtlSeconds: ttl,
    staleTtlSeconds: ttl,
    ingestOnly: false,
    error: null,
  };
}

function summarize(sources) {
  const values = Object.values(sources ?? {});
  const counts = {
    total: values.length,
    ok: values.filter((entry) => entry?.status === "ok").length,
    stale: values.filter((entry) => entry?.status === "stale").length,
    expired: values.filter((entry) => entry?.status === "expired").length,
    missing: values.filter((entry) => entry?.status === "missing").length,
    error: values.filter((entry) => entry?.status === "error").length,
  };
  return {
    counts,
    healthy: counts.total > 0 && counts.ok === counts.total,
  };
}

async function enforceHealth(request, response, env) {
  const payload = await parseJson(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return response;

  if (!payload.sources || typeof payload.sources !== "object" || Array.isArray(payload.sources)) {
    payload.sources = {};
  }

  let record = null;
  try {
    record = await ensureRecord(env);
  } catch (error) {
    console.warn("public-data.org could not refresh series-level indicators during health evaluation", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  payload.sources[SECTION] = healthEntry(record);
  payload.sections = payload.sources;

  const summary = summarize(payload.sources);
  payload.counts = summary.counts;
  payload.healthy = summary.healthy;
  payload.sourceStatus = summary.healthy ? "ok" : "degraded";
  payload.status = "ok";

  const strict = new URL(request.url).searchParams.get("strict") === "1";
  return rewriteResponse(response, payload, strict && !summary.healthy ? 503 : 200);
}

const seriesWorker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return worker.fetch(request, env, ctx);

    const url = new URL(request.url);
    if (url.pathname === "/metrics" && url.searchParams.get("section") === SECTION) {
      return sectionResponse(env);
    }

    const response = await worker.fetch(request, env, ctx);
    if (url.pathname === "/all") {
      return enforceCombinedDataset(response, env);
    }
    if (url.pathname === "/health") {
      return enforceHealth(request, response, env);
    }
    return response;
  },

  scheduled(controller, env, ctx) {
    return worker.scheduled(controller, env, ctx);
  },
};

export {
  buildCurrentEconomicIndicators,
  currentRecord,
  dataWithEvidence,
  enforceCombinedDataset,
  enforceHealth,
  ensureRecord,
  healthEntry,
  isCurrentRecord,
  observationFor,
  publicationCurrent,
  readRecord,
  refreshRecord,
  sectionDescriptors,
  sectionPayload,
  summarize,
  writeRecord,
};
export default seriesWorker;
