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
  it("covers every registered source while limiting each job to two source requests", () => {
    const covered = [...new Set(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.flatMap(({ sourceIds }) => sourceIds))];

    expect(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.every(({ sourceIds }) => sourceIds.length <= 2)).toBe(true);
    expect(covered.sort()).toEqual([...INTERNATIONAL_SOURCES].sort());
  });

  it("queues only the due dependency batch for a routine measure retry", async () => {
    mocks.refreshInternationalComparison.mockResolvedValue({ updated: true, due: false });
    const { env, store } = environment();
    const now = new Date("2026-10-03T12:00:00.000Z");
    store.set(INTERNATIONAL_COMPARISON_KEY, freshPublication(now));

    const result = await enqueueInternationalComparisonRefresh(env, {
      runId: "health-retry-run",
      now,
    });

    expect(result).toMatchObject({ queued: 1, reason: "queued" });
    expect(env.DATA_JOBS.send).toHaveBeenCalledOnce();
    expect(env.DATA_JOBS.send).toHaveBeenCalledWith(expect.objectContaining({
      batchId: "healthcare",
      sourceIds: ["world-bank-health-2024"],
      expectedBatchIds: ["healthcare"],
    }));

    const message = {
      body: {
        type: "refresh-international-comparison",
        runId: "health-retry-run",
        jobId: "comparison:health-retry-run:healthcare",
        batchId: "healthcare",
        sourceIds: ["world-bank-health-2024"],
        expectedBatchIds: ["healthcare"],
        force: true,
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(store.get(`${RUN_PREFIX}health-retry-run:terminal:comparison:health-retry-run`)).toMatchObject({
      status: "success",
      result: { completedBatches: ["healthcare"] },
    });
  });

  it("publishes the aggregate terminal only after every source batch succeeds", async () => {
    mocks.refreshInternationalComparison.mockResolvedValue({ updated: true, due: false });
    const { env, store } = environment();
    const runId = "comparison-test-run";

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
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({
      status: "success",
      result: {
        completedBatches: INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id),
      },
    });
  });

  it("keeps a failed batch visible until its retry and the remaining batches succeed", async () => {
    mocks.refreshInternationalComparison
      .mockRejectedValueOnce(new Error("temporary source failure"))
      .mockResolvedValue({ updated: true, due: false });
    const { env, store } = environment();
    const runId = "comparison-retry-run";
    const [first, ...remaining] = INTERNATIONAL_COMPARISON_REFRESH_BATCHES;
    const failedMessage = { ...comparisonMessage(runId, first), attempts: 1 };

    await queuedWorker.queue({ messages: [failedMessage] }, env, {});

    expect(failedMessage.retry).toHaveBeenCalledOnce();
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({
      status: "pending",
      completedAt: null,
    });

    const retryMessage = { ...comparisonMessage(runId, first), attempts: 2 };
    await queuedWorker.queue({ messages: [retryMessage] }, env, {});
    for (const batch of remaining) {
      await queuedWorker.queue({ messages: [comparisonMessage(runId, batch)] }, env, {});
    }

    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({ status: "success" });
  });

  it("marks the aggregate terminal failed when a batch exhausts Queue retries", async () => {
    mocks.refreshInternationalComparison.mockRejectedValue(new Error("permanent source failure"));
    const { env, store } = environment();
    const runId = "comparison-exhausted-run";
    const [first] = INTERNATIONAL_COMPARISON_REFRESH_BATCHES;

    await queuedWorker.queue({
      messages: [{ ...comparisonMessage(runId, first), attempts: 4 }],
    }, env, {});

    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({
      status: "failure",
      result: { errorCode: "comparison-batch-failed", failedBatches: [first.id] },
    });
  });
});
