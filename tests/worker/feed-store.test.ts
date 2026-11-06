// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { FEED_KEY_PREFIX, readFeedRecord, writeFeedAttempt } from "@/worker/feed-store";

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const put = vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  });
  const get = vi.fn(async (key: string) => {
    const raw = store.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  });
  return { env: { METRICS_CACHE: { get, put } }, store, get, put };
}

function gdpRecord(fetchedAt: string, monthlyGrowth = 0.1) {
  return {
    section: "gdpTracker",
    data: { headline: { monthlyGrowth, period: "May 2026" } },
    source: { status: "ok", cacheState: "fresh", fetchedAt, source: "ONS GDP monthly estimate" },
    fetchedAt,
  };
}

const NOW = new Date("2026-07-18T03:30:00.000Z");
const MUCH_LATER = new Date("2026-12-18T03:30:00.000Z");

describe("feed records", () => {
  it("uses the v20:feed: key prefix", () => {
    expect(FEED_KEY_PREFIX).toBe("v20:feed:");
  });

  it("returns null for a feed that has never been written", async () => {
    const { env } = kvEnv();
    await expect(readFeedRecord(env, "gdpTracker")).resolves.toBeNull();
  });

  it("success writes exactly one put", async () => {
    const { env, put, store } = kvEnv();
    const record = gdpRecord("2026-07-18T03:20:00.000Z");

    await expect(
      writeFeedAttempt(env, "gdpTracker", "run-1", { record }, NOW),
    ).resolves.toBe("written");

    expect(put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(`${FEED_KEY_PREFIX}gdpTracker`)!)).toEqual({
      feedId: "gdpTracker",
      record,
      lastAttempt: { runId: "run-1", at: NOW.toISOString(), status: "success", reason: null },
    });
    await expect(readFeedRecord(env, "gdpTracker")).resolves.toMatchObject({
      feedId: "gdpTracker",
      record,
    });
  });

  it("failed attempt keeps prior evidence only within validity", async () => {
    const prior = gdpRecord("2026-07-18T03:20:00.000Z");
    const { env, put, store } = kvEnv({
      [`${FEED_KEY_PREFIX}gdpTracker`]: {
        feedId: "gdpTracker",
        record: prior,
        lastAttempt: { runId: "run-0", at: prior.fetchedAt, status: "success", reason: null },
      },
    });

    await writeFeedAttempt(env, "gdpTracker", "run-1", { error: new Error("upstream 503") }, NOW);
    const within = JSON.parse(store.get(`${FEED_KEY_PREFIX}gdpTracker`)!);
    expect(within.record).toEqual(prior);
    expect(within.lastAttempt).toEqual({
      runId: "run-1",
      at: NOW.toISOString(),
      status: "failure",
      reason: "upstream 503",
    });
    expect(put).toHaveBeenCalledTimes(1);

    await writeFeedAttempt(env, "gdpTracker", "run-2", { error: new Error("upstream 503") }, MUCH_LATER);
    const beyond = JSON.parse(store.get(`${FEED_KEY_PREFIX}gdpTracker`)!);
    expect(beyond.record).toBeNull();
    expect(beyond.lastAttempt.status).toBe("failure");
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("older retrieval never replaces newer", async () => {
    const newer = gdpRecord("2026-07-18T03:25:00.000Z", 0.2);
    const older = gdpRecord("2026-07-18T03:10:00.000Z", 0.1);
    const { env, put, store } = kvEnv({
      [`${FEED_KEY_PREFIX}gdpTracker`]: {
        feedId: "gdpTracker",
        record: newer,
        lastAttempt: { runId: "run-0", at: newer.fetchedAt, status: "success", reason: null },
      },
    });

    await expect(
      writeFeedAttempt(env, "gdpTracker", "run-1", { record: older }, NOW),
    ).resolves.toBe("kept-newer");

    expect(put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(`${FEED_KEY_PREFIX}gdpTracker`)!).record).toEqual(newer);
  });

  it("rejects a record that belongs to another feed", async () => {
    const { env, put } = kvEnv();
    await expect(
      writeFeedAttempt(env, "realWages", "run-1", { record: gdpRecord("2026-07-18T03:20:00.000Z") }, NOW),
    ).rejects.toThrow("realWages");
    expect(put).not.toHaveBeenCalled();
  });

  it("does not treat an unreadable stored value as evidence", async () => {
    const { env } = kvEnv({ [`${FEED_KEY_PREFIX}gdpTracker`]: { feedId: "other", record: {} } });
    await expect(readFeedRecord(env, "gdpTracker")).resolves.toBeNull();
  });
});
