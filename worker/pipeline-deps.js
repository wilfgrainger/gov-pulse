import { definition as contractsDefinition } from "../feeds/government-contracts/feed.js";
import {
  collectShard as collectContractsDay,
  combine as combineContractsDays,
  previousCompleteDays,
} from "../feeds/government-contracts/parse.js";
import { collectExternalSection } from "./live-feed-collectors.js";
import { refreshSectionPayload } from "./publication-entry.js";
import { collectionPlanFor } from "./publication-plan.js";
import { publishFromCaches } from "./publication-publisher.js";

// Real dependencies for createPipeline() (worker/pipeline.js): collectors from
// createCollectorDeps() and the existing publisher. NOT wired into the Worker
// entry yet.
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

/** Every createPipeline() dependency, backed by live collectors and the publisher. */
function createPipelineDeps(overrides = {}) {
  return {
    ...createCollectorDeps(overrides),
    publish: (env, { runId, now }) => publishFromCaches(env, { runId, now }),
  };
}

export { createCollectorDeps, createPipelineDeps };
