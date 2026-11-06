// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { readFeedRecord } from "@/worker/feed-store";
import {
  DEFAULT_P95_MS,
  MIN_RUN_WINDOW_MS,
  createPipeline,
  dueFeeds,
  parseMessage,
  runDeadline,
  runKey,
  shardKeyFor,
} from "@/worker/pipeline";
import { refreshJobs } from "@/worker/publication-plan";
import { BETTING_CRON, DAILY_CRON } from "@/worker/publication-schedule";

type Body = Record<string, unknown>;

const NOW = new Date("2026-11-06T03:17:00.000Z");
const RUN = `bootstrap-${"a".repeat(40)}`;
const SHARDS = [
  "2026-11-01",
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
];
const FINALISE_DELAY_MS = 20 * 60 * 1000;
const RETRY_SECONDS = 300;

function makeEnv(seed: Record<string, unknown> = {}) {
  const store = new Map<string, string>(
    Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const queued: Body[] = [];
  const delays: (number | undefined)[] = [];
  const env = {
    METRICS_CACHE: {
      get: vi.fn(async (key: string) => {
        const raw = store.get(key);
        return raw === undefined ? null : JSON.parse(raw);
      }),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    },
    DATA_JOBS: {
      send: vi.fn(async (body: Body, options?: { delaySeconds?: number }) => {
        queued.push(body);
        delays.push(options?.delaySeconds);
      }),
      sendBatch: vi.fn(async (messages: { body: Body }[]) => {
        for (const item of messages) {
          queued.push(item.body);
          delays.push(undefined);
        }
      }),
    },
  };
  const read = (key: string): Record<string, unknown> | null => {
    const raw = store.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
  };
  return { env, queued, delays, read };
}

function message(body: Body) {
  return { body, attempts: 1, ack: vi.fn(), retry: vi.fn() };
}

function record(feedId: string, now: Date) {
  const fetchedAt = now.toISOString();
  return {
    section: feedId,
    data: { value: feedId },
    source: { status: "ok", cacheState: "fresh", fetchedAt, source: "fixture" },
    fetchedAt,
  };
}

function makeDeps(clock: { now: Date }, overrides: Record<string, unknown> = {}) {
  return {
    clock: () => clock.now,
    collectFeed: vi.fn(async (_env: unknown, feedId: string, options: { now: Date }) =>
      record(feedId, options.now),
    ),
    shardKeysFor: vi.fn(async (feedId: string) =>
      feedId === "governmentContracts" ? SHARDS : null,
    ),
    collectShard: vi.fn(async (_env: unknown, _feedId: string, key: string) => ({ day: key })),
    combineShards: vi.fn(async (feedId: string, _payloads: Record<string, unknown>, options: { now: Date }) =>
      record(feedId, options.now),
    ),
    publish: vi.fn(
      async (env: { METRICS_CACHE: { put: (key: string, value: string) => Promise<unknown> } }) => {
        await env.METRICS_CACHE.put("v20:edition:public", "{}");
        return { changed: true };
      },
    ),
    ...overrides,
  };
}

const collectsOf = (queued: Body[]) => queued.filter((body) => body.type === "collect");
const finalisesOf = (queued: Body[]) => queued.filter((body) => body.type === "finalise");

describe("pipeline due feeds", () => {
  it("daily matches the published collection plan, contracts included", () => {
    const idsOf = (jobs: { type: string; section?: string }[]) =>
      jobs.map((job) => (job.type === "refresh-contracts" ? "governmentContracts" : job.section));
    expect(dueFeeds(NOW, "daily")).toEqual(
      idsOf(refreshJobs("r", "daily", { publishedOnly: true })),
    );
  });

  it("held feeds are never due on a recurring scope", () => {
    expect(dueFeeds(NOW, "daily")).not.toContain("nhsStats");
    expect(dueFeeds(NOW, "3h")).toEqual([]);
  });

  it("bootstrap covers the required feeds and adds contracts only when asked", () => {
    const base = dueFeeds(NOW, "bootstrap");
    expect(base).not.toContain("governmentContracts");
    expect(dueFeeds(NOW, "bootstrap", { includeContracts: true })).toContain("governmentContracts");
  });

  it("weekly has nothing scheduled yet", () => {
    expect(dueFeeds(NOW, "weekly")).toEqual([]);
  });

  it("rejects an unknown scope", () => {
    expect(() => dueFeeds(NOW, "hourly" as never)).toThrow(/scope/);
  });
});

describe("pipeline run deadline", () => {
  it("never shortens the 25 minute window", () => {
    const deadline = runDeadline(NOW, ["gdpTracker"], { gdpTracker: 1000 });
    expect(deadline.getTime() - NOW.getTime()).toBe(MIN_RUN_WINDOW_MS);
  });

  it("is derived from measured p95 durations x 1.5 when that exceeds 25 minutes", () => {
    const feeds = Array.from({ length: 50 }, (_, i) => `feed${i}`);
    const p95 = Object.fromEntries(feeds.map((id) => [id, 40_000]));
    const deadline = runDeadline(NOW, feeds, p95);
    expect(deadline.getTime() - NOW.getTime()).toBe(50 * 40_000 * 1.5);
  });

  it("uses the measured worst case for a feed with no measurement", () => {
    const deadline = runDeadline(NOW, Array.from({ length: 100 }, (_, i) => `f${i}`), {});
    expect(deadline.getTime() - NOW.getTime()).toBe(100 * DEFAULT_P95_MS * 1.5);
  });
});

describe("pipeline messages", () => {
  it("accepts the three message types", () => {
    expect(parseMessage({ type: "collect", runId: "2026-11-06T03-17-00.000Z", feedId: "gdpTracker" }).type).toBe("collect");
    expect(parseMessage({ type: "collect", runId: "r1", feedId: "governmentContracts", shard: "2026-11-05" }).type).toBe("collect");
    expect(parseMessage({ type: "finalise", runId: "r1", deadlineAt: NOW.toISOString() }).type).toBe("finalise");
    expect(parseMessage({ type: "bootstrap", scope: "bootstrap", runId: RUN }).type).toBe("bootstrap");
  });

  it("rejects malformed messages", () => {
    expect(() => parseMessage({ type: "collect", runId: "r" })).toThrow();
    expect(() => parseMessage({ type: "collect", runId: "r", feedId: "gdpTracker", shard: "../x" })).toThrow();
    expect(() => parseMessage({ type: "finalise", runId: "r", deadlineAt: "not a date" })).toThrow();
    expect(() => parseMessage({ type: "bootstrap", scope: "bootstrap" })).toThrow(/runId/);
    expect(() => parseMessage({ type: "bootstrap", scope: "bootstrap", runId: RUN, comparisonRefresh: true })).toThrow();
    expect(() => parseMessage(null)).toThrow();
  });

  it("shard keys are namespaced per feed and reject path-like input", () => {
    expect(shardKeyFor("governmentContracts", "2026-11-05")).toBe(
      "v20:feed:governmentContracts:shard:2026-11-05",
    );
    expect(() => shardKeyFor("governmentContracts", "../other")).toThrow();
  });
});

describe("pipeline handlers", () => {
  it("unknown message type is retried, not acked", async () => {
    const { env } = makeEnv();
    const pipeline = createPipeline(makeDeps({ now: NOW }));
    const msg = message({ type: "refresh-section" });
    await pipeline.dispatch(msg, env);
    expect(msg.retry).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("bootstrap redelivery never re-sends the collect batch", async () => {
    const clock = { now: NOW };
    const { env, queued } = makeEnv();
    const pipeline = createPipeline(makeDeps(clock));
    const first = message({ type: "bootstrap", scope: "bootstrap", runId: RUN });
    await pipeline.dispatch(first, env);
    expect(first.ack).toHaveBeenCalledOnce();
    expect(env.DATA_JOBS.sendBatch).toHaveBeenCalledOnce();

    const finalisesBefore = finalisesOf(queued).length;
    const putsBefore = env.METRICS_CACHE.put.mock.calls.length;
    const redelivered = message({ type: "bootstrap", scope: "bootstrap", runId: RUN });
    await pipeline.dispatch(redelivered, env);

    expect(redelivered.ack).toHaveBeenCalledOnce();
    expect(env.DATA_JOBS.sendBatch).toHaveBeenCalledOnce();
    expect(finalisesOf(queued)).toHaveLength(finalisesBefore);
    expect(env.METRICS_CACHE.put.mock.calls.length).toBe(putsBefore);
  });

  it("a bootstrap that crashed after its lease never re-sends the batch, but still sends finalise", async () => {
    const clock = { now: NOW };
    const seeded = {
      runId: RUN,
      scope: "bootstrap",
      status: "running",
      createdAt: NOW.toISOString(),
      deadlineAt: new Date(NOW.getTime() + MIN_RUN_WINDOW_MS).toISOString(),
      expectedFeeds: ["gdpTracker"],
      jobsEnqueuedAt: NOW.toISOString(),
      dispatchedAt: null,
      finalisedAt: null,
    };
    const { env, queued, read } = makeEnv({ [runKey(RUN)]: seeded });
    const pipeline = createPipeline(makeDeps(clock));
    const msg = message({ type: "bootstrap", scope: "bootstrap", runId: RUN });
    await pipeline.dispatch(msg, env);

    expect(msg.ack).toHaveBeenCalledOnce();
    expect(env.DATA_JOBS.sendBatch).not.toHaveBeenCalled();
    expect(finalisesOf(queued)).toHaveLength(1);
    expect(read(runKey(RUN))).toMatchObject({ dispatchedAt: NOW.toISOString() });
  });

  it("a redelivered collect after success writes nothing", async () => {
    const clock = { now: NOW };
    const { env, queued } = makeEnv();
    const deps = makeDeps(clock);
    const pipeline = createPipeline(deps);
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
    const body = collectsOf(queued).find((item) => item.feedId === "gdpTracker") as Body;

    await pipeline.dispatch(message(body), env);
    const putsAfterFirst = env.METRICS_CACHE.put.mock.calls.length;
    const again = message(body);
    await pipeline.dispatch(again, env);

    expect(again.ack).toHaveBeenCalledOnce();
    expect(env.METRICS_CACHE.put.mock.calls.length).toBe(putsAfterFirst);
    expect(deps.collectFeed).toHaveBeenCalledTimes(1);
  });

  it("sharded feed collects only missing shards", async () => {
    const clock = { now: NOW };
    const seed = Object.fromEntries(
      SHARDS.slice(0, 2).map((key) => [shardKeyFor("governmentContracts", key), { day: key }]),
    );
    const { env, queued } = makeEnv(seed);
    const deps = makeDeps(clock);
    const pipeline = createPipeline(deps);
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);

    const contracts = collectsOf(queued).filter((item) => item.feedId === "governmentContracts");
    expect(contracts.map((item) => item.shard)).toEqual(SHARDS.slice(2));
    for (const body of contracts) await pipeline.dispatch(message(body), env);

    expect(deps.collectShard).toHaveBeenCalledTimes(SHARDS.length - 2);
    expect(deps.combineShards).toHaveBeenCalledTimes(1);
    expect(await readFeedRecord(env, "governmentContracts")).toMatchObject({
      lastAttempt: { status: "success" },
    });
  });

  it("a shard already stored is never re-collected when its message is delivered", async () => {
    const clock = { now: NOW };
    const seed = Object.fromEntries(
      SHARDS.slice(0, 2).map((key) => [shardKeyFor("governmentContracts", key), { day: key }]),
    );
    const { env, queued } = makeEnv(seed);
    const deps = makeDeps(clock);
    const pipeline = createPipeline(deps);
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);

    const runId = String(finalisesOf(queued)[0].runId);
    const redelivered = message({ type: "collect", runId, feedId: "governmentContracts", shard: SHARDS[0] });
    await pipeline.dispatch(redelivered, env);

    expect(redelivered.ack).toHaveBeenCalledOnce();
    expect(deps.collectShard).not.toHaveBeenCalled();
  });

  it("sharded feed with every shard stored combines at dispatch and sends no shard message", async () => {
    const clock = { now: NOW };
    const seed = Object.fromEntries(
      SHARDS.map((key) => [shardKeyFor("governmentContracts", key), { day: key }]),
    );
    const { env, queued } = makeEnv(seed);
    const deps = makeDeps(clock);
    const pipeline = createPipeline(deps);
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);

    expect(collectsOf(queued).filter((item) => item.feedId === "governmentContracts")).toHaveLength(0);
    expect(deps.collectShard).not.toHaveBeenCalled();
    expect(deps.combineShards).toHaveBeenCalledTimes(1);
  });

  it("a daily collect failure records the failure and retries rather than acknowledging", async () => {
    const clock = { now: NOW };
    const { env, queued, read } = makeEnv();
    const deps = makeDeps(clock, {
      collectFeed: vi.fn(async () => {
        throw new Error("upstream 503");
      }),
    });
    const pipeline = createPipeline(deps);
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
    const msg = message(collectsOf(queued)[0]);
    await pipeline.dispatch(msg, env);

    expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: RETRY_SECONDS });
    expect(msg.ack).not.toHaveBeenCalled();
    expect(read(`v20:feed:${String(msg.body.feedId)}`)).toMatchObject({
      lastAttempt: { status: "failure", reason: "upstream 503" },
    });
  });

  it("a bootstrap collect failure is recorded and acknowledged so finalisation can degrade", async () => {
    const clock = { now: NOW };
    const { env, queued, read } = makeEnv();
    const deps = makeDeps(clock, {
      collectFeed: vi.fn(async () => {
        throw new Error("source blocked");
      }),
    });
    const pipeline = createPipeline(deps);
    await pipeline.dispatch(message({ type: "bootstrap", scope: "bootstrap", runId: RUN }), env);
    const msg = message(collectsOf(queued)[0]);
    await pipeline.dispatch(msg, env);

    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.retry).not.toHaveBeenCalled();
    expect(read(`v20:feed:${String(msg.body.feedId)}`)).toMatchObject({
      lastAttempt: { status: "failure", runId: RUN },
    });
  });

  it("a redelivered finalise after success writes nothing", async () => {
    const clock = { now: NOW };
    const { env, queued, read } = makeEnv();
    const deps = makeDeps(clock);
    const pipeline = createPipeline(deps);
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
    for (const body of collectsOf(queued)) await pipeline.dispatch(message(body), env);
    clock.now = new Date(NOW.getTime() + FINALISE_DELAY_MS);
    const finalise = finalisesOf(queued)[0];
    const first = message(finalise);
    await pipeline.dispatch(first, env);
    expect(read(runKey(String(finalise.runId)))).toMatchObject({ status: "published" });

    const putsBefore = env.METRICS_CACHE.put.mock.calls.length;
    const publishBefore = deps.publish.mock.calls.length;
    const again = message(finalise);
    await pipeline.dispatch(again, env);

    expect(again.ack).toHaveBeenCalledOnce();
    expect(env.METRICS_CACHE.put.mock.calls.length).toBe(putsBefore);
    expect(deps.publish.mock.calls.length).toBe(publishBefore);
  });

  it("a late collect after finalisation writes nothing", async () => {
    const clock = { now: NOW };
    const { env, queued } = makeEnv();
    const pipeline = createPipeline(makeDeps(clock));
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
    const bodies = collectsOf(queued);
    for (const body of bodies) await pipeline.dispatch(message(body), env);
    clock.now = new Date(NOW.getTime() + FINALISE_DELAY_MS);
    await pipeline.dispatch(message(finalisesOf(queued)[0]), env);

    const putsBefore = env.METRICS_CACHE.put.mock.calls.length;
    const late = message(bodies[0]);
    await pipeline.dispatch(late, env);
    expect(late.ack).toHaveBeenCalledOnce();
    expect(env.METRICS_CACHE.put.mock.calls.length).toBe(putsBefore);
  });

  it("a pending finalise re-enqueues itself instead of consuming a retry", async () => {
    const clock = { now: NOW };
    const { env, queued, delays } = makeEnv();
    const pipeline = createPipeline(makeDeps(clock));
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
    const bodies = collectsOf(queued);
    for (const body of bodies.slice(0, -1)) await pipeline.dispatch(message(body), env);
    clock.now = new Date(NOW.getTime() + FINALISE_DELAY_MS);

    const finalise = message(finalisesOf(queued)[0]);
    await pipeline.dispatch(finalise, env);

    expect(finalise.ack).toHaveBeenCalledOnce();
    expect(finalise.retry).not.toHaveBeenCalled();
    expect(delays[delays.length - 1]).toBe(RETRY_SECONDS);
    expect(finalisesOf(queued)).toHaveLength(2);
  });

  it("deadline passed with partial success finalises incomplete", async () => {
    const clock = { now: NOW };
    const { env, queued, read } = makeEnv();
    const deps = makeDeps(clock);
    const pipeline = createPipeline(deps);
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
    const bodies = collectsOf(queued);
    for (const body of bodies.slice(0, 3)) await pipeline.dispatch(message(body), env);
    clock.now = new Date(NOW.getTime() + 60 * 60 * 1000);

    const finalise = message(finalisesOf(queued)[0]);
    await pipeline.dispatch(finalise, env);

    expect(finalise.ack).toHaveBeenCalledOnce();
    expect(deps.publish).toHaveBeenCalledOnce();
    expect(read(runKey(String(finalisesOf(queued)[0].runId)))).toMatchObject({
      status: "incomplete",
      finalisedAt: clock.now.toISOString(),
    });
  });

  it("50 synthetic feeds at measured p95 finalise complete before the derived deadline", async () => {
    const feeds = Array.from({ length: 50 }, (_, i) => `feed${String(i).padStart(2, "0")}`);
    const clock = { now: NOW };
    const { env, queued, read } = makeEnv();
    const pipeline = createPipeline(makeDeps(clock, { dueFeeds: () => feeds }));
    await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
    const bodies = collectsOf(queued);
    expect(bodies).toHaveLength(50);
    for (const body of bodies) {
      clock.now = new Date(clock.now.getTime() + DEFAULT_P95_MS);
      await pipeline.dispatch(message(body), env);
    }
    clock.now = new Date(NOW.getTime() + FINALISE_DELAY_MS);
    await pipeline.dispatch(message(finalisesOf(queued)[0]), env);

    const run = read(runKey(String(finalisesOf(queued)[0].runId))) as { status: string; deadlineAt: string };
    expect(run.status).toBe("published");
    expect(Date.parse(run.deadlineAt)).toBeGreaterThan(clock.now.getTime());
  });
});
