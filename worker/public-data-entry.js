import queuedWorker, {
  DAILY_CRON,
  enqueueInternationalComparisonRefresh,
} from "./queued-publication-entry.js";
import { anyEvidencePublished } from "../contracts/publication-policy.js";
import { PUBLICATION_CONFIG, publicationPublished, filterPublicationCatalog, filterPublicationSummary, isPublicationFilteredSnapshot, cacheLifetime, filterCurrentSnapshot, snapshotIsCurrentAsIs, snapshotValidityDeadline } from "../contracts/evidence-policy.js";
import { isPublicArtifact } from "../contracts/public-artifact.js";
import { PUBLICATION_STATUS_KEY, isSnapshot, readCurrentPublication } from "./publication-entry.js";
import { publicUnavailableSections } from "./publication-availability.js";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../feeds/registry.js";
import {
  PUBLIC_SNAPSHOT_KEY,
  buildPublicProjection,
  isSanitizedPublishedValue,
} from "./public-snapshot.js";
import { readInternationalComparison } from "../feeds/international-comparison/parse.js";
import { assertSameHttpsHost, MAX_RESPONSE_BYTES, readResponseJson } from "./response-limits.js";
import { listEditionSummaries, readEdition } from "./edition-archive.js";
import { fnv64 } from "./measure-catalog.js";
import { fetchPublicationSeedSnapshot } from "./publication-recovery.js";
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

/**
 * @typedef {object} PublicArtifact
 * @property {string} body the exact JSON served by /data/metrics-snapshot.json
 * @property {any} snapshot `body` as a validated public projection
 * @property {string|null} validUntil
 * @property {string} generatedAt
 * @property {string} delivery
 */

/**
 * Read-time preparation of the publisher's stored artifact.
 *
 * The publisher stores an already-normalised artifact: policy-filtered,
 * sanitised and currentness-filtered at publish time. A cache miss therefore
 * only checks that it still is (identifiers and keys, no copies) and serves it
 * unchanged. Currentness is still enforced on every read: a section that has
 * aged out since publication is filtered from a single copy. An artifact not
 * in the normalised form (an earlier publisher or publication policy) goes
 * through full normalisation and is never served as stored.
 *
 * @returns {{ snapshot: any, unchanged: boolean } | null}
 */
function preparePublicArtifactSnapshot(stored, now = new Date()) {
  if (
    isPublicProjectionSnapshot(stored) &&
    isPublicationFilteredSnapshot(stored) &&
    isSanitizedPublishedValue(stored)
  ) {
    if (snapshotIsCurrentAsIs(stored, now)) return { snapshot: stored, unchanged: true };
    const current = filterCurrentSnapshot(stored, now);
    if (!current?.meta?.sources) return null;
    current.meta.publicProjection = {
      state: "published",
      publishedSections: Object.keys(current.meta.sources).sort(),
    };
    return isPublicProjectionSnapshot(current) ? { snapshot: current, unchanged: false } : null;
  }
  const normalized = normalizePublicProjectionSnapshot(stored, now);
  return normalized && publicProjectionIsCurrent(normalized, now)
    ? { snapshot: normalized, unchanged: false }
    : null;
}

// One parsed artifact per isolate. The stored text and metadata identify it, and
// it is reused only until the validity deadline the read already enforces, so a
// lapsed section still drops out on time without parsing on every health check.
let preparedArtifactMemo = null;

/** @returns {Promise<PublicArtifact | null>} */
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

  const metadataKey = JSON.stringify(record.metadata ?? null);
  const memo = preparedArtifactMemo;
  if (
    memo?.text === record.value &&
    memo.metadataKey === metadataKey &&
    now.getTime() < memo.validUntilMs
  ) {
    return memo.artifact;
  }

  let preparedSnapshot;
  try {
    preparedSnapshot = JSON.parse(record.value);
  } catch {
    return null;
  }

  const prepared = preparePublicArtifactSnapshot(preparedSnapshot, now);
  if (!prepared) return null;

  const artifact = {
    body: prepared.unchanged ? record.value : JSON.stringify(prepared.snapshot),
    snapshot: prepared.snapshot,
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
  preparedArtifactMemo = {
    text: record.value,
    metadataKey,
    validUntilMs: Date.parse(artifact.validUntil),
    artifact,
  };
  return artifact;
}

async function fetchSeedSnapshot(env, fetchImpl = fetch, now = new Date()) {
  return fetchPublicationSeedSnapshot(env, fetchImpl, now);
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
          snapshot,
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
      snapshot: seed,
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
  return {
    snapshot: artifact.snapshot,
    delivery: artifact.delivery,
  };
}

