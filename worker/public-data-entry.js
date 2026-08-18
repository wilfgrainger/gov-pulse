import queuedWorker from "./queued-publication-entry.js";
import { isSnapshot, readCurrentPublication } from "./publication-entry.js";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "./feed-registry.js";
import { filterCurrentSnapshot } from "./publication-currentness.js";
import {
  PUBLIC_SNAPSHOT_KEY,
  publicSnapshot,
} from "./public-snapshot.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";

const SNAPSHOT_PATH = "/data/metrics-snapshot.json";
const HEALTH_PATH = "/data/health.json";
const DEFAULT_SEED_URL =
  "https://public-data-org.pages.dev/data/metrics-snapshot.json";
const PUBLIC_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";

function requiredMissingFrom(snapshot) {
  if (!snapshot?.meta?.sources || typeof snapshot.meta.sources !== "object") {
    return [...REQUIRED_PUBLISHED_SECTION_IDS];
  }
  return REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) =>
      !snapshot.meta.sources[section] ||
      !Object.prototype.hasOwnProperty.call(snapshot, section)
  );
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return (
    JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
  );
}

function withPublicationState(snapshot) {
  if (!isSnapshot(snapshot) || snapshot.meta.registryVersion !== FEED_REGISTRY_VERSION) {
    return null;
  }
  const normalized = structuredClone(snapshot);
  const missingRequiredSections = requiredMissingFrom(normalized);
  normalized.meta.publicationState =
    missingRequiredSections.length > 0 ? "degraded" : "ready";
  normalized.meta.missingRequiredSections = missingRequiredSections;
  return normalized;
}

function isCompleteSnapshot(snapshot) {
  if (!isSnapshot(snapshot) || snapshot.meta.registryVersion !== FEED_REGISTRY_VERSION) {
    return false;
  }

  const missingRequiredSections = requiredMissingFrom(snapshot);
  if (snapshot.meta.publicationState === "ready") {
    return (
      missingRequiredSections.length === 0 &&
      sameStringSet(snapshot.meta.missingRequiredSections ?? [], [])
    );
  }
  if (snapshot.meta.publicationState === "degraded") {
    return (
      missingRequiredSections.length > 0 &&
      sameStringSet(
        snapshot.meta.missingRequiredSections,
        missingRequiredSections
      ) &&
      Object.keys(snapshot.meta.sources).length > 0
    );
  }

  // Backward compatibility for a complete pre-state snapshot. Missing required
  // evidence never qualifies without an explicit degraded manifest.
  return missingRequiredSections.length === 0;
}

