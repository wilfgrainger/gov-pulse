// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshInternationalComparison: vi.fn(),
}));

vi.mock("@/worker/international-comparison-publication.js", async () => {
  const actual = await vi.importActual<typeof import("@/worker/international-comparison-publication.js")>(
    "@/worker/international-comparison-publication.js"
  );
  return {
    ...actual,
    refreshInternationalComparison: mocks.refreshInternationalComparison,
  };
});

import queuedWorker, {
  RUN_PREFIX,
  enqueueInternationalComparisonRefresh,
} from "@/worker/queued-publication-entry";
import { COMPARISON_COUNTRIES } from "@/worker/international-comparison";
import {
  INTERNATIONAL_COMPARISON_KEY,
  INTERNATIONAL_COMPARISON_REFRESH_BATCHES,
  INTERNATIONAL_SOURCES,
  buildInternationalComparisonPublication,
  comparisonSourceBundle,
  mergeInternationalComparisonBatchResults,
} from "@/worker/international-comparison-publication";

function environment() {
  const store = new Map<string, unknown>();
  return {
    store,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, raw: string) => store.set(key, JSON.parse(raw))),
      },
      DATA_JOBS: { send: vi.fn(async () => undefined) },
    },
  };
}

function comparisonMessage(runId: string, batch: (typeof INTERNATIONAL_COMPARISON_REFRESH_BATCHES)[number]) {
  return {
    body: {
      type: "refresh-international-comparison",
      runId,
      jobId: `comparison:${runId}:${batch.id}`,
      batchId: batch.id,
      sourceIds: [...batch.sourceIds],
      force: true,
    },
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function comparisonFinalizerMessage(runId: string, expectedBatchIds: string[]) {
  return {
    body: {
      type: "finalise-international-comparison",
      runId,
      jobId: `comparison:${runId}`,
      expectedBatchIds,
    },
    ack: vi.fn(),
    retry: vi.fn(),
    attempts: 1,
  };
}

function seedComparisonBase(store: Map<string, unknown>, runId: string, publication: ReturnType<typeof freshPublication>) {
  store.set(`${RUN_PREFIX}${runId}:comparison-base`, { publication });
}

function freshPublication(now: Date) {
  const countryIds = COMPARISON_COUNTRIES.map(({ id }) => id);
  const oecdIds = ["GBR", "USA", "DEU", "FRA", "ITA", "ESP", "IRL", "NLD", "CHE", "POL"];
  const mapAll = (value: number) => new Map(countryIds.map((id) => [id, value]));
  const mapOecd = (value: number) => new Map(oecdIds.map((id) => [id, value]));
  const publication = buildInternationalComparisonPublication(comparisonSourceBundle({
    gdpPerCapita2023: mapAll(48_000),
    gdpPerCapita2024: mapAll(50_000),
    gdpPerCapita2026: mapAll(61_000),
    population2025: mapAll(70_000_000),
    debtPctGdp2026: mapAll(80),
    interestPctGdp2024: mapAll(2),
    odaUsd2025: mapOecd(10_000_000_000),
    defenceUsd2025: mapAll(20_000_000_000),
    socialPctGdp2023: mapOecd(15),
    healthPerCapita2024: mapAll(4_000),
    taxPctGdp2024: mapOecd(30),
  }), now);
  publication.meta.checkedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  publication.measures.healthcareSpending.lifecycle.retryAfter = now.toISOString();
  return publication;
}

afterEach(() => vi.resetAllMocks());

describe("bounded international comparison Queue batches", () => {
  it("covers every registered source and measure while limiting each job to two source requests", () => {
    const covered = [...new Set(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.flatMap(({ sourceIds }) => sourceIds))];
    const mappedMeasures = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.flatMap(({ measureIds }) => measureIds);
    const publicationMeasures = Object.keys(freshPublication(new Date("2026-10-03T12:00:00.000Z")).measures);

    expect(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.every(({ sourceIds }) => sourceIds.length <= 2)).toBe(true);
    expect(covered.sort()).toEqual([...INTERNATIONAL_SOURCES].sort());
    expect(new Set(mappedMeasures).size).toBe(mappedMeasures.length);
    expect(mappedMeasures.sort()).toEqual(publicationMeasures.sort());
    expect(INTERNATIONAL_SOURCES).not.toContain("imf-gdp-2023");
    expect(INTERNATIONAL_SOURCES).not.toContain("imf-gdp-2024");
    expect(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === "social-spending")?.sourceIds)
      .toEqual(["world-bank-gdp-per-capita-2023", "oecd-socx-2023"]);
    expect(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === "tax-revenue")?.sourceIds)
      .toEqual(["world-bank-gdp-per-capita-2024", "oecd-tax-2024"]);
    expect(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === "debt-interest")?.sourceIds)
      .toEqual(["world-bank-gdp-per-capita-2024", "imf-interest-2024"]);
  });

  it("queues only the due dependency batch for a routine measure retry", async () => {
    const { env, store } = environment();
    const now = new Date("2026-10-03T12:00:00.000Z");
    const publication = freshPublication(now);
    store.set(INTERNATIONAL_COMPARISON_KEY, publication);
    mocks.refreshInternationalComparison.mockResolvedValue({ updated: true, due: false, publication });

    const result = await enqueueInternationalComparisonRefresh(env, {
      runId: "health-retry-run",
      now,
    });

    expect(result).toMatchObject({ queued: 2, reason: "queued" });
    expect(env.DATA_JOBS.send).toHaveBeenCalledTimes(2);
    expect(env.DATA_JOBS.send).toHaveBeenCalledWith(expect.objectContaining({
      batchId: "healthcare",
      sourceIds: ["world-bank-health-2024"],
    }));
    const queuedJobs = env.DATA_JOBS.send.mock.calls.map(([body]) => body);
    const batchJob = queuedJobs.find((job) => job.type === "refresh-international-comparison");
    const finalizerJob = queuedJobs.find((job) => job.type === "finalise-international-comparison");
    expect(finalizerJob.expectedBatchIds).toEqual(["healthcare"]);

    await queuedWorker.queue({ messages: [{
      body: batchJob,
      ack: vi.fn(),
      retry: vi.fn(),
    }] }, env, {});
    await queuedWorker.queue({ messages: [{
      body: finalizerJob,
      ack: vi.fn(),
      retry: vi.fn(),
      attempts: 1,
    }] }, env, {});

    expect(store.get(`${RUN_PREFIX}health-retry-run:terminal:comparison:health-retry-run`)).toMatchObject({
      status: "success",
      result: { completedBatches: ["healthcare"] },
    });
  });

  it("publishes the aggregate terminal only after every source batch succeeds", async () => {
    const { env, store } = environment();
    const runId = "comparison-test-run";
    const publication = freshPublication(new Date("2026-10-03T12:00:00.000Z"));
    seedComparisonBase(store, runId, publication);
    mocks.refreshInternationalComparison.mockResolvedValue({ updated: true, due: false, publication });

    for (const batch of INTERNATIONAL_COMPARISON_REFRESH_BATCHES) {
      const message = comparisonMessage(runId, batch);
      await queuedWorker.queue({ messages: [message] }, env, {});
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
    }

    expect(mocks.refreshInternationalComparison).toHaveBeenCalledTimes(
      INTERNATIONAL_COMPARISON_REFRESH_BATCHES.length
    );
    for (const batch of INTERNATIONAL_COMPARISON_REFRESH_BATCHES) {
      expect(mocks.refreshInternationalComparison).toHaveBeenCalledWith(env, expect.objectContaining({
        force: true,
        sourceIds: [...batch.sourceIds],
      }));
    }
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toBeUndefined();
    const finalizer = comparisonFinalizerMessage(runId, INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id));
    await queuedWorker.queue({ messages: [finalizer] }, env, {});
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({
      status: "success",
      result: {
        completedBatches: INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id),
      },
    });
  });

  it("stages disjoint measure results, then publishes one merged comparison", async () => {
    const { env, store } = environment();
    const now = new Date("2026-10-03T12:00:00.000Z");
    const base = freshPublication(now);
    store.set(INTERNATIONAL_COMPARISON_KEY, base);
    seedComparisonBase(store, "comparison-merge-run", base);
    const measureForBatch: Record<string, string> = {
      "government-debt": "governmentDebt",
      oda: "officialDevelopmentAssistance",
      defence: "defenceSpending",
      "social-spending": "publicSocialExpenditure",
      healthcare: "healthcareSpending",
      "tax-revenue": "taxRevenue",
      "debt-interest": "debtInterest",
    };
    mocks.refreshInternationalComparison.mockImplementation(async (_env, options) => {
      const batch = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ sourceIds }) =>
        JSON.stringify(sourceIds) === JSON.stringify(options.sourceIds)
      );
      const publication = structuredClone(base);
      publication.measures[measureForBatch[batch!.id]].lifecycle.sourceEditionId = `batch-${batch!.id}`;
      return { updated: true, due: false, publication };
    });
    const expectedBatchIds = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id);

    for (const batch of INTERNATIONAL_COMPARISON_REFRESH_BATCHES) {
      await queuedWorker.queue({ messages: [comparisonMessage("comparison-merge-run", batch)] }, env, {});
    }

    expect(store.get(INTERNATIONAL_COMPARISON_KEY)).toEqual(base);
    expect(mocks.refreshInternationalComparison).toHaveBeenCalledWith(env, expect.objectContaining({
      publish: false,
    }));

    const finalizer = comparisonFinalizerMessage("comparison-merge-run", expectedBatchIds);
    await queuedWorker.queue({ messages: [finalizer] }, env, {});

    const published = store.get(INTERNATIONAL_COMPARISON_KEY) as ReturnType<typeof freshPublication>;
    for (const [batchId, measureId] of Object.entries(measureForBatch)) {
      expect(published.measures[measureId].lifecycle.sourceEditionId).toBe(`batch-${batchId}`);
    }
    expect(finalizer.ack).toHaveBeenCalledOnce();
    expect(finalizer.retry).not.toHaveBeenCalled();
    expect(env.METRICS_CACHE.put.mock.calls.filter(([key]) => key === INTERNATIONAL_COMPARISON_KEY)).toHaveLength(1);
  });

  it("keeps source failures for batches that were not part of this refresh", () => {
    const now = new Date("2026-10-03T12:00:00.000Z");
    const base = freshPublication(now);
    base.meta.sourceFailures = ["world-bank-health-2024", "oecd-tax-2024"];
    const fragment = {
      batchId: "healthcare",
      meta: {
        generatedAt: base.meta.generatedAt,
        checkedAt: now.toISOString(),
        attemptedSources: ["world-bank-health-2024"],
        sourceFailures: [],
      },
      measures: { healthcareSpending: base.measures.healthcareSpending },
    };

    const merged = mergeInternationalComparisonBatchResults(base, [fragment], now);

    expect(merged.meta.attemptedSources).toEqual(["world-bank-health-2024"]);
    expect(merged.meta.sourceFailures).toEqual(["oecd-tax-2024"]);
  });

  it("drops failures for source ids no longer registered", () => {
    const now = new Date("2026-10-03T12:00:00.000Z");
    const base = freshPublication(now);
    base.meta.sourceFailures = ["imf-gdp-2023", "imf-gdp-2024"];
    const fragment = {
      batchId: "healthcare",
      meta: {
        generatedAt: base.meta.generatedAt,
        checkedAt: now.toISOString(),
        attemptedSources: ["world-bank-health-2024"],
        sourceFailures: [],
      },
      measures: { healthcareSpending: base.measures.healthcareSpending },
    };

    const merged = mergeInternationalComparisonBatchResults(base, [fragment], now);

    expect(merged.meta.sourceFailures).toEqual([]);
  });

  it("finalises a single due batch from its queued ids and retries stale terminal reads", async () => {
    const { env, store } = environment();
    const now = new Date("2026-10-03T12:00:00.000Z");
    store.set(INTERNATIONAL_COMPARISON_KEY, freshPublication(now));
    mocks.refreshInternationalComparison.mockResolvedValue({
      updated: true,
      due: false,
      publication: freshPublication(now),
    });

    const result = await enqueueInternationalComparisonRefresh(env, {
      runId: "health-retry-run",
      now,
    });
    const queuedJobs = env.DATA_JOBS.send.mock.calls.map(([body]) => body);
    const batchJob = queuedJobs.find((job) => job.type === "refresh-international-comparison");
    const finalizerJob = queuedJobs.find((job) => job.type === "finalise-international-comparison");

    expect(result.queued).toBe(2);
    expect(finalizerJob.expectedBatchIds).toEqual(["healthcare"]);
    await queuedWorker.queue({
      messages: [{ ...comparisonMessage("health-retry-run", INTERNATIONAL_COMPARISON_REFRESH_BATCHES.find(({ id }) => id === "healthcare")!), body: batchJob }],
    }, env, {});

    const childKey = `${RUN_PREFIX}health-retry-run:terminal:comparison:health-retry-run:healthcare`;
    const originalGet = env.METRICS_CACHE.get;
    let hideChildTerminal = true;
    env.METRICS_CACHE.get = vi.fn(async (key: string) => {
      if (key === childKey && hideChildTerminal) {
        hideChildTerminal = false;
        return null;
      }
      if (key === `${RUN_PREFIX}health-retry-run:comparison-batches`) return null;
      return store.get(key) ?? null;
    });
    const firstFinalizer = comparisonFinalizerMessage("health-retry-run", finalizerJob.expectedBatchIds);
    await queuedWorker.queue({ messages: [firstFinalizer] }, env, {});

    expect(firstFinalizer.ack).toHaveBeenCalledOnce();
    expect(store.get(`${RUN_PREFIX}health-retry-run:terminal:comparison:health-retry-run`)).toMatchObject({
      status: "pending",
    });
    const retryJob = env.DATA_JOBS.send.mock.calls
      .map(([body]) => body)
      .findLast((job) => job.type === "finalise-international-comparison");
    expect(retryJob.expectedBatchIds).toEqual(["healthcare"]);

    env.METRICS_CACHE.get = originalGet;
    const retryFinalizer = comparisonFinalizerMessage("health-retry-run", retryJob.expectedBatchIds);
    await queuedWorker.queue({ messages: [retryFinalizer] }, env, {});
    expect(store.get(`${RUN_PREFIX}health-retry-run:terminal:comparison:health-retry-run`)).toMatchObject({
      status: "success",
      result: { completedBatches: ["healthcare"] },
    });
  });

  it("keeps a failed batch visible until its retry and the remaining batches succeed", async () => {
    const { env, store } = environment();
    const runId = "comparison-retry-run";
    const [first, ...remaining] = INTERNATIONAL_COMPARISON_REFRESH_BATCHES;
    const publication = freshPublication(new Date("2026-10-03T12:00:00.000Z"));
    seedComparisonBase(store, runId, publication);
    mocks.refreshInternationalComparison
      .mockRejectedValueOnce(new Error("temporary source failure"))
      .mockResolvedValue({ updated: true, due: false, publication });
    const failedMessage = { ...comparisonMessage(runId, first), attempts: 1 };

    await queuedWorker.queue({ messages: [failedMessage] }, env, {});

    expect(failedMessage.retry).toHaveBeenCalledOnce();
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}:government-debt`)).toMatchObject({
      status: "pending",
      completedAt: null,
    });
    const expectedBatchIds = INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id);
    await queuedWorker.queue({ messages: [comparisonFinalizerMessage(runId, expectedBatchIds)] }, env, {});
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({ status: "pending" });

    const retryMessage = { ...comparisonMessage(runId, first), attempts: 2 };
    await queuedWorker.queue({ messages: [retryMessage] }, env, {});
    for (const batch of remaining) {
      await queuedWorker.queue({ messages: [comparisonMessage(runId, batch)] }, env, {});
    }
    await queuedWorker.queue({ messages: [comparisonFinalizerMessage(runId, expectedBatchIds)] }, env, {});

    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({ status: "success" });
  });

  it("marks the aggregate terminal failed when a batch exhausts Queue retries", async () => {
    mocks.refreshInternationalComparison.mockRejectedValue(new Error("permanent source failure"));
    const { env, store } = environment();
    const runId = "comparison-exhausted-run";
    const [first] = INTERNATIONAL_COMPARISON_REFRESH_BATCHES;
    seedComparisonBase(store, runId, freshPublication(new Date("2026-10-03T12:00:00.000Z")));

    await queuedWorker.queue({
      messages: [{ ...comparisonMessage(runId, first), attempts: 4 }],
    }, env, {});
    await queuedWorker.queue({
      messages: [comparisonFinalizerMessage(runId, [first.id])],
    }, env, {});

    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({
      status: "failure",
      result: { completedBatches: [], failedBatches: [first.id] },
    });
  });
});
