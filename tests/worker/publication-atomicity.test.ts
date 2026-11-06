// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  enqueuePublicationRun,
  publishFromCaches,
} from "@/worker/queued-publication-entry";
import { writeSectionFragment } from "@/worker/publication-collection-runner";
import { PUBLICATION_CURRENT_KEY, PUBLICATION_STATUS_KEY } from "@/worker/publication-entry";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";
import { PUBLIC_SNAPSHOT_KEY } from "@/worker/public-snapshot";
import { RUN_PREFIX, runKey } from "@/worker/publication-run-store";

const REQUIRED = [
  "sentimentPulse",
  "gdpTracker",
  "employmentStats",
  "nationalDebt",
  "taxRevenue",
  "migrationStats",
  "housePriceIndex",
  "realWages",
  "electionPolling",
  "nhsStats",
];

type PutOptions = { metadata?: Record<string, unknown>; expirationTtl?: number };

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  const metadata = new Map<string, Record<string, unknown>>();
  const read = (key: string, type?: "json" | "text") => {
    const value = store.get(key);
    if (value === undefined) return null;
    if (type === "text") return typeof value === "string" ? value : JSON.stringify(value);
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch { return value; }
    }
    return structuredClone(value);
  };
  const write = async (key: string, value: string, options?: PutOptions) => {
    try {
      store.set(key, JSON.parse(value));
    } catch {
      store.set(key, value);
    }
    if (options?.metadata) metadata.set(key, options.metadata);
  };
  const sendBatch = vi.fn<(messages: unknown[]) => Promise<void>>(async () => undefined);
  const send = vi.fn<(body: unknown, options?: unknown) => Promise<void>>(async () => undefined);
  return {
    store,
    metadata,
    write,
    sendBatch,
    send,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string, type?: "json" | "text") => read(key, type)),
        getWithMetadata: vi.fn(async (key: string, type?: "json" | "text") => ({
          value: read(key, type),
          metadata: metadata.get(key) ?? null,
        })),
        put: vi.fn(write),
        delete: vi.fn(async (key: string) => {
          store.delete(key);
          metadata.delete(key);
        }),
      },
      DATA_JOBS: { sendBatch, send },
    },
  };
}

function snapshot() {
  const fetchedAt = "2026-07-17T10:00:00.000Z";
  const sources = Object.fromEntries(
    REQUIRED.map((section) => [section, { status: "ok", cacheState: "fresh", fetchedAt }])
  );
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: "2026-07-17T12:00:00.000Z",
      fetchedAt: "2026-07-17T12:00:00.000Z",
      sources,
    },
    ...Object.fromEntries(REQUIRED.map((section) => [section, { value: section }])),
    migrationStats: { headline: { netMigration: 171_000 } },
    realWages: { headline: { regularPayRealGrowthPercent: 0.6, totalPayRealGrowthPercent: 0.9 } },
  };
}

function gdpFragment(fetchedAt: string, monthlyGrowth: number, status = "ok") {
  return {
    section: "gdpTracker",
    data: { headline: { monthlyGrowth, period: "May 2026" } },
    source: {
      status,
      cacheState: status === "ok" ? "fresh" : "stale",
      fetchedAt,
      source: "ONS GDP monthly estimate",
    },
    fetchedAt,
  };
}

const NOW = new Date("2026-08-01T03:17:00.000Z");

