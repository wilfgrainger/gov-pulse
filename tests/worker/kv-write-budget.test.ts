// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

// Fixture collectors for the wired data Worker; the injected-deps tests below
// never reach these modules.
const collectors = vi.hoisted(() => ({ section: vi.fn(), external: vi.fn(), shard: vi.fn() }));
vi.mock("@/worker/publication-entry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/worker/publication-entry")>()),
  refreshSectionPayload: (...args: unknown[]) => collectors.section(...args),
}));
vi.mock("@/worker/live-feed-collectors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/worker/live-feed-collectors")>()),
  collectExternalSection: (...args: unknown[]) => collectors.external(...args),
}));
vi.mock("@/feeds/government-contracts/parse.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/feeds/government-contracts/parse.js")>()),
  collectShard: (...args: unknown[]) => collectors.shard(...args),
}));

import { createPipeline, runKey, shardKeyFor } from "@/worker/pipeline";
import { BETTING_CRON, DAILY_CRON } from "@/worker/publication-schedule";
import { collectorDefaults, runDaily, seededHarness } from "@/tests/fixtures/wired-pipeline";

type Body = Record<string, unknown>;

const NOW = new Date("2026-11-06T03:17:00.000Z");
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

function makeEnv(seed: Record<string, unknown> = {}) {
  const store = new Map<string, string>(
    Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const queued: Body[] = [];
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
      send: vi.fn(async (body: Body) => {
        queued.push(body);
      }),
      sendBatch: vi.fn(async (messages: { body: Body }[]) => {
        for (const item of messages) queued.push(item.body);
      }),
    },
  };
  const read = (key: string): Record<string, unknown> | null => {
    const raw = store.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
  };
  return { env, queued, read };
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
    // Stands in for the publisher's single public-artifact write.
    publish: vi.fn(
      async (env: { METRICS_CACHE: { put: (key: string, value: string) => Promise<unknown> } }) => {
        await env.METRICS_CACHE.put("v20:edition:public", "{}");
        return { changed: true };
      },
    ),
    ...overrides,
  };
}

async function runDailyToCompletion(
  pipeline: ReturnType<typeof createPipeline>,
  env: unknown,
  queued: Body[],
  clock: { now: Date },
) {
  await pipeline.scheduled({ cron: DAILY_CRON, scheduledTime: NOW.getTime() }, env);
  for (const body of queued.filter((item) => item.type === "collect")) {
    await pipeline.dispatch(message(body), env);
  }
  clock.now = new Date(NOW.getTime() + FINALISE_DELAY_MS);
  const finalises = queued.filter((item) => item.type === "finalise");
  await pipeline.dispatch(message(finalises[finalises.length - 1]), env);
  return finalises[finalises.length - 1];
}

describe("kv budget", () => {
  it("healthy daily run with current publications writes at most 16 keys", async () => {
    const clock = { now: NOW };
    const seed = Object.fromEntries(
      SHARDS.slice(0, 6).map((key) => [shardKeyFor("governmentContracts", key), { day: key }]),
    );
    const { env, queued, read } = makeEnv(seed);
    const pipeline = createPipeline(makeDeps(clock));

    const finalise = await runDailyToCompletion(pipeline, env, queued, clock);
    const run = read(runKey(String(finalise.runId))) as { expectedFeeds: string[]; status: string };

    expect(run.status).toBe("published");
    expect(run.expectedFeeds).not.toContain("nhsStats");
    // Lease + dispatched + finalised (3 run writes), one write per feed (10),
    // contracts as one shard plus one combined feed record (2), and one publish.
    expect(run.expectedFeeds).toHaveLength(11);
    expect(env.METRICS_CACHE.put.mock.calls.length).toBeLessThanOrEqual(16);
    expect(env.METRICS_CACHE.put.mock.calls.length).toBe(16);
  });

  it("held feeds produce zero writes and zero sends on cron", async () => {
    const clock = { now: NOW };
    const { env } = makeEnv();
    const pipeline = createPipeline(makeDeps(clock));

    const result = await pipeline.scheduled({ cron: BETTING_CRON, scheduledTime: NOW.getTime() }, env);

    expect(result).toEqual({ status: "nothing-due", sent: 0 });
    expect(env.METRICS_CACHE.get).not.toHaveBeenCalled();
    expect(env.METRICS_CACHE.put).not.toHaveBeenCalled();
    expect(env.DATA_JOBS.send).not.toHaveBeenCalled();
    expect(env.DATA_JOBS.sendBatch).not.toHaveBeenCalled();
  });

  it("50 synthetic published feeds write at most 60 keys", async () => {
    const feeds = Array.from({ length: 50 }, (_, i) => `feed${String(i).padStart(2, "0")}`);
    const clock = { now: NOW };
    const { env, queued } = makeEnv();
    const pipeline = createPipeline(makeDeps(clock, { dueFeeds: () => feeds }));

    await runDailyToCompletion(pipeline, env, queued, clock);

    // Lease + dispatched + finalised (3), 50 feed writes, one publish.
    expect(env.METRICS_CACHE.put.mock.calls.length).toBe(54);
    expect(env.METRICS_CACHE.put.mock.calls.length).toBeLessThanOrEqual(60);
  });
});

describe("kv budget, wired data Worker (dual-write window until G4)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("healthy daily run through cron and Queue with real config writes at most 50 keys", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("offline", { status: 503 })));
    vi.spyOn(console, "log").mockImplementation(() => {});
    collectors.section.mockImplementation(collectorDefaults.section);
    collectors.external.mockImplementation(collectorDefaults.external);
    collectors.shard.mockImplementation(collectorDefaults.shard);
    const h = seededHarness();

    const { runId } = await runDaily(h);

    expect(h.read(runKey(runId)).status).toBe("published");
    const keys = h.putKeys();
    // 3 run writes; 10 feed records + 10 legacy fragments; contracts: 1 shard,
    // feed record and legacy record; publish: public, current, status; and the
    // new archive edition (content, index). Test count, not a production one.
    expect(keys.filter((key) => key.startsWith("v20:run:"))).toHaveLength(3);
    expect(keys.filter((key) => /^v20:feed:[A-Za-z]+$/.test(key))).toHaveLength(11);
    expect(keys.filter((key) => key.startsWith("v12:publication:section:"))).toHaveLength(10);
    expect(keys.filter((key) => key.startsWith("v1:edition:"))).toHaveLength(2);
    expect(keys.length).toBe(31);
    expect(keys.length).toBeLessThanOrEqual(50);
  });
});
