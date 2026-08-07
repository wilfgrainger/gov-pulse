/**
 * Internal compatibility core for the source-specific publication wrappers.
 *
 * This is deliberately not a production entrypoint. The public data Worker is
 * worker/public-data-entry.js. This module only provides the small descriptor,
 * cache, ingest and test/build interfaces still composed by entry.js and the
 * source-specific wrappers. It contains no embedded metric values, secondary
 * polling source, public wildcard API, or independent source registry.
 */
import { FEED_REGISTRY, provenanceFor } from "./feed-registry.js";

const CORS_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Refresh-Secret",
});
const CACHE_PREFIX = "v10:section:";
const inMemoryStore = new Map();

function sourceLabel(section) {
  return FEED_REGISTRY[section].upstreams.map((upstream) => upstream.label).join(" + ");
}

const sectionDescriptors = Object.fromEntries(
  Object.keys(FEED_REGISTRY).map((section) => [
    section,
    {
      section,
      source: sourceLabel(section),
      registry: provenanceFor(section),
      ingestOnly: false,
      freshTtlSeconds: Math.floor(FEED_REGISTRY[section].retrievalMaxAgeMs / 1000),
      staleTtlSeconds: Math.floor(FEED_REGISTRY[section].retrievalMaxAgeMs / 1000),
      build: async () => {
        throw new Error(`Section '${section}' has no configured compatibility builder`);
      },
    },
  ])
);