function publicHeaders(cacheControl = "no-store") {
  return {
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": cacheControl,
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(payload, init = {}) {
  return new Response(init.head ? null : JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      ...publicHeaders(init.cacheControl),
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function preparedMetadataIsCurrent(metadata, now = new Date()) {
  const validUntilMs = Date.parse(String(metadata?.validUntil ?? ""));
  return (
    metadata?.registryVersion === FEED_REGISTRY_VERSION &&
    Number.isFinite(validUntilMs) &&
    validUntilMs > now.getTime()
  );
}

async function readPreparedPublicArtifact(env, now = new Date()) {
  if (!env?.METRICS_CACHE?.getWithMetadata) return null;
  const record = await env.METRICS_CACHE.getWithMetadata(
    PUBLIC_SNAPSHOT_KEY,
    "text"
  );
  if (
    typeof record?.value !== "string" ||
    !record.value ||
    !preparedMetadataIsCurrent(record.metadata, now)
  ) {
    return null;
  }

  let preparedSnapshot;
  try {
    preparedSnapshot = JSON.parse(record.value);
  } catch {
    return null;
  }

  const currentSnapshot = withPublicationState(
    filterCurrentSnapshot(preparedSnapshot, now)
  );
  if (!isCompleteSnapshot(currentSnapshot)) return null;

  return {
    body: JSON.stringify(currentSnapshot),
    generatedAt:
      typeof record.metadata?.generatedAt === "string"
        ? record.metadata.generatedAt
        : "current",
    delivery: "cloudflare-kv",
  };
}

async function fetchSeedSnapshot(env, fetchImpl = fetch, now = new Date()) {
  const url = String(env?.STATIC_SNAPSHOT_SEED_URL || DEFAULT_SEED_URL).trim();
  if (!url) return null;

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // Releasing a failed fallback response is best effort only.
      }
      return null;
    }
    assertSameHttpsHost(response, url, "Pages seed");
    const candidate = withPublicationState(
      filterCurrentSnapshot(
        await readResponseJson(response, { label: "Pages seed JSON" }),
        now,
      )
    );
    return isCompleteSnapshot(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function currentPublicArtifact(env, options = {}) {
  const now = options.now ?? new Date();
  const prepared = await readPreparedPublicArtifact(env, now);
  if (prepared) return prepared;

  try {
    const current = withPublicationState(
      filterCurrentSnapshot(await readCurrentPublication(env), now)
    );
    if (isCompleteSnapshot(current)) {
      const snapshot = publicSnapshot(current);
      return {
        body: JSON.stringify(snapshot),
        generatedAt: snapshot.meta.generatedAt ?? "current",
        delivery: "cloudflare-kv-migration",
      };
    }
  } catch {
    // A current Pages seed is the bounded bootstrap and outage fallback.
  }

  const seed = await fetchSeedSnapshot(env, options.fetchImpl ?? fetch, now);
  if (seed) {
    const snapshot = publicSnapshot(seed);
    return {
      body: JSON.stringify(snapshot),
      generatedAt: snapshot.meta.generatedAt ?? "current",
      delivery: "pages-fallback",
    };
  }
  return null;
}

async function currentPublicSnapshot(env, options = {}) {
  const artifact = await currentPublicArtifact(env, options);
  if (!artifact) return null;
  try {
    return {
      snapshot: JSON.parse(artifact.body),
      delivery: artifact.delivery,
    };
  } catch {
    return null;
  }
}

async function snapshotResponse(request, env) {
  const result = await currentPublicArtifact(env);
  if (!result) {
    return json(
      { error: "Verified public data is temporarily unavailable" },
      { status: 503 }
    );
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(result.body),
  );
  const digestHex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const etag = `W/\"sha256-${digestHex}\"`;
  const headers = {
    ETag: etag,
    "X-Publication-Delivery": result.delivery,
  };
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ...publicHeaders(PUBLIC_CACHE_CONTROL), ...headers },
    });
  }
  return new Response(request.method === "HEAD" ? null : result.body, {
    status: 200,
    headers: {
      ...publicHeaders(PUBLIC_CACHE_CONTROL),
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

async function healthResponse(request, env) {
  if (!env?.METRICS_CACHE?.getWithMetadata) {
    return json(
      { status: "unhealthy", ready: false },
      { status: 503, head: request.method === "HEAD" }
    );
  }

  // Readiness is deliberately stricter than data delivery. Migration and Pages
  // fallbacks can keep readers supplied, but only a valid prepared KV artifact
  // proves the current publication pipeline is ready.
  const prepared = await readPreparedPublicArtifact(env);
  if (!prepared) {
    return json(
      { status: "bootstrapping", ready: false },
      { head: request.method === "HEAD" }
    );
  }

  let snapshot;
  try {
    snapshot = JSON.parse(prepared.body);
  } catch {
    return json(
      { status: "bootstrapping", ready: false },
      { head: request.method === "HEAD" }
    );
  }

  if (snapshot.meta?.publicationState === "degraded") {
    return json(
      {
        status: "degraded",
        ready: false,
        degraded: true,
        missingRequiredSections:
          snapshot.meta.missingRequiredSections ?? [],
      },
      { head: request.method === "HEAD" }
    );
  }

  return json(
    { status: "ready", ready: true },
    { head: request.method === "HEAD" }
  );
}

const publicDataWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== SNAPSHOT_PATH && url.pathname !== HEALTH_PATH) {
      return json({ error: "Not found" }, { status: 404 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: publicHeaders() });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }
    try {
      return url.pathname === HEALTH_PATH
        ? await healthResponse(request, env)
        : await snapshotResponse(request, env);
    } catch {
      return json(
        { error: "Cloudflare data service is temporarily unavailable" },
        { status: 503, head: request.method === "HEAD" }
      );
    }
  },

  scheduled(controller, env, ctx) {
    return queuedWorker.scheduled(controller, env, ctx);
  },

  queue(batch, env, ctx) {
    return queuedWorker.queue(batch, env, ctx);
  },
};

export {
  HEALTH_PATH,
  SNAPSHOT_PATH,
  currentPublicArtifact,
  currentPublicSnapshot,
  fetchSeedSnapshot,
  isCompleteSnapshot,
  preparedMetadataIsCurrent,
  readPreparedPublicArtifact,
  withPublicationState,
};
export default publicDataWorker;
