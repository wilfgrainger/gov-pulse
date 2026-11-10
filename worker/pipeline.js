import { readFeedRecord, writeFeedAttempt } from "./feed-store.js";
import { refreshJobs } from "./publication-plan.js";
import { RUN_TTL_SECONDS, kvGet, kvPut, runIdFor } from "./publication-run-store.js";
import { BETTING_CRON } from "./publication-schedule.js";
import { isRecord } from "../contracts/records.js";

// Three-message publication pipeline: `collect`, `finalise` and `bootstrap`.
// createPipeline() takes its collectors and publisher as injected dependencies
// (worker/pipeline-deps.js). public-data-entry.js runs cron and the three new
// message types here; legacy message types keep the legacy dispatcher, and the
// v12/v13 keys keep being written, until gate G4.

const MIN_RUN_WINDOW_MS = 25 * 60 * 1000;
const DEADLINE_MARGIN = 1.5;
// Worst measured queue-job wall time (refresh-contracts, 21,889 ms, 6 November
// 2026 tail; docs/operations/free-resource-budget.md). Used for every feed until
// per-feed p95 values exist: each feed has one measurement today, so a per-feed
// p95 would be a guess.
const DEFAULT_P95_MS = 21_889;
const FINALISE_DELAY_SECONDS = 20 * 60;
const FINALISE_RETRY_SECONDS = 5 * 60;
// Shard payloads live for the 7-day contracts window plus 3 days (design §4.1).
const SHARD_TTL_SECONDS = 10 * 24 * 60 * 60;
const SEND_BATCH_LIMIT = 100;
const RUN_PREFIX = "v20:run:";
const SCOPES = Object.freeze(["daily", "3h", "weekly", "bootstrap"]);
const FEED_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const SHARD_KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const BOOTSTRAP_RUN_PATTERN = /^bootstrap-[0-9a-f]{40}$/;

