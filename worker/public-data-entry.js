import queuedWorker, { DAILY_CRON } from "./queued-publication-entry.js";
import { isSnapshot, readCurrentPublication } from "./publication-entry.js";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "./feed-registry.js";
import {
  filterCurrentSnapshot,
  snapshotValidityDeadline,
} from "./publication-currentness.js";
import {
  PUBLIC_SNAPSHOT_KEY,
  publicSnapshot,
} from "./public-snapshot.js";
import {
  comparisonValidUntil,
  readInternationalComparison,
  refreshInternationalComparison,
} from "./international-comparison-store.js";
import { assertSameHttpsHost, readResponseJson } from "./response-limits.js";
import { approvedSeedUrl } from "./approved-seed-url.js";

const SNAPSHOT_PATH = "/data/metrics-snapshot.json";
const HEALTH_PATH = "/data/health.json";
const COMPARISON_PATH = "/data/international-comparison.json";
function publicCacheControl(validUntil, now = new Date()) {
  const validUntilMs = Date.parse(String(validUntil ?? ""));
  const remainingSeconds = Math.floor((validUntilMs - now.getTime()) / 1000);
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
    return "no-store";
  }
  const maxAge = Math.min(300, Math.max(1, remainingSeconds));
  return `public, max-age=${maxAge}, s-maxage=${maxAge}`;
}
function comparisonCacheControl(publication, now = new Date()) {
  const validUntil = comparisonValidUntil(publication);
  if (!validUntil) return "no-store";
  const remainingSeconds = Math.max(
    1,
    Math.ceil((validUntil.getTime() - now.getTime()) / 1000),
  );
  const maxAge = Math.min(3600, remainingSeconds);
  return `public, max-age=${maxAge}, s-maxage=${maxAge}`;
}

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
    validUntil: record.metadata.validUntil,
    delivery: "cloudflare-kv",
  };
}

async function fetchSeedSnapshot(env, fetchImpl = fetch, now = new Date()) {
  const url = approvedSeedUrl(env?.STATIC_SNAPSHOT_SEED_URL);
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
      const validUntilMs = snapshotValidityDeadline(current, now);
      if (!Number.isFinite(validUntilMs)) return null;
      return {
        body: JSON.stringify(snapshot),
        generatedAt: snapshot.meta.generatedAt ?? "current",
        validUntil: new Date(validUntilMs).toISOString(),
        delivery: "cloudflare-kv-migration",
      };
    }
  } catch {
    // A current Pages seed is the bounded bootstrap and outage fallback.
  }

  const seed = await fetchSeedSnapshot(env, options.fetchImpl ?? fetch, now);
  if (seed) {
    const snapshot = publicSnapshot(seed);
    const validUntilMs = snapshotValidityDeadline(seed, now);
    if (!Number.isFinite(validUntilMs)) return null;
    return {
      body: JSON.stringify(snapshot),
      generatedAt: snapshot.meta.generatedAt ?? "current",
      validUntil: new Date(validUntilMs).toISOString(),
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
  const cacheControl = publicCacheControl(result.validUntil);
  if (
    cacheControl !== "no-store" &&
    request.headers.get("If-None-Match") === etag
  ) {
    return new Response(null, {
      status: 304,
      headers: { ...publicHeaders(cacheControl), ...headers },
    });
  }
  return new Response(request.method === "HEAD" ? null : result.body, {
    status: 200,
    headers: {
      ...publicHeaders(cacheControl),
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

async function comparisonResponse(request, env) {
  const now = new Date();
  const publication = await readInternationalComparison(env, { now });
  if (!publication) {
    return json(
      { error: "Verified international comparison data is temporarily unavailable" },
      { status: 503, head: request.method === "HEAD" }
    );
  }
  return json(publication, {
    head: request.method === "HEAD",
    cacheControl: comparisonCacheControl(publication, now),
  });
}

async function healthResponse(request, env) {
  if (!env?.METRICS_CACHE?.getWithMetadata) {
    return json(
      { status: "unhealthy", ready: false },
      { status: 503, head: request.method === "HEAD" }
    );
  }

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
    if (![SNAPSHOT_PATH, HEALTH_PATH, COMPARISON_PATH].includes(url.pathname)) {
      return json({ error: "Not found" }, { status: 404 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: publicHeaders() });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }
    try {
      if (url.pathname === HEALTH_PATH) return healthResponse(request, env);
      if (url.pathname === COMPARISON_PATH) return comparisonResponse(request, env);
      return snapshotResponse(request, env);
    } catch {
      return json(
        { error: "Cloudflare data service is temporarily unavailable" },
        { status: 503, head: request.method === "HEAD" }
      );
    }
  },

  scheduled(controller, env, ctx) {
    queuedWorker.scheduled(controller, env, ctx);
    if (controller.cron === DAILY_CRON) {
      ctx.waitUntil(
        refreshInternationalComparison(env).catch((error) => {
          console.error("International comparison refresh failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        })
      );
    }
  },

  queue(batch, env, ctx) {
    return queuedWorker.queue(batch, env, ctx);
  },
};

export {
  COMPARISON_PATH,
  HEALTH_PATH,
  SNAPSHOT_PATH,
  comparisonResponse,
  currentPublicArtifact,
  currentPublicSnapshot,
  fetchSeedSnapshot,
  isCompleteSnapshot,
  publicCacheControl,
  preparedMetadataIsCurrent,
  readPreparedPublicArtifact,
  withPublicationState,
};
export default publicDataWorker;