async function snapshotResponse(request, env) {
  const result = await currentPublicArtifact(env);
  if (!result) {
    return json(
      { error: "Verified public data is temporarily unavailable" },
      { status: 503 }
    );
  }
  // Every producer hands over its validated snapshot with the body, so the
  // response checks it without parsing the body a second time.
  if (!isPublicProjectionSnapshot(result.snapshot)) {
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

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const configHashes = new WeakMap();
/** FNV-64 of the stable-stringified publication config; a hold or release changes it, and with it every edition ETag. */
function publicationConfigHash(config) {
  if (config === null || typeof config !== "object") return fnv64(stableStringify(config));
  let hash = configHashes.get(config);
  if (!hash) {
    hash = fnv64(stableStringify(config));
    configHashes.set(config, hash);
  }
  return hash;
}
const PUBLICATION_CONFIG_HASH = publicationConfigHash(PUBLICATION_CONFIG);

const EDITION_CACHE_CONTROL = "public, max-age=60";

async function editionsResponse(request, env, config = PUBLICATION_CONFIG) {
  const url = new URL(request.url);
  if (url.searchParams.size) return json({ error: "Release listing does not accept query parameters" }, { status: 400, head: request.method === "HEAD" });
  const editions = (await listEditionSummaries(env)).map((summary) => filterPublicationSummary(summary, config));
  return json({ editions, retention: editions.length }, { head: request.method === "HEAD", cacheControl: "public, max-age=60, s-maxage=60" });
}

function etagMatches(header, etag) {
  return typeof header === "string" && header.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === etag);
}

async function editionResponse(request, env, url, config = PUBLICATION_CONFIG) {
  const head = request.method === "HEAD";
  const values = url.searchParams.getAll("edition");
  if (values.length !== 1 || url.searchParams.size !== 1 || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(values[0])) {
    return json({ error: "A single valid edition id is required" }, { status: 400, head });
  }
  const result = await readEdition(env, values[0]);
  if (!result) return json({ error: "Edition not found" }, { status: 404, head });
  const configHash = config === PUBLICATION_CONFIG ? PUBLICATION_CONFIG_HASH : publicationConfigHash(config);
  // A summary correction changes the body without changing the immutable content, so it is part of the identity.
  const correction = result.summary.summaryCorrection ? `.s${fnv64(stableStringify(result.summary))}` : "";
  const etag = `"${result.contentHash}.${configHash}${correction}"`;
  const headers = { ...publicHeaders(EDITION_CACHE_CONTROL), ETag: etag };
  if (etagMatches(request.headers.get("If-None-Match"), etag)) return new Response(null, { status: 304, headers });
  return json({ edition: result.summary.id, asOf: result.asOf, availability: "historical", measureCatalog: filterPublicationCatalog(result.catalog, config), summary: filterPublicationSummary(result.summary, config, result.catalog) }, { head, cacheControl: EDITION_CACHE_CONTROL, headers: { ETag: etag } });
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

async function readPublicationStatus(env) {
  try {
    return await env.METRICS_CACHE.get(PUBLICATION_STATUS_KEY, "json");
  } catch {
    return null;
  }
}

function isPublisherStatus(status) {
  return (
    Boolean(status) &&
    typeof status === "object" &&
    !Array.isArray(status) &&
    typeof status.status === "string" &&
    Array.isArray(status.includedSections) &&
    status.includedSections.every((section) => typeof section === "string")
  );
}

// Sections the public artifact currently carries. The read path has just
// currentness-filtered it, so presence is live. Held evidence is never a
// public section: health reports it separately and never counts it as missing.
function currentPublicationSections(publicSnapshot) {
  return new Set(
    Object.keys(publicSnapshot.meta.sources).filter((section) =>
      Object.prototype.hasOwnProperty.call(publicSnapshot, section)
    )
  );
}

// Health reads two small-to-bounded records: the prepared public artifact
// (validated without copies on the common path) and the publisher status
// record. It never reads or copies the full internal publication.
async function healthResponse(request, env) {
  if (!env?.METRICS_CACHE?.get || !env?.METRICS_CACHE?.getWithMetadata) {
    return json(
      { status: "unhealthy", ready: false },
      { status: 503, head: request.method === "HEAD" }
    );
  }

  const now = new Date();
  const prepared = await readPreparedPublicArtifact(env, now);
  const status = prepared ? await readPublicationStatus(env) : null;
  if (!prepared || !isPublisherStatus(status)) {
    return json(
      { status: "bootstrapping", ready: false },
      { head: request.method === "HEAD" }
    );
  }

  // "Required" applies to feeds the publication config publishes. A required
  // feed that policy deliberately holds is reported in `held` (ids only) and is
  // neither missing nor a failure; its evidence stays unavailable.
  const currentSections = currentPublicationSections(prepared.snapshot);
  const missingRequiredSections = REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) => publicationPublished(section) && !currentSections.has(section)
  );
  const heldSections = REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) => !publicationPublished(section)
  );
  const held = heldSections.length > 0 ? { held: heldSections } : {};
  const unavailableSections = publicUnavailableSections(prepared.snapshot, status);
  const unavailable = unavailableSections.length > 0 ? { unavailableSections } : {};

  if (missingRequiredSections.length > 0) {
    return json(
      {
        status: "degraded",
        ready: false,
        degraded: true,
        missingRequiredSections,
        ...held,
        ...unavailable,
      },
      { head: request.method === "HEAD" }
    );
  }

  return json(
    { status: "ready", ready: true, ...held, ...unavailable },
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
    if (controller.cron === DAILY_CRON && publicationPublished("internationalComparison")) {
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
