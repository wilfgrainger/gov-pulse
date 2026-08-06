import worker, { sectionDescriptors } from "./debt-entry.js";
import { summarize } from "./series-entry.js";
import {
  buildCrimeStatistics,
  isCurrentCrimeStatisticsPayload,
} from "./crime-statistics.js";

const SECTION = "crimeStatistics";
const BACKEND = "cloudflare-official-publication";

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

async function parseJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return null;
  }
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

async function currentRecord(now = new Date(), fetchImpl = fetch) {
  const data = await buildCrimeStatistics(now, fetchImpl);
  if (!isCurrentCrimeStatisticsPayload(data, now)) {
    throw new Error("Crime evidence is outside its modular publication contract");
  }
  return {
    section: SECTION,
    data,
    fetchedAt: now.toISOString(),
    sourceLabel: sectionDescriptors[SECTION].source,
    backend: BACKEND,
  };
}

function crimeDataWithEvidence(record) {
  return {
    ...record.data,
    __provenance: sectionDescriptors[SECTION].registry,
  };
}

function crimeSectionPayload(record) {
  return {
    section: SECTION,
    data: crimeDataWithEvidence(record),
    source: "worker",
    timestamp: record.fetchedAt,
    cacheState: "fresh",
    backend: record.backend,
    provenance: sectionDescriptors[SECTION].registry,
  };
}

function crimeSourceMeta(record) {
  return {
    status: "ok",
    cacheState: "fresh",
    fetchedAt: record.fetchedAt,
    backend: record.backend,
    source: record.sourceLabel,
    provenance: sectionDescriptors[SECTION].registry,
  };
}

async function sectionResponse() {
  try {
    return json(crimeSectionPayload(await currentRecord()), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    return json(
      {
        error: `Unable to fetch section '${SECTION}'`,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}

async function enforceCrimeCombined(response) {
  if (!response.ok) return response;
  const payload = await parseJson(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response;
  }
  payload.meta ??= {};
  payload.meta.sources ??= {};
  try {
    const record = await currentRecord();
    payload[SECTION] = crimeDataWithEvidence(record);
    payload.meta.sources[SECTION] = crimeSourceMeta(record);
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

function crimeHealthEntry(record, now = new Date()) {
  if (record && isCurrentCrimeStatisticsPayload(record.data, now)) {
    return {
      section: SECTION,
      status: "ok",
      healthy: true,
      source: record.sourceLabel,
      fetchedAt: record.fetchedAt,
      ageSeconds: 0,
      cacheState: "fresh",
      freshTtlSeconds: sectionDescriptors[SECTION].freshTtlSeconds,
      staleTtlSeconds: sectionDescriptors[SECTION].staleTtlSeconds,
      ingestOnly: false,
      error: null,
    };
  }
  return {
    section: SECTION,
    status: "expired",
    healthy: false,
    source: sectionDescriptors[SECTION].source,
    fetchedAt: null,
    ageSeconds: null,
    cacheState: "expired",
    freshTtlSeconds: sectionDescriptors[SECTION].freshTtlSeconds,
    staleTtlSeconds: sectionDescriptors[SECTION].staleTtlSeconds,
    ingestOnly: false,
    error: "No current modular crime publication is available",
  };
}

async function enforceCrimeHealth(request, response) {
  const payload = await parseJson(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response;
  }
  payload.sources ??= {};
  let record = null;
  try {
    record = await currentRecord();
  } catch (error) {
    console.warn(
      "public-data.org could not validate crime evidence during health evaluation",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
  payload.sources[SECTION] = crimeHealthEntry(record);
  payload.sections = payload.sources;
  const summary = summarize(payload.sources);
  payload.counts = summary.counts;
  payload.healthy = summary.healthy;
  payload.sourceStatus = summary.healthy ? "ok" : "degraded";
  payload.status = "ok";
  const strict = new URL(request.url).searchParams.get("strict") === "1";
  return rewriteResponse(response, payload, strict && !summary.healthy ? 503 : 200);
}

const editorialWorker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return worker.fetch(request, env, ctx);
    const url = new URL(request.url);
    if (url.pathname === "/metrics" && url.searchParams.get("section") === SECTION) {
      return sectionResponse();
    }
    const response = await worker.fetch(request, env, ctx);
    if (url.pathname === "/all") return enforceCrimeCombined(response);
    if (url.pathname === "/health") {
      return enforceCrimeHealth(request, response);
    }
    return response;
  },
  scheduled(controller, env, ctx) {
    return worker.scheduled(controller, env, ctx);
  },
};

export {
  dataWithEvidence,
  enforceCombined,
  enforceHealth,
  ensureRecord,
  healthEntry,
  isCurrentRecord,
  observationFor,
  readRecord,
  sectionDescriptors,
  sectionPayload,
  validDebtPayload,
  writeRecord,
} from "./debt-entry.js";
export {
  crimeDataWithEvidence,
  crimeHealthEntry,
  crimeSectionPayload,
  currentRecord as currentCrimeRecord,
  enforceCrimeCombined,
  enforceCrimeHealth,
};
export default editorialWorker;
