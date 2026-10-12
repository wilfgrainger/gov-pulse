import { refreshGovernmentContracts } from "./government-contracts-cloudflare.js";
import {
  INTERNATIONAL_COMPARISON_REFRESH_BATCHES,
  refreshInternationalComparison,
} from "./international-comparison-publication.js";
import { kvGet } from "./publication-run-store.js";
import { comparisonBatchBaseKey } from "./publication-comparison-runner.js";
import {
  storeExternalSection,
  storeSectionFragment,
} from "./publication-collection-runner.js";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function processQueueJob(job, env, ctx, options = {}) {
  if (job?.type === "refresh-international-comparison") {
    if (typeof job.batchId === "string") {
      const batch = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === job.batchId);
      const baseRecord = await kvGet(env, comparisonBatchBaseKey(job.runId));
      if (!batch || !isRecord(baseRecord?.publication)) {
        throw new Error("International comparison batch baseline is not available");
      }
      const result = await refreshInternationalComparison(env, {
        fetchImpl: options.fetchImpl ?? fetch,
        now: options.now ?? new Date(),
        force: job.force === true,
        sourceIds: job.sourceIds,
        currentPublication: baseRecord.publication,
        publish: false,
      });
      const publication = result.publication;
      return {
        type: job.type,
        updated: result.updated,
        due: result.due,
        comparisonFragment: {
          batchId: batch.id,
          meta: {
            generatedAt: publication.meta.generatedAt,
            checkedAt: publication.meta.checkedAt,
            attemptedSources: publication.meta.attemptedSources ?? [...batch.sourceIds],
            sourceFailures: publication.meta.sourceFailures ?? [],
          },
          measures: Object.fromEntries(batch.measureIds.map((id) => [id, publication.measures[id]])),
        },
      };
    }
    const result = await refreshInternationalComparison(env, {
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now ?? new Date(),
      force: job.force === true,
      ...(Array.isArray(job.sourceIds) ? { sourceIds: job.sourceIds } : {}),
    });
    return { type: job.type, updated: result.updated, due: result.due };
  }

  if (job?.type === "refresh-section") {
    const record = await storeSectionFragment(String(job.section ?? ""), env, ctx);
    return { type: job.type, section: record.section, fetchedAt: record.fetchedAt };
  }

  if (job?.type === "refresh-external-section") {
    const record = await storeExternalSection(String(job.section ?? ""), env, {
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now ?? new Date(),
    });
    return { type: job.type, section: record.section, fetchedAt: record.fetchedAt };
  }

  if (job?.type === "refresh-contracts") {
    const result = await refreshGovernmentContracts(env, {
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now,
      force: job.force === true,
    });
    return {
      type: job.type,
      updated: result.updated,
      collectedDays: result.collected,
      requestsMade: result.requestsMade,
    };
  }

  throw new Error("Unknown Cloudflare data publication job");
}

export { processQueueJob };