function json(payload, init = {}) {
  const headers = new Headers(CORS_HEADERS);
  for (const [key, value] of new Headers(init.headers)) headers.set(key, value);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(payload === null ? null : JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function constantTimeCompare(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function refreshAuthorized(request, env) {
  const expected = typeof env?.REFRESH_SECRET === "string" ? env.REFRESH_SECRET.trim() : "";
  if (!expected) return false;
  const url = new URL(request.url);
  const supplied = request.headers.get("X-Refresh-Secret") || url.searchParams.get("secret") || "";
  return constantTimeCompare(supplied, expected);
}

function cacheKey(section) {
  return `${CACHE_PREFIX}${section}`;
}

async function readRecord(env, section) {
  let value;
  if (env?.METRICS_CACHE?.get) {
    value = await env.METRICS_CACHE.get(cacheKey(section), "json");
  } else {
    value = inMemoryStore.get(section) ?? null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function writeRecord(env, section, record) {
  if (env?.METRICS_CACHE?.put) {
    await env.METRICS_CACHE.put(cacheKey(section), JSON.stringify(record));
  } else {
    inMemoryStore.set(section, record);
  }
}

function recordFresh(record, descriptor, now = Date.now()) {
  const fetchedAt = Date.parse(record?.fetchedAt ?? "");
  const ttlSeconds = Number.isFinite(descriptor?.freshTtlSeconds)
    ? descriptor.freshTtlSeconds
    : 0;
  return (
    Number.isFinite(fetchedAt) &&
    ttlSeconds > 0 &&
    Math.max(0, now - fetchedAt) <= ttlSeconds * 1000
  );
}

async function buildRecord(section, descriptor) {
  if (descriptor.ingestOnly) {
    throw new Error(`Section '${section}' requires an authenticated ingest`);
  }
  const data = await descriptor.build();
  return {
    section,
    data,
    fetchedAt: new Date().toISOString(),
    sourceLabel: descriptor.source,
    backend: "verified-data-service",
  };
}

async function currentOrBuild(env, section) {
  const descriptor = sectionDescriptors[section];
  const cached = await readRecord(env, section);
  if (cached && (descriptor.ingestOnly || recordFresh(cached, descriptor))) return cached;
  const record = await buildRecord(section, descriptor);
  await writeRecord(env, section, record);
  return record;
}

function sourceStatus(section, record, error = null) {
  const descriptor = sectionDescriptors[section];
  if (!record) {
    return {
      status: "error",
      cacheState: "missing",
      fetchedAt: null,
      source: descriptor.source,
      error: error ?? "No verified record is available",
    };
  }
  return {
    status: "ok",
    cacheState: "fresh",
    fetchedAt: record.fetchedAt,
    source: record.sourceLabel ?? descriptor.source,
    backend: record.backend,
  };
}

async function metricsResponse(section, env) {
  try {
    const record = await currentOrBuild(env, section);
    return json(
      {
        section,
        data: record.data,
        source: "worker",
        timestamp: record.fetchedAt,
        cacheState: "fresh",
        backend: record.backend,
      },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (error) {
    return json(
      {
        error: `Unable to fetch section '${section}'`,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}

async function allResponse(env) {
  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      sources: {},
    },
  };
  for (const section of Object.keys(sectionDescriptors)) {
    try {
      const record = await currentOrBuild(env, section);
      payload[section] = record.data;
      payload.meta.sources[section] = sourceStatus(section, record);
    } catch (error) {
      payload.meta.sources[section] = sourceStatus(
        section,
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  return json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
}

async function ingestResponse(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Use POST for /ingest" }, { status: 405 });
  }
  if (!refreshAuthorized(request, env)) {
    return json({ error: "Refresh secret required" }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Ingest failed", details: "Invalid JSON body" }, { status: 400 });
  }
  const section = typeof payload?.section === "string" ? payload.section.trim() : "";
  const descriptor = sectionDescriptors[section];
  if (!descriptor) return json({ error: `Unknown section '${section}'` }, { status: 404 });
  if (!descriptor.ingestOnly) {
    return json({ error: `Section '${section}' does not support ingest` }, { status: 400 });
  }
  if (!payload?.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    return json({ error: "Ingest failed", details: "data must be an object" }, { status: 400 });
  }

  const fetchedAt =
    typeof payload.fetchedAt === "string" && Number.isFinite(Date.parse(payload.fetchedAt))
      ? payload.fetchedAt
      : new Date().toISOString();
  const record = {
    section,
    data: payload.data,
    fetchedAt,
    sourceLabel:
      typeof payload.sourceLabel === "string" && payload.sourceLabel.trim()
        ? payload.sourceLabel.trim()
        : descriptor.source,
    backend:
      typeof payload.backend === "string" && payload.backend.trim()
        ? payload.backend.trim()
        : "authenticated-ingest",
  };
  await writeRecord(env, section, record);
  return json({ status: "accepted", section, fetchedAt });
}

async function refreshResponse(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Use POST for /refresh" }, { status: 405 });
  }
  if (!refreshAuthorized(request, env)) {
    return json({ error: "Refresh secret required" }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("section");
  const sections = requested ? [requested] : Object.keys(sectionDescriptors);
  const refreshed = [];
  const failed = [];
  for (const section of sections) {
    const descriptor = sectionDescriptors[section];
    if (!descriptor) {
      failed.push({ section, error: `Unknown section '${section}'` });
      continue;
    }
    if (descriptor.ingestOnly) {
      failed.push({ section, error: `Section '${section}' is ingest-only` });
      continue;
    }
    try {
      const record = await buildRecord(section, descriptor);
      await writeRecord(env, section, record);
      refreshed.push(section);
    } catch (error) {
      failed.push({
        section,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return json({ status: failed.length === 0 ? "ok" : "degraded", refreshed, failed });
}

const compatibilityWorker = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    if (url.pathname === "/metrics") {
      const section = url.searchParams.get("section");
      if (!section) return json({ error: "Missing ?section= parameter" }, { status: 400 });
      if (!sectionDescriptors[section]) {
        return json({ error: `Unknown section '${section}'` }, { status: 404 });
      }
      return metricsResponse(section, env);
    }
    if (url.pathname === "/all") return allResponse(env);
    if (url.pathname === "/ingest") return ingestResponse(request, env);
    if (url.pathname === "/refresh") return refreshResponse(request, env);
    return json({ error: "Not found" }, { status: 404 });
  },

  scheduled(controller, env, ctx) {
    const request = new Request("https://compatibility.internal/refresh", {
      method: "POST",
      headers: { "X-Refresh-Secret": env?.REFRESH_SECRET ?? "" },
    });
    const work = refreshResponse(request, env).catch((error) => {
      console.error("public-data.org compatibility refresh failed", {
        cron: controller?.cron,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    if (ctx?.waitUntil) ctx.waitUntil(work);
    return work;
  },
};

export { refreshAuthorized, sectionDescriptors };
export default compatibilityWorker;
