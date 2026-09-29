import editorialWorker, { sectionDescriptors } from "./editorial-entry.js";
import { readResponseJson } from "./response-limits.js";
import { FEED_REGISTRY_VERSION } from "./feed-registry.js";
import {
  MAX_REQUESTS_PER_RUN as CONTRACT_MAX_REQUESTS_PER_RUN,
} from "./government-contracts-cloudflare.js";

// Publication primitives used by the live queue path (queued-publication-entry.js)
// and the public data worker (public-data-entry.js).
//
// The previous daily-rotation publication engine (runPublicationCycle, ROTATION,
// sectionsForDay, refreshSections, publicationResponse, fetchSeedSnapshot and the
// default publicationWorker fetch/scheduled handlers) was removed in the STEP 2
// simplification: it was a second, competing publication engine that the live
// queue/run/finaliser model never invoked (0 external references; the data
// worker 404s /data/metrics-snapshot.json before it could run). Only the shared
// primitives below survive.

const PUBLICATION_CURRENT_KEY = "v12:publication:current";
const PUBLICATION_STATUS_KEY = "v12:publication:status";
const PUBLICATION_HISTORY_PREFIX = "v12:publication:history:";

// Retained: stamped into published meta by mergePublication.
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

async function kvGet(env, key) {
  return env?.METRICS_CACHE?.get ? env.METRICS_CACHE.get(key, "json") : null;
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
    const { collectTaxRevenue } = await import("./live-tax-revenue-collector.js");
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

export {
  FREE_TIER_BUDGET,
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_HISTORY_PREFIX,
  PUBLICATION_STATUS_KEY,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
  refreshSectionPayload,
};