function validId(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function runKey(runId) {
  return `${RUN_PREFIX}${String(runId)}`;
}

function shardKeyFor(feedId, shard) {
  if (!validId(shard, SHARD_KEY_PATTERN)) throw new Error(`Shard key '${String(shard)}' is not valid`);
  return `v20:feed:${feedId}:shard:${shard}`;
}

function feedIdOf(job) {
  return job.type === "refresh-contracts" ? "governmentContracts" : job.section;
}

/**
 * Feed ids due for collection under a scope. Recurring scopes cover published
 * feeds only (held feeds cause no writes and no sends); bootstrap covers the
 * required feeds, plus contracts when `config.includeContracts` is true.
 */
function dueFeeds(_now, scope, config = {}) {
  if (!SCOPES.includes(scope)) throw new Error(`Unknown pipeline scope '${String(scope)}'`);
  if (scope === "weekly") return [];
  if (scope === "3h") {
    return refreshJobs("due", "betting", { publishedOnly: true }).map(feedIdOf);
  }
  const options =
    scope === "bootstrap"
      ? { includeContracts: config.includeContracts === true }
      : { publishedOnly: true };
  return refreshJobs("due", scope, options).map(feedIdOf);
}

/**
 * createdAt + max(25 min, sum of measured p95 job durations x 1.5). Feeds run
 * one at a time (consumer concurrency 1), so the serial sum bounds a healthy run.
 */
function runDeadline(createdAt, feeds, measuredP95Ms = {}) {
  const serialMs = feeds.reduce((sum, id) => {
    const measured = measuredP95Ms[id];
    return sum + (Number.isFinite(measured) && measured > 0 ? measured : DEFAULT_P95_MS);
  }, 0);
  const windowMs = Math.max(MIN_RUN_WINDOW_MS, serialMs * DEADLINE_MARGIN);
  return new Date(createdAt.getTime() + windowMs);
}

/** Validate a queue body as one of the three message types, or throw. */
function parseMessage(body) {
  if (!isRecord(body)) throw new Error("Pipeline message must be an object");
  switch (body.type) {
    case "collect":
      if (!validId(body.runId, RUN_ID_PATTERN) || !validId(body.feedId, FEED_ID_PATTERN)) {
        throw new Error("collect message needs a valid runId and feedId");
      }
      if (body.shard !== undefined && !validId(body.shard, SHARD_KEY_PATTERN)) {
        throw new Error("collect message shard is not a valid shard key");
      }
      return body;
    case "finalise":
      if (
        !validId(body.runId, RUN_ID_PATTERN) ||
        typeof body.deadlineAt !== "string" ||
        !Number.isFinite(Date.parse(body.deadlineAt))
      ) {
        throw new Error("finalise message needs a valid runId and deadlineAt");
      }
      return body;
    case "bootstrap":
      if (body.scope !== "bootstrap") throw new Error("bootstrap message needs scope 'bootstrap'");
      if (!validId(body.runId, BOOTSTRAP_RUN_PATTERN)) {
        throw new Error("bootstrap message needs a runId derived from a full commit SHA");
      }
      if (body.comparisonRefresh === true) {
        throw new Error("bootstrap comparisonRefresh is not handled by this pipeline slice");
      }
      if (
        body.feeds !== undefined &&
        (!Array.isArray(body.feeds) || !body.feeds.every((id) => validId(id, FEED_ID_PATTERN)))
      ) {
        throw new Error("bootstrap feeds must be feed ids");
      }
      return body;
    default:
      throw new Error(`Unknown pipeline message type '${String(body.type)}'`);
  }
}

/**
 * Build the pipeline handlers from injected dependencies:
 *  - collectFeed(env, feedId, {runId, now}) -> SectionRecord (unsharded feeds)
 *  - shardKeysFor(feedId, now) -> string[] | null (null when the feed is not sharded)
 *  - collectShard(env, feedId, key, {runId, now}) -> shard payload
 *  - combineShards(feedId, payloads, {env, now}) -> SectionRecord
 *  - publish(env, {runId, now}) -> {changed}
 *  - clock() and dueFeeds(now, scope, config) are optional overrides.
 */
function createPipeline(deps) {
  for (const name of ["collectFeed", "shardKeysFor", "collectShard", "combineShards", "publish"]) {
    if (typeof deps?.[name] !== "function") throw new Error(`Pipeline dependency '${name}' is required`);
  }
  const clock = typeof deps.clock === "function" ? deps.clock : () => new Date();
  const listFeeds = typeof deps.dueFeeds === "function" ? deps.dueFeeds : dueFeeds;

  function queueOf(env) {
    if (typeof env?.DATA_JOBS?.send !== "function" || typeof env?.DATA_JOBS?.sendBatch !== "function") {
      throw new Error("DATA_JOBS queue binding is required");
    }
    return env.DATA_JOBS;
  }

  async function readRun(env, runId) {
    const run = await kvGet(env, runKey(runId));
    return isRecord(run) && run.runId === runId ? run : null;
  }

  async function putRun(env, run) {
    await kvPut(env, runKey(run.runId), run, { expirationTtl: RUN_TTL_SECONDS });
  }

  function succeededIn(feed, runId) {
    return feed?.lastAttempt?.runId === runId && feed.lastAttempt.status === "success";
  }

  async function recordFailure(env, feedId, runId, error, now) {
    try {
      await writeFeedAttempt(env, feedId, runId, { error }, now);
    } catch (writeError) {
      console.warn("Feed failure record skipped", { feedId, runId, error: messageOf(writeError) });
    }
  }

  // Combine shards into the feed record once every shard for the window exists.
  // Returns false (and writes nothing) while any shard is still missing.
  async function combineFeed(env, feedId, runId, keys, now) {
    const payloads = {};
    for (const key of keys) {
      const payload = await kvGet(env, shardKeyFor(feedId, key));
      if (payload === null) return false;
      payloads[key] = payload;
    }
    const record = await deps.combineShards(feedId, payloads, { env, now });
    await writeFeedAttempt(env, feedId, runId, { record }, now);
    return true;
  }

  // Collect messages for a run. A sharded feed is queued only for shards that
  // are not yet stored; when none are missing it is combined immediately.
  async function messagesFor(env, runId, feeds, now) {
    const bodies = [];
    for (const feedId of feeds) {
      const keys = await deps.shardKeysFor(feedId, now);
      if (keys === null) {
        bodies.push({ type: "collect", runId, feedId });
        continue;
      }
      const missing = [];
      for (const key of keys) {
        if ((await kvGet(env, shardKeyFor(feedId, key))) === null) missing.push(key);
      }
      if (missing.length === 0) {
        await combineFeed(env, feedId, runId, keys, now);
      } else {
        for (const key of missing) bodies.push({ type: "collect", runId, feedId, shard: key });
      }
    }
    return bodies;
  }

  // Write-ahead lease: the collect batch is sent at most once. A redelivery that
  // finds the lease does not send it again; it sends finalise (idempotent) and
  // confirms the dispatch. If the batch send fails, the lease is released so the
  // retry sends the batch.
  async function startRun(env, now, { runId, scope, feeds }) {
    const queue = queueOf(env);
    let run = await readRun(env, runId);
    if (run?.dispatchedAt) return { status: "already-dispatched", runId, sent: 0 };
    if (!run) {
      if (feeds.length === 0) throw new Error("Pipeline run selects no feeds");
      run = {
        runId,
        scope,
        status: "running",
        createdAt: now.toISOString(),
        deadlineAt: runDeadline(now, feeds, {}).toISOString(),
        expectedFeeds: [...feeds],
        jobsEnqueuedAt: null,
        dispatchedAt: null,
        finalisedAt: null,
      };
    }
    let sent = 0;
    if (!run.jobsEnqueuedAt) {
      run = { ...run, jobsEnqueuedAt: now.toISOString() };
      await putRun(env, run);
      try {
        const bodies = await messagesFor(env, runId, run.expectedFeeds, now);
        for (let i = 0; i < bodies.length; i += SEND_BATCH_LIMIT) {
          await queue.sendBatch(bodies.slice(i, i + SEND_BATCH_LIMIT).map((body) => ({ body })));
        }
        sent = bodies.length;
      } catch (error) {
        try {
          await putRun(env, { ...run, jobsEnqueuedAt: null });
        } catch (releaseError) {
          console.error("Pipeline dispatch lease release failed", {
            runId,
            error: messageOf(releaseError),
          });
        }
        throw error;
      }
    }
    await queue.send(
      { type: "finalise", runId, deadlineAt: run.deadlineAt },
      { delaySeconds: FINALISE_DELAY_SECONDS },
    );
    await putRun(env, { ...run, dispatchedAt: now.toISOString() });
    return { status: "dispatched", runId, sent };
  }

  async function handleCollect(body, env, now) {
    const { feedId, runId } = body;
    const run = await readRun(env, runId);
    if (!run) throw new Error("Pipeline run record is unavailable");
    if (run.finalisedAt) return { status: "run-finalised" };

    const keys = await deps.shardKeysFor(feedId, now);
    if (keys === null) {
      if (body.shard !== undefined) throw new Error(`Feed '${feedId}' is not sharded`);
      const current = await readFeedRecord(env, feedId);
      if (succeededIn(current, runId)) return { status: "already-collected" };
      try {
        const record = await deps.collectFeed(env, feedId, { runId, now });
        await writeFeedAttempt(env, feedId, runId, { record }, now);
      } catch (error) {
        await recordFailure(env, feedId, runId, error, now);
        throw error;
      }
      return { status: "collected" };
    }

    if (body.shard === undefined) throw new Error(`Sharded feed '${feedId}' needs a shard`);
    if (!keys.includes(body.shard)) {
      throw new Error(`Feed '${feedId}' has no shard '${body.shard}' in this window`);
    }
    const current = await readFeedRecord(env, feedId);
    if (succeededIn(current, runId)) return { status: "already-collected" };
    const storageKey = shardKeyFor(feedId, body.shard);
    try {
      if ((await kvGet(env, storageKey)) === null) {
        const payload = await deps.collectShard(env, feedId, body.shard, { runId, now });
        await kvPut(env, storageKey, payload, { expirationTtl: SHARD_TTL_SECONDS });
      }
      const combined = await combineFeed(env, feedId, runId, keys, now);
      return { status: combined ? "combined" : "waiting-for-shards" };
    } catch (error) {
      await recordFailure(env, feedId, runId, error, now);
      throw error;
    }
  }

  async function handleFinalise(body, env, now) {
    const run = await readRun(env, body.runId);
    if (!run) throw new Error("Pipeline run record is unavailable");
    if (run.finalisedAt) return { status: "already-finalised" };

    let successes = 0;
    const missingFeeds = [];
    for (const feedId of run.expectedFeeds) {
      const feed = await readFeedRecord(env, feedId);
      if (succeededIn(feed, run.runId)) successes += 1;
      else missingFeeds.push(feedId);
    }
    const complete = missingFeeds.length === 0;
    if (!complete && now.getTime() < Date.parse(run.deadlineAt)) return { status: "pending" };

    let status = "incomplete";
    if (complete || successes > 0) {
      const result = await deps.publish(env, { runId: run.runId, now });
      if (complete) status = result?.changed === true ? "published" : "no-change";
    }
    await putRun(env, {
      ...run,
      status,
      finalisedAt: now.toISOString(),
      successfulFeeds: successes,
      missingFeeds: missingFeeds.sort(),
    });
    return { status };
  }

  async function handleBootstrap(body, env, now) {
    const selected = listFeeds(now, "bootstrap", {
      includeContracts: body.includeContracts === true,
    });
    let feeds = selected;
    if (Array.isArray(body.feeds)) {
      const unknown = body.feeds.filter((id) => !selected.includes(id));
      if (unknown.length > 0) {
        throw new Error(`Bootstrap names feeds outside its scope: ${unknown.join(", ")}`);
      }
      feeds = selected.filter((id) => body.feeds.includes(id));
    }
    return startRun(env, now, { runId: body.runId, scope: "bootstrap", feeds });
  }

  /** Cron entry: the daily scope or the three-hourly betting scope. */
  async function scheduled(controller, env) {
    const now = new Date(controller?.scheduledTime ?? clock().getTime());
    const scope = controller?.cron === BETTING_CRON ? "3h" : "daily";
    const feeds = listFeeds(now, scope, {});
    if (feeds.length === 0) return { status: "nothing-due", sent: 0 };
    return startRun(env, now, { runId: runIdFor(now), scope, feeds });
  }

  /** Queue entry. Every message is acknowledged or retried; none is dropped. */
  async function dispatch(message, env) {
    let body;
    try {
      body = parseMessage(message.body);
    } catch (error) {
      console.error("Pipeline message rejected", { error: messageOf(error) });
      message.retry({ delaySeconds: FINALISE_RETRY_SECONDS });
      return { status: "retry", reason: "invalid-message" };
    }
    const now = clock();
    try {
      if (body.type === "collect") {
        const result = await handleCollect(body, env, now);
        message.ack();
        return result;
      }
      if (body.type === "finalise") {
        const result = await handleFinalise(body, env, now);
        if (result.status === "pending") {
          // Re-enqueue rather than retry: a retry would consume max_retries
          // across the whole wait to the deadline.
          await queueOf(env).send(
            { type: "finalise", runId: body.runId, deadlineAt: body.deadlineAt },
            { delaySeconds: FINALISE_RETRY_SECONDS },
          );
        }
        message.ack();
        return result;
      }
      const result = await handleBootstrap(body, env, now);
      message.ack();
      return result;
    } catch (error) {
      if (body.type === "collect" && BOOTSTRAP_RUN_PATTERN.test(body.runId)) {
        // Bootstrap source failures are terminal, as today: the failure is
        // recorded on the feed and finalisation degrades instead of waiting.
        console.warn("Pipeline bootstrap source failure is terminal", {
          runId: body.runId,
          feedId: body.feedId,
          error: messageOf(error),
        });
        message.ack();
        return { status: "failed-terminal" };
      }
      console.error("Pipeline message failed", { type: body.type, error: messageOf(error) });
      message.retry({ delaySeconds: FINALISE_RETRY_SECONDS });
      return { status: "retry" };
    }
  }

  return { dispatch, scheduled };
}

export {
  DEFAULT_P95_MS,
  MIN_RUN_WINDOW_MS,
  SHARD_TTL_SECONDS,
  createPipeline,
  dueFeeds,
  parseMessage,
  runDeadline,
  runKey,
  shardKeyFor,
};
