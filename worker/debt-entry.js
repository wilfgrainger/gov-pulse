import worker, { sectionDescriptors, summarize } from "./series-entry.js";
import {
  DEBT_GDP_SERIES_URL,
  DEBT_SERIES_URL,
  buildNationalDebt,
} from "./national-debt.js";

const SECTION = "nationalDebt";
const CACHE_KEY = "v11:section:nationalDebt-editorial";
const MAX_PUBLICATION_AGE_MS = 75 * 24 * 60 * 60 * 1000;
let inMemoryRecord = null;

function json(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  if (!headers.has("Access-Control-Allow-Origin")) headers.set("Access-Control-Allow-Origin", "*");
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function rewriteResponse(response, payload, status = response.status) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return json(payload, { status, headers });
}

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
    Number.isFinite(publishedAt) && Math.max(0, nowMs - publishedAt) <= MAX_PUBLICATION_AGE_MS &&
    typeof data?.revisionStatus === "string" && data.revisionStatus.trim().length > 0 &&
    data?.source?.publisher === "Office for National Statistics" &&
    data?.source?.debtUrl === DEBT_SERIES_URL && data?.source?.debtToGdpUrl === DEBT_GDP_SERIES_URL &&
    Array.isArray(data?.history) && data.history.length >= 13 && data.history.at(-1)?.observedAt === data.baseDate &&
    Number.isFinite(data?.annualDelta?.debtBillion) && Number.isFinite(data?.annualDelta?.debtToGdpPoints)
  );
}

async function readRecord(env) {
  if (env?.METRICS_CACHE?.get) {
    try {
      return await env.METRICS_CACHE.get(CACHE_KEY, "json");
    } catch (error) {
      console.warn("public-data.org could not read the editorial debt cache", { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
  return inMemoryRecord;
}

async function writeRecord(env, record) {
  if (env?.METRICS_CACHE?.put) await env.METRICS_CACHE.put(CACHE_KEY, JSON.stringify(record));
  else inMemoryRecord = record;
}

function freshTtlSeconds() {
  const value = sectionDescriptors[SECTION]?.freshTtlSeconds;
  return Number.isFinite(value) && value > 0 ? value : 40 * 24 * 60 * 60;
}

function isCurrentRecord(record, now = new Date()) {
  const fetchedAt = Date.parse(record?.fetchedAt ?? "");
  const nowMs = now.getTime();
  return record?.section === SECTION && validDebtPayload(record.data, now) && Number.isFinite(fetchedAt) && Number.isFinite(nowMs) && Math.max(0, nowMs - fetchedAt) <= freshTtlSeconds() * 1000;
}

async function ensureRecord(env, nowProvider = () => new Date()) {
  const now = nowProvider();
  const cached = await readRecord(env);
  if (isCurrentRecord(cached, now)) return cached;
  const data = await buildNationalDebt(fetch);
  if (!validDebtPayload(data, now)) throw new Error("National debt evidence is outside its editorial contract");
  const record = { section: SECTION, data, fetchedAt: now.toISOString(), sourceLabel: sectionDescriptors[SECTION].source, backend: "verified-data-service-editorial-contract" };
  await writeRecord(env, record);
  return record;
}

function observationFor(record) {
  return { status: "current", period: record.data.observationPeriod, observedAt: new Date(record.data.baseDate).toISOString(), checkedAt: record.fetchedAt, maxAgeDays: 75 };
}

function dataWithEvidence(record) {
  return { ...record.data, __observation: observationFor(record), __provenance: sectionDescriptors[SECTION].registry };
}

function sectionPayload(record) {
  return { section: SECTION, data: dataWithEvidence(record), source: "worker", timestamp: record.fetchedAt, cacheState: "fresh", backend: record.backend, provenance: sectionDescriptors[SECTION].registry };
}

async function parseJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) return null;
  try { return await response.clone().json(); } catch { return null; }
}

async function sectionResponse(env) {
  try {
    return json(sectionPayload(await ensureRecord(env)), { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    return json({ error: `Unable to fetch section '${SECTION}'`, details: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}

function sourceMeta(record) {
  return { status: "ok", cacheState: "fresh", fetchedAt: record.fetchedAt, backend: record.backend, source: record.sourceLabel, provenance: sectionDescriptors[SECTION].registry };
}

async function enforceCombined(response, env) {
  if (!response.ok) return response;
  const payload = await parseJson(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return response;
  payload.meta ??= {};
  payload.meta.sources ??= {};
  try {
    const record = await ensureRecord(env);
    payload[SECTION] = dataWithEvidence(record);
    payload.meta.sources[SECTION] = sourceMeta(record);
  } catch (error) {
    delete payload[SECTION];
    payload.meta.sources[SECTION] = { status: "error", cacheState: "missing", fetchedAt: null, source: sectionDescriptors[SECTION].source, error: error instanceof Error ? error.message : "Unknown error", provenance: sectionDescriptors[SECTION].registry };
  }
  return rewriteResponse(response, payload);
}

function healthEntry(record, now = new Date()) {
  if (!isCurrentRecord(record, now)) {
    return { section: SECTION, status: "expired", healthy: false, source: sectionDescriptors[SECTION].source, fetchedAt: null, ageSeconds: null, cacheState: "expired", freshTtlSeconds: freshTtlSeconds(), staleTtlSeconds: freshTtlSeconds(), ingestOnly: false, error: "No current editorial national debt record is available" };
  }
  return { section: SECTION, status: "ok", healthy: true, source: record.sourceLabel, fetchedAt: record.fetchedAt, ageSeconds: Math.max(0, Math.floor((now.getTime() - Date.parse(record.fetchedAt)) / 1000)), cacheState: "fresh", freshTtlSeconds: freshTtlSeconds(), staleTtlSeconds: freshTtlSeconds(), ingestOnly: false, error: null };
}

async function enforceHealth(request, response, env) {
  const payload = await parseJson(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return response;
  payload.sources ??= {};
  let record = null;
  try { record = await ensureRecord(env); }
  catch (error) { console.warn("public-data.org could not refresh editorial debt evidence during health evaluation", { error: error instanceof Error ? error.message : String(error) }); }
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

const editorialWorker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return worker.fetch(request, env, ctx);
    const url = new URL(request.url);
    if (url.pathname === "/metrics" && url.searchParams.get("section") === SECTION) return sectionResponse(env);
    const response = await worker.fetch(request, env, ctx);
    if (url.pathname === "/all") return enforceCombined(response, env);
    if (url.pathname === "/health") return enforceHealth(request, response, env);
    return response;
  },
  scheduled(controller, env, ctx) { return worker.scheduled(controller, env, ctx); },
};

export { dataWithEvidence, enforceCombined, enforceHealth, ensureRecord, healthEntry, isCurrentRecord, observationFor, readRecord, sectionDescriptors, sectionPayload, validDebtPayload, writeRecord };
export default editorialWorker;
