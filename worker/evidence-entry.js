import worker, {
  ingestAuthorized,
  sectionDescriptors,
} from "./polling-entry.js";
import {
  isCurrentNhsRttPayload,
  normalizeNhsRttPayload,
} from "./nhs-rtt.js";
import {
  BETTING_SNAPSHOT_KEY,
  BETTING_SNAPSHOT_MAX_AGE_MS,
  isCurrentBettingMarketPayload,
  normalizeBettingMarketPayload,
} from "./betting-markets.js";

const NHS_SECTION = "nhsStats";
const BETTING_SECTION = "bettingOdds";
const BETTING_STORAGE_TTL_SECONDS = 24 * 60 * 60;
const BETTING_FRESH_TTL_SECONDS = BETTING_SNAPSHOT_MAX_AGE_MS / 1000;
let inMemoryBettingRecord = null;

sectionDescriptors[NHS_SECTION].ingestOnly = true;
sectionDescriptors[NHS_SECTION].source = "NHS England RTT statistical press notice";
sectionDescriptors[BETTING_SECTION].ingestOnly = true;
sectionDescriptors[BETTING_SECTION].source = "Oddschecker public politics markets";

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

async function parseRequestJson(request) {
  try {
    return await request.clone().json();
  } catch {
    return null;
  }
}

async function normalizeNhsIngest(request) {
  const payload = await parseRequestJson(request);
  if (String(payload?.section ?? "").trim() !== NHS_SECTION) return null;

  const data = normalizeNhsRttPayload(payload?.data);
  const headers = new Headers(request.headers);
  headers.delete("Content-Length");
  headers.set("Content-Type", "application/json");

  return new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      section: NHS_SECTION,
      data,
      fetchedAt: `${data.headline.publicationDate}T12:00:00.000Z`,
      sourceLabel: sectionDescriptors[NHS_SECTION].source,
      backend: "scheduled-nhs-ingest",
    }),
  });
}

async function normalizeBettingIngest(request, now = new Date()) {
  const payload = await parseRequestJson(request);
  if (String(payload?.section ?? "").trim() !== BETTING_SECTION) return null;

  const data = normalizeBettingMarketPayload(payload?.data, now);
  return {
    section: BETTING_SECTION,
    data,
    fetchedAt: data.observedAt,
    source: sectionDescriptors[BETTING_SECTION].source,
    backend: "scheduled-market-ingest",
  };
}

async function writeBettingRecord(env, record) {
  if (env?.METRICS_CACHE?.put) {
    await env.METRICS_CACHE.put(BETTING_SNAPSHOT_KEY, JSON.stringify(record), {
      expirationTtl: BETTING_STORAGE_TTL_SECONDS,
    });
    return;
  }
  inMemoryBettingRecord = record;
}

