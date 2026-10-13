import { SECTION_BUILDERS } from "./section-builders.js";
import { FEED_REGISTRY_VERSION } from "./feed-registry.js";
import { buildMeasureCatalog } from "./measure-catalog.js";
import { buildEditionSummary } from "./edition-summary.js";

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

// The live queue path (queued-publication-entry.js:storeSectionFragment) only
// ever calls this for the seven GENERIC sections. taxRevenue keeps its live
// collector special-case; every other generic section is built by the flat
// SECTION_BUILDERS map, which returns the same record shape (and same
// fail-closed currentness behaviour) the internal-worker doll produced.
async function refreshSectionPayload(section, env, ctx, now = new Date()) {
  if (section === "taxRevenue") {
    const { collectTaxRevenue } = await import("./live-tax-revenue-collector.js");
    return collectTaxRevenue(fetch, now);
  }

  const builder = SECTION_BUILDERS[section];
  if (typeof builder !== "function") {
    throw new Error(`No section builder is registered for '${section}'`);
  }
  const record = await builder(now);
  if (record?.section !== section || !isRecord(record?.data)) {
    throw new Error(`${section} returned an invalid section payload`);
  }
  return record;
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
  };
  const previousCatalog = base.meta.measureCatalog ?? null;
  const measureCatalogDiagnostics = [];
  base.meta.measureCatalog = buildMeasureCatalog(base, now, {
    onDiagnostic: (diagnostic) => measureCatalogDiagnostics.push(diagnostic),
  });
  base.meta.measureCatalogDiagnostics = measureCatalogDiagnostics;
  base.meta.editionSummary = buildEditionSummary(previousCatalog, base.meta.measureCatalog);
  return base;
}

export {
  PUBLICATION_CURRENT_KEY,
  PUBLICATION_HISTORY_PREFIX,
  PUBLICATION_STATUS_KEY,
  isSnapshot,
  mergePublication,
  readCurrentPublication,
  refreshSectionPayload,
};
