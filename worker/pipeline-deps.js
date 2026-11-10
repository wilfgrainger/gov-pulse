import { definition as contractsDefinition } from "../feeds/government-contracts/feed.js";
import {
  CURRENT_RECORD_KEY as CONTRACT_CURRENT_RECORD_KEY,
  collectShard as collectContractsDay,
  combine as combineContractsDays,
  previousCompleteDays,
} from "../feeds/government-contracts/parse.js";
import { collectExternalSection } from "./live-feed-collectors.js";
import { sectionFragmentKey, writeGlobalFragment } from "./publication-collection-runner.js";
import { refreshSectionPayload } from "./publication-entry.js";
import { collectionPlanFor } from "./publication-plan.js";
import { publishFromCaches } from "./publication-publisher.js";
import { isRecord } from "../contracts/records.js";

// Real dependencies for createPipeline() (worker/pipeline.js): collectors from
// createCollectorDeps() and the existing publisher. The data Worker entry
// (public-data-entry.js) runs its cron and new-type Queue messages on them.
//
// Sharded feeds handled here: governmentContracts only. International
// comparison batches need a baseline publication and stay on the legacy runner
// until the pipeline accepts comparisonRefresh.
const SHARDED = Object.freeze({
  governmentContracts: {
    keys: (now) => previousCompleteDays(now, contractsDefinition.shards.window),
    collect: (key, ctx) => collectContractsDay(ctx, key),
    combine: (shards, ctx) => combineContractsDays(shards, ctx),
    sourceLabel: contractsDefinition.uiSourceLabels[0],
    legacyKey: CONTRACT_CURRENT_RECORD_KEY,
  },
});

function createCollectorDeps(overrides = {}) {
  const collectSection = overrides.collectSection ?? refreshSectionPayload;
  const collectExternal = overrides.collectExternal ?? collectExternalSection;
  const fetchImpl = overrides.fetchImpl ?? ((...args) => fetch(...args));

  async function collectFeed(env, feedId, { runId, now }) {
    const plan = collectionPlanFor(feedId);
    if (plan?.jobType === "refresh-section") return collectSection(feedId, env, undefined, now);
    if (plan?.jobType === "refresh-external-section") {
      return collectExternal(feedId, { fetchImpl, now, runId });
    }
    throw new Error(`Feed '${feedId}' has no collector in the pipeline`);
  }

  async function shardKeysFor(feedId, now) {
    return SHARDED[feedId]?.keys(now) ?? null;
  }

  async function collectShard(_env, feedId, key, { now }) {
    const feed = SHARDED[feedId];
    if (!feed) throw new Error(`Feed '${feedId}' is not sharded`);
    return feed.collect(key, { fetch: fetchImpl, now });
  }

  async function combineShards(feedId, payloads, { now }) {
    const feed = SHARDED[feedId];
    if (!feed) throw new Error(`Feed '${feedId}' is not sharded`);
    const combined = feed.combine(payloads, { now });
    // Missing or unreconciled shards are unavailable evidence, never a partial record.
    if (!combined?.data) throw new Error(`Feed '${feedId}' shard window is incomplete`);
    return {
      section: feedId,
      data: combined.data,
      fetchedAt: now.toISOString(),
      sourceLabel: feed.sourceLabel,
    };
  }

  return { collectFeed, shardKeysFor, collectShard, combineShards };
}

// Until gate G4 the pipeline also keeps the shared legacy keys current: the
// previous revision reads them on rollback (contracts only from its legacy key)
// and the publisher's divergence log compares them with the feed records. A
// legacy write failure never fails a collection the pipeline accepted.
async function writeLegacyCopy(env, key, feedId, record, now) {
  // A record for another feed is refused by the feed-record write; never copy it.
  if (record?.section !== feedId || !isRecord(record.data)) return record;
  try {
    await writeGlobalFragment(env, key, record, { now });
  } catch (error) {
    console.warn("Legacy fragment dual-write failed", {
      section: record?.section ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return record;
}

/** Every createPipeline() dependency, backed by live collectors and the publisher. */
function createPipelineDeps(overrides = {}) {
  const collectors = createCollectorDeps(overrides);
  return {
    ...collectors,
    collectFeed: async (env, feedId, options) =>
      writeLegacyCopy(env, sectionFragmentKey(feedId), feedId, await collectors.collectFeed(env, feedId, options), options.now),
    combineShards: async (feedId, payloads, options) =>
      writeLegacyCopy(options.env, SHARDED[feedId].legacyKey, feedId, await collectors.combineShards(feedId, payloads, options), options.now),
    publish: (env, { runId, now }) => publishFromCaches(env, { runId, now }),
  };
}

export { createCollectorDeps, createPipelineDeps };