async function readBettingRecord(env) {
  let value = null;
  if (env?.METRICS_CACHE?.get) {
    value = await env.METRICS_CACHE.get(BETTING_SNAPSHOT_KEY, "json");
  } else {
    value = inMemoryBettingRecord;
  }

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function currentBettingRecord(env, now = new Date()) {
  const record = await readBettingRecord(env);
  if (
    !record ||
    record.section !== BETTING_SECTION ||
    record.fetchedAt !== record.data?.observedAt ||
    !isCurrentBettingMarketPayload(record.data, now)
  ) {
    return null;
  }
  return record;
}

function bettingPayload(record) {
  const provenance = sectionDescriptors[BETTING_SECTION].registry;
  return {
    section: BETTING_SECTION,
    data: { ...record.data, __provenance: provenance },
    source: "worker",
    timestamp: record.fetchedAt,
    cacheState: "fresh",
    backend: record.backend,
    provenance,
  };
}

async function bettingSectionResponse(env) {
  const record = await currentBettingRecord(env);
  if (!record) {
    return json(
      {
        error: "Unable to fetch section 'bettingOdds'",
        details: "No current verified betting market snapshot is available",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  return json(bettingPayload(record), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}

async function parseJsonOrFail(response, error, details) {
  try {
    return { payload: await response.clone().json(), failure: null };
  } catch {
    return {
      payload: null,
      failure: json(
        { error, details },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
}

async function enforceCurrentNhsRtt(request, response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }

  const url = new URL(request.url);
  if (url.pathname === "/metrics" && url.searchParams.get("section") === NHS_SECTION) {
    const parsed = await parseJsonOrFail(
      response,
      "Unable to fetch section 'nhsStats'",
      "Invalid JSON response from upstream"
    );
    if (parsed.failure) return parsed.failure;
    if (!isCurrentNhsRttPayload(parsed.payload?.data)) {
      return json(
        {
          error: "Unable to fetch section 'nhsStats'",
          details: "No current verified NHS England RTT publication is available",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return response;
  }

  if (url.pathname === "/all") {
    const parsed = await parseJsonOrFail(
      response,
      "Unable to fetch combined metrics",
      "Invalid JSON response from upstream"
    );
    if (parsed.failure) return parsed.failure;
    const payload = parsed.payload;
    if (payload?.nhsStats && !isCurrentNhsRttPayload(payload.nhsStats)) {
      delete payload.nhsStats;
      if (payload?.meta?.sources?.nhsStats) {
        payload.meta.sources.nhsStats = {
          ...payload.meta.sources.nhsStats,
          status: "error",
          cacheState: "expired",
          error: "No current verified NHS England RTT publication is available",
        };
      }
      return rewriteResponse(response, payload);
    }
  }

  return response;
}

function bettingHealthEntry(record, nowMs = Date.now()) {
  if (!record) {
    return {
      section: BETTING_SECTION,
      status: "expired",
      healthy: false,
      source: sectionDescriptors[BETTING_SECTION].source,
      fetchedAt: null,
      expiresAt: null,
      ageSeconds: null,
      cacheState: "expired",
      freshTtlSeconds: BETTING_FRESH_TTL_SECONDS,
      staleTtlSeconds: BETTING_FRESH_TTL_SECONDS,
      ingestOnly: true,
      backend: null,
      error: "No current verified betting market snapshot is available",
    };
  }

  return {
    section: BETTING_SECTION,
    status: "ok",
    healthy: true,
    source: record.source,
    fetchedAt: record.fetchedAt,
    expiresAt: record.data.expiresAt,
    ageSeconds: Math.max(0, Math.floor((nowMs - Date.parse(record.fetchedAt)) / 1000)),
    cacheState: "fresh",
    freshTtlSeconds: BETTING_FRESH_TTL_SECONDS,
    staleTtlSeconds: BETTING_FRESH_TTL_SECONDS,
    ingestOnly: true,
    backend: record.backend,
    error: null,
  };
}

function summarizeHealthSources(sources) {
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

async function enforceStrictBettingMarkets(request, response, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/all" && url.pathname !== "/health") return response;
  if (!response.headers.get("content-type")?.includes("application/json")) return response;
  if (url.pathname === "/all" && !response.ok) return response;

  const parsed = await parseJsonOrFail(
    response,
    url.pathname === "/all" ? "Unable to fetch combined metrics" : "Unable to fetch health status",
    "Invalid JSON response from upstream"
  );
  if (parsed.failure) return parsed.failure;

  const payload = parsed.payload;
  const record = await currentBettingRecord(env);
  const provenance = sectionDescriptors[BETTING_SECTION].registry;

  if (url.pathname === "/all") {
    if (record) {
      payload[BETTING_SECTION] = { ...record.data, __provenance: provenance };
      if (payload?.meta?.sources) {
        payload.meta.sources[BETTING_SECTION] = {
          status: "ok",
          cacheState: "fresh",
          fetchedAt: record.fetchedAt,
          backend: record.backend,
          source: record.source,
          provenance,
        };
      }
    } else {
      delete payload[BETTING_SECTION];
      if (payload?.meta?.sources) {
        payload.meta.sources[BETTING_SECTION] = {
          status: "error",
          cacheState: "expired",
          error: "No current verified betting market snapshot is available",
          provenance,
        };
      }
    }
    return rewriteResponse(response, payload);
  }

  if (!payload.sources || typeof payload.sources !== "object" || Array.isArray(payload.sources)) {
    payload.sources = {};
  }
  payload.sources[BETTING_SECTION] = bettingHealthEntry(record);

  const summary = summarizeHealthSources(payload.sources);
  payload.counts = summary.counts;
  payload.healthy = summary.healthy;
  payload.sourceStatus = summary.healthy ? "ok" : "degraded";
  payload.status = "ok";

  const strict = url.searchParams.get("strict") === "1";
  return rewriteResponse(response, payload, strict && !summary.healthy ? 503 : 200);
}

const evidenceWorker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return worker.fetch(request, env, ctx);

    const url = new URL(request.url);
    const section = url.searchParams.get("section");

    if (url.pathname === "/metrics" && section === BETTING_SECTION) {
      return bettingSectionResponse(env);
    }

    if (
      url.pathname === "/refresh" &&
      (section === NHS_SECTION || section === BETTING_SECTION)
    ) {
      return json(
        {
          error: `Section '${section}' is ingest-only`,
          details:
            section === NHS_SECTION
              ? "Use authenticated POST /ingest with a verified NHS England RTT publication"
              : "Use authenticated POST /ingest with a verified betting market snapshot",
        },
        { status: 409 }
      );
    }

    if (url.pathname === "/ingest" && request.method === "POST") {
      if (!ingestAuthorized(request, env)) return worker.fetch(request, env, ctx);
      try {
        const bettingRecord = await normalizeBettingIngest(request);
        if (bettingRecord) {
          await writeBettingRecord(env, bettingRecord);
          return json({
            status: "accepted",
            section: BETTING_SECTION,
            fetchedAt: bettingRecord.fetchedAt,
            expiresAt: bettingRecord.data.expiresAt,
          });
        }

        const normalizedNhs = await normalizeNhsIngest(request);
        if (normalizedNhs) return worker.fetch(normalizedNhs, env, ctx);
      } catch (error) {
        return json(
          {
            error: "Ingest failed",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 400 }
        );
      }
    }

    const response = await worker.fetch(request, env, ctx);
    const nhsResponse = await enforceCurrentNhsRtt(request, response);
    return enforceStrictBettingMarkets(request, nhsResponse, env);
  },

  scheduled(controller, env, ctx) {
    return worker.scheduled(controller, env, ctx);
  },
};

export {
  bettingHealthEntry,
  currentBettingRecord,
  enforceCurrentNhsRtt,
  enforceStrictBettingMarkets,
  normalizeBettingIngest,
  normalizeNhsIngest,
  readBettingRecord,
  sectionDescriptors,
  summarizeHealthSources,
  writeBettingRecord,
};
export default evidenceWorker;