describe("publication atomicity", () => {
  it("enqueue after a failed final KV write does not resend the job batch", async () => {
    const { env, sendBatch, send, store, write } = kvEnv();
    let failDispatchConfirmation = true;
    env.METRICS_CACHE.put = vi.fn(async (key: string, value: string, options?: PutOptions) => {
      const parsed = JSON.parse(value);
      if (failDispatchConfirmation && key === runKey(parsed.runId) && parsed.dispatchedAt) {
        failDispatchConfirmation = false;
        throw new Error("simulated final KV write failure");
      }
      return write(key, value, options);
    });

    await expect(enqueuePublicationRun(env, NOW)).rejects.toThrow(
      "simulated final KV write failure"
    );
    const retried = await enqueuePublicationRun(env, NOW);

    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(retried.run.dispatchedAt).toBeTruthy();
    expect((store.get(runKey(retried.run.runId)) as { dispatchedAt: string }).dispatchedAt)
      .toBeTruthy();
    expect(send.mock.calls.every(([body]) =>
      (body as { type: string }).type === "finalise-run"
    )).toBe(true);
    expect(send).toHaveBeenCalled();

    await enqueuePublicationRun(env, NOW);
    expect(sendBatch).toHaveBeenCalledTimes(1);
  });

  it("a failed finaliser send is retried without re-enqueueing jobs", async () => {
    const { env, sendBatch, send, store } = kvEnv();
    send.mockRejectedValueOnce(new Error("simulated finaliser send failure"));

    await expect(enqueuePublicationRun(env, NOW)).rejects.toThrow(
      "simulated finaliser send failure"
    );
    const retried = await enqueuePublicationRun(env, NOW);

    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "finalise-run", runId: retried.run.runId }),
      expect.objectContaining({ delaySeconds: expect.any(Number) })
    );
    expect(retried.dispatched).toBe(true);
    expect((store.get(runKey(retried.run.runId)) as { dispatchedAt: string }).dispatchedAt)
      .toBeTruthy();
  });

  it("an older retried job cannot overwrite a newer fragment", async () => {
    const { env, store } = kvEnv();
    const now = new Date("2026-07-18T03:30:00.000Z");
    const newer = gdpFragment("2026-07-18T03:20:00.000Z", 0.3);
    const older = gdpFragment("2026-07-18T02:10:00.000Z", 0.1);

    await expect(writeSectionFragment(env, "run-new", "gdpTracker", newer, { now }))
      .resolves.toBe("written");
    await expect(writeSectionFragment(env, "run-old", "gdpTracker", older, { now }))
      .resolves.toBe("kept-newer");

    expect(store.get("v12:publication:section:gdpTracker")).toEqual(newer);
    expect(store.get(`${RUN_PREFIX}run-old:section:gdpTracker`)).toEqual(older);
    expect(store.get(`${RUN_PREFIX}run-new:section:gdpTracker`)).toEqual(newer);
  });

  it("a non-current record does not replace a still-valid fragment", async () => {
    const { env, store } = kvEnv();
    const now = new Date("2026-07-18T03:30:00.000Z");
    const valid = gdpFragment("2026-07-18T01:00:00.000Z", 0.3);
    const failed = gdpFragment("2026-07-18T03:25:00.000Z", 0.1, "error");

    await writeSectionFragment(env, "run-a", "gdpTracker", valid, { now });
    await expect(writeSectionFragment(env, "run-b", "gdpTracker", failed, { now }))
      .resolves.toBe("kept-newer");

    expect(store.get("v12:publication:section:gdpTracker")).toEqual(valid);
  });

  it("a newer or equal record replaces the stored fragment idempotently", async () => {
    const { env, store } = kvEnv();
    const now = new Date("2026-07-18T03:30:00.000Z");
    const first = gdpFragment("2026-07-18T03:00:00.000Z", 0.1);
    const second = gdpFragment("2026-07-18T03:20:00.000Z", 0.2);

    await writeSectionFragment(env, "run-a", "gdpTracker", first, { now });
    await expect(writeSectionFragment(env, "run-a", "gdpTracker", first, { now }))
      .resolves.toBe("written");
    await expect(writeSectionFragment(env, "run-b", "gdpTracker", second, { now }))
      .resolves.toBe("written");

    expect(store.get("v12:publication:section:gdpTracker")).toEqual(second);
  });

  it("an interrupted publish leaves public and current records consistent after recovery", async () => {
    const current = snapshot();
    const { env, store, metadata, write } = kvEnv({
      [PUBLICATION_CURRENT_KEY]: current,
      "v12:publication:section:gdpTracker": gdpFragment("2026-07-18T03:20:00.000Z", 0.2),
    });
    const now = new Date("2026-07-18T03:30:00.000Z");

    // Worker eviction after the public artifact write: the current write never
    // lands and no rollback code runs.
    let evicted = false;
    env.METRICS_CACHE.put = vi.fn(async (key: string, value: string, options?: PutOptions) => {
      if (evicted || key === PUBLICATION_CURRENT_KEY) {
        evicted = true;
        throw new Error("simulated worker eviction");
      }
      return write(key, value, options);
    });
    env.METRICS_CACHE.delete = vi.fn(async () => {
      throw new Error("simulated worker eviction");
    });
    await expect(publishFromCaches(env, { now })).rejects.toThrow("simulated worker eviction");
    expect(store.get(PUBLICATION_CURRENT_KEY)).toEqual(current);
    expect(metadata.get(PUBLIC_SNAPSHOT_KEY)?.generatedAt).not.toBe(current.meta.generatedAt);

    // The queue redelivers the finaliser; this attempt fails before it can
    // write a new public artifact, so only the recovery repair can realign it.
    env.METRICS_CACHE.put = vi.fn(write);
    const read = env.METRICS_CACHE.get;
    env.METRICS_CACHE.get = vi.fn(async (key: string, type?: "json" | "text") => {
      if (key === PUBLICATION_STATUS_KEY) {
        throw new Error("simulated status read failure");
      }
      return read(key, type);
    });
    env.METRICS_CACHE.delete = vi.fn(async (key: string) => {
      store.delete(key);
      metadata.delete(key);
    });
    await expect(publishFromCaches(env, { now: new Date("2026-07-18T03:35:00.000Z") }))
      .rejects.toThrow("simulated status read failure");

    const committed = store.get(PUBLICATION_CURRENT_KEY) as ReturnType<typeof snapshot>;
    expect(committed).toEqual(current);
    const publicMetadata = metadata.get(PUBLIC_SNAPSHOT_KEY);
    const raw = store.get(PUBLIC_SNAPSHOT_KEY);
    const publicBody = typeof raw === "string" ? JSON.parse(raw) : raw;
    expect(publicBody.meta.generatedAt).toBe(committed.meta.generatedAt);
    expect(publicMetadata?.generatedAt).toBe(committed.meta.generatedAt);
    expect(publicBody.gdpTracker).toEqual(committed.gdpTracker);
    expect(publicBody.gdpTracker).not.toEqual({ headline: { monthlyGrowth: 0.2, period: "May 2026" } });
  });
});
