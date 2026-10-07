import queuedWorker, {
  DAILY_CRON,
  enqueueInternationalComparisonRefresh,
} from "./queued-publication-entry.js";
import { PUBLICATION_CONFIG, publicationPublished, anyEvidencePublished, filterPublicationSnapshot, filterPublicationCatalog, filterPublicationSummary } from "../contracts/publication-policy.js";
import { isPublicArtifact } from "../contracts/public-artifact.js";
import { isSnapshot, readCurrentPublication } from "./publication-entry.js";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "./feed-registry.js";
import {
  cacheLifetime,
  filterCurrentSnapshot,
  snapshotValidityDeadline,
} from "./publication-currentness.js";
import {
  PUBLIC_SNAPSHOT_KEY,
  buildPublicProjection,
} from "./public-snapshot.js";
import { readInternationalComparison } from "./international-comparison-publication.js";
import { assertSameHttpsHost, MAX_RESPONSE_BYTES, readResponseJson } from "./response-limits.js";
import { listEditionSummaries, readEdition } from "./edition-archive.js";
import {
  FIND_A_TENDER_USER_AGENT,
  normalizeContractReleaseHistory,
} from "../contracts/government-contracts.js";

const SNAPSHOT_PATH = "/data/metrics-snapshot.json";
const HEALTH_PATH = "/data/health.json";
const COMPARISON_PATH = "/data/international-comparison.json";
const EDITIONS_PATH = "/data/editions.json";
const EDITION_PATH = "/data/edition.json";
const CONTRACT_HISTORY_PATH = "/data/contracts/history.json";
const DEFAULT_SEED_URL =
  "https://public-data-org.pages.dev/data/metrics-snapshot.json";
const PUBLIC_CACHE_FRESH_SECONDS = 300;
const COMPARISON_CACHE_FRESH_SECONDS = 300;
const CONTRACT_HISTORY_CACHE_SECONDS = 300;
const CONTRACT_HISTORY_MAX_BYTES = MAX_RESPONSE_BYTES.json;
const FIND_A_TENDER_RECORD_PACKAGE_BASE =
  "https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/";
const FIND_A_TENDER_RELEASE_PACKAGE_BASE =
  "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages/";

function cacheControlFor(validUntil, now = new Date(), maxFreshSeconds = PUBLIC_CACHE_FRESH_SECONDS) {
  const remaining = cacheLifetime(validUntil, now);
  if (remaining <= 0) return "no-store";
  const fresh = Math.min(remaining, maxFreshSeconds);
  const staleWhileRevalidate = Math.max(0, remaining - fresh);
  return `public, max-age=${fresh}, s-maxage=${fresh}, stale-while-revalidate=${staleWhileRevalidate}`;
}

function earliestDeadline(...values) {
  const dates = values.map((value) => Date.parse(String(value ?? ""))).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates)).toISOString() : null;
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

function isPublicProjectionSnapshot(snapshot) {
  return (
    isSnapshot(snapshot) &&
    isPublicArtifact(snapshot, { registryVersion: FEED_REGISTRY_VERSION })
  );
}

function publicProjectionIsCurrent(snapshot, now = new Date()) {
  if (!isPublicProjectionSnapshot(snapshot)) return false;
  const current = filterCurrentSnapshot(snapshot, now);
  if (!current?.meta?.sources) return false;
  return JSON.stringify(Object.keys(current.meta.sources).sort()) ===
    JSON.stringify(Object.keys(snapshot.meta.sources).sort());
}

function normalizePublicProjectionSnapshot(snapshot, now = new Date()) {
  if (!isSnapshot(snapshot) || snapshot.meta.registryVersion !== FEED_REGISTRY_VERSION) {
    return null;
  }
  try {
    if (isPublicProjectionSnapshot(snapshot)) {
      const current = filterCurrentSnapshot(snapshot, now);
      if (!current?.meta?.sources || Object.keys(current.meta.sources).length === 0) return null;
      current.meta.publicProjection = {
        state: "published",
        publishedSections: Object.keys(current.meta.sources).sort(),
      };
      return buildPublicProjection(current, now);
    }
    return buildPublicProjection(snapshot, now);
  } catch {
    return null;
  }
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

  const normalized = normalizePublicProjectionSnapshot(preparedSnapshot, now);
  if (!normalized || !publicProjectionIsCurrent(normalized, now)) return null;

  return {
    body: JSON.stringify(normalized),
    validUntil: earliestDeadline(
      record.metadata.validUntil,
      snapshotValidityDeadline(preparedSnapshot, now),
    ),
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
    const candidate = await readResponseJson(response, { label: "Pages seed JSON" });
    const normalized = normalizePublicProjectionSnapshot(candidate, now);
    return normalized && publicProjectionIsCurrent(normalized, now) ? normalized : null;
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
      const snapshot = normalizePublicProjectionSnapshot(current, now);
      if (snapshot && publicProjectionIsCurrent(snapshot, now)) {
        return {
          body: JSON.stringify(snapshot),
          validUntil: snapshotValidityDeadline(snapshot, now) === null
            ? null
            : new Date(snapshotValidityDeadline(snapshot, now)).toISOString(),
          generatedAt: snapshot.meta.generatedAt ?? "current",
          delivery: "cloudflare-kv-migration",
        };
      }
    }
  } catch {
    // A current Pages artifact is the bounded bootstrap and outage fallback.
  }

  const seed = await fetchSeedSnapshot(env, options.fetchImpl ?? fetch, now);
  if (seed) {
    return {
      body: JSON.stringify(seed),
      validUntil: snapshotValidityDeadline(seed, now) === null
        ? null
        : new Date(snapshotValidityDeadline(seed, now)).toISOString(),
      generatedAt: seed.meta.generatedAt ?? "current",
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
  let snapshot;
  try {
    snapshot = JSON.parse(result.body);
  } catch {
    return json({ error: "Verified public data is temporarily unavailable" }, { status: 503, head: request.method === "HEAD" });
  }
  if (!isPublicProjectionSnapshot(snapshot)) {
    return json({ error: "Data publication is offline for verification", code: "publication_disabled" }, { status: 503, head: request.method === "HEAD" });
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
      headers: { ...publicHeaders(cacheControlFor(result.validUntil)), ...headers },
    });
  }
  return new Response(request.method === "HEAD" ? null : result.body, {
    status: 200,
    headers: {
      ...publicHeaders(cacheControlFor(result.validUntil)),
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

async function comparisonResponse(request, env) {
  const publication = await readInternationalComparison(env);
  if (!publication) {
    return json(
      { error: "Verified international comparison data is temporarily unavailable" },
      { status: 503, head: request.method === "HEAD" }
    );
  }
  const liveDeadlines = Object.values(publication.measures)
    .filter((measure) => measure.comparableCountryCount > 0)
    .map((measure) => measure.lifecycle?.validUntil)
    .filter((validUntil) => typeof validUntil === "string");
  const validUntil = liveDeadlines.length
    ? earliestDeadline(...liveDeadlines)
    : null;
  return json(publication, {
    head: request.method === "HEAD",
    cacheControl: cacheControlFor(validUntil, new Date(), COMPARISON_CACHE_FRESH_SECONDS),
  });
}

async function editionsResponse(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.size) return json({ error: "Release listing does not accept query parameters" }, { status: 400, head: request.method === "HEAD" });
  const editions = (await listEditionSummaries(env)).map((summary) => filterPublicationSummary(summary));
  return json({ editions, retention: editions.length }, { head: request.method === "HEAD", cacheControl: "public, max-age=60, s-maxage=60" });
}

async function editionResponse(request, env, url) {
  const values = url.searchParams.getAll("edition");
  if (values.length !== 1 || url.searchParams.size !== 1 || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(values[0])) {
    return json({ error: "A single valid edition id is required" }, { status: 400, head: request.method === "HEAD" });
  }
  const result = await readEdition(env, values[0]);
  if (!result) return json({ error: "Edition not found" }, { status: 404, head: request.method === "HEAD" });
  return json({ edition: result.summary.id, asOf: result.asOf, availability: "historical", measureCatalog: filterPublicationCatalog(result.catalog), summary: filterPublicationSummary(result.summary, PUBLICATION_CONFIG, result.catalog) }, { head: request.method === "HEAD", cacheControl: "no-store" });
}

async function contractHistoryResponse(request, url) {
  const values = url.searchParams.getAll("ocid");
  if (values.length !== 1 || url.searchParams.size !== 1 || !/^ocds-h6vhtk-[0-9a-f]+$/i.test(values[0])) {
    return json({ error: "A single valid procurement identifier is required" }, { status: 400, head: request.method === "HEAD" });
  }

  let upstreamUrl = `${FIND_A_TENDER_RECORD_PACKAGE_BASE}${values[0]}`;
  let stage = "upstream_fetch";
  let upstreamStatus = null;
  try {
    const requestDeadline = Date.now() + 8000;
    const fetchOptions = () => ({
      headers: {
        Accept: "application/json",
        "User-Agent": FIND_A_TENDER_USER_AGENT,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(Math.max(1, requestDeadline - Date.now())),
    });
    let response;
    try {
      response = await fetch(upstreamUrl, fetchOptions());
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      upstreamUrl = `${FIND_A_TENDER_RELEASE_PACKAGE_BASE}${values[0]}`;
      response = await fetch(upstreamUrl, fetchOptions());
    }
    upstreamStatus = response.status;
    if (response.status === 404) {
      return json({ error: "No public release history is available for this procurement record" }, { status: 404, head: request.method === "HEAD" });
    }
    stage = "upstream_response";
    const packageLabel = upstreamUrl.startsWith(FIND_A_TENDER_RELEASE_PACKAGE_BASE)
      ? "Find a Tender release package"
      : "Find a Tender record package";
    if (!response.ok) throw new Error(`${packageLabel} is unavailable`);
    assertSameHttpsHost(response, upstreamUrl, packageLabel);
    stage = "response_parse";
    const packageValue = await readResponseJson(response, {
      limit: CONTRACT_HISTORY_MAX_BYTES,
      label: packageLabel,
    });
    stage = "response_validation";
    const history = normalizeContractReleaseHistory(packageValue, values[0]);
    return json(history, {
      head: request.method === "HEAD",
      cacheControl: `public, max-age=${CONTRACT_HISTORY_CACHE_SECONDS}, s-maxage=${CONTRACT_HISTORY_CACHE_SECONDS}`,
    });
  } catch (error) {
    const causeCode = error && typeof error === "object" ? error.cause?.code : null;
    const errorCauseCode = typeof causeCode === "string" && /^[A-Z0-9_-]{2,64}$/.test(causeCode)
      ? causeCode
      : null;
    console.warn("contract_history_unavailable", {
      ocid: values[0],
      stage,
      upstreamStatus,
      errorName: error instanceof Error ? error.name : "UnknownError",
      ...(errorCauseCode ? { errorCauseCode } : {}),
    });
    return json({ error: "Release history is temporarily unavailable" }, { status: 503, head: request.method === "HEAD" });
  }
}

async function healthResponse(request, env) {
  if (!env?.METRICS_CACHE?.get || !env?.METRICS_CACHE?.getWithMetadata) {
    return json(
      { status: "unhealthy", ready: false },
      { status: 503, head: request.method === "HEAD" }
    );
  }

  const now = new Date();
  const prepared = await readPreparedPublicArtifact(env, now);
  const internal = withPublicationState(
    filterCurrentSnapshot(await readCurrentPublication(env), now)
  );
  if (!prepared || !internal || !isCompleteSnapshot(internal)) {
    return json(
      { status: "bootstrapping", ready: false },
      { head: request.method === "HEAD" }
    );
  }

  if (internal.meta.publicationState === "degraded") {
    return json(
      {
        status: "degraded",
        ready: false,
        degraded: true,
        missingRequiredSections:
          internal.meta.missingRequiredSections ?? [],
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
    if (![SNAPSHOT_PATH, HEALTH_PATH, COMPARISON_PATH, EDITIONS_PATH, EDITION_PATH, CONTRACT_HISTORY_PATH].includes(url.pathname)) {
      return json({ error: "Not found" }, { status: 404 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: publicHeaders() });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }
    try {
      if (!anyEvidencePublished() && url.pathname === HEALTH_PATH) return json({ status: "publication-paused", ready: false }, { head: request.method === "HEAD" });
      const gate = url.pathname === COMPARISON_PATH ? "internationalComparison" : [EDITION_PATH, EDITIONS_PATH].includes(url.pathname) ? "editionArchive" : url.pathname === CONTRACT_HISTORY_PATH ? "governmentContracts" : null;
      if (url.pathname !== HEALTH_PATH && (gate ? !publicationPublished(gate) : !anyEvidencePublished())) return json({ error: "Data publication is offline for verification", code: "publication_disabled" }, { status: 503, head: request.method === "HEAD" });
      if (url.pathname === HEALTH_PATH) return healthResponse(request, env);
      if (url.pathname === COMPARISON_PATH) return comparisonResponse(request, env);
      if (url.pathname === EDITIONS_PATH) return editionsResponse(request, env);
      if (url.pathname === EDITION_PATH) return editionResponse(request, env, url);
      if (url.pathname === CONTRACT_HISTORY_PATH) return contractHistoryResponse(request, url);
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
        enqueueInternationalComparisonRefresh(env, {
          now: new Date(controller.scheduledTime ?? Date.now()),
        }).catch((error) => {
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
  CONTRACT_HISTORY_PATH,
  EDITION_PATH,
  EDITIONS_PATH,
  HEALTH_PATH,
  SNAPSHOT_PATH,
  comparisonResponse,
  contractHistoryResponse,
  editionResponse,
  editionsResponse,
  currentPublicArtifact,
  currentPublicSnapshot,
  fetchSeedSnapshot,
  isCompleteSnapshot,
  preparedMetadataIsCurrent,
  cacheControlFor,
  earliestDeadline,
  readPreparedPublicArtifact,
  withPublicationState,
};
export default publicDataWorker;
