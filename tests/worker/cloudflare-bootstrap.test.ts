// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import queuedWorker, {
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  RUN_PREFIX,
  bootstrapRunId,
  enqueueCompletedBootstrapFinaliser,
  enqueueInternationalComparisonRefresh,
  refreshJobs,
} from "@/worker/queued-publication-entry";

const SHA = "b".repeat(40);

function environment() {
  const store = new Map<string, unknown>();
  const sendBatch = vi.fn(async () => undefined);
  const send = vi.fn(async () => undefined);
  return {
    store,
    sendBatch,
    send,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          store.set(key, JSON.parse(value));
        }),
      },
      DATA_JOBS: { sendBatch, send },
    },
  };
}

function bootstrapMessage() {
  return {
    body: { type: "bootstrap-publication", deploymentId: SHA },
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("Cloudflare publication bootstrap", () => {
  it("queues bounded comparison work from the scheduled refresh path", async () => {
    const { env, send } = environment();
    const now = new Date("2026-10-03T12:00:00.000Z");

    const result = await enqueueInternationalComparisonRefresh(env, {
      runId: "daily-comparison-run",
      now,
    });

    expect(result).toMatchObject({ queued: 8, reason: "queued" });
    expect(send).toHaveBeenCalledTimes(8);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      runId: "daily-comparison-run",
      batchId: "defence",
      sourceIds: ["world-bank-population-2025", "sipri-2025"],
      force: true,
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: "finalise-international-comparison",
      runId: "daily-comparison-run",
      expectedBatchIds: [
        "government-debt",
        "oda",
        "defence",
        "social-spending",
        "healthcare",
        "tax-revenue",
        "debt-interest",
      ],
    }), expect.any(Object));
  });

  it("schedules only required national sections", () => {
    const jobs = refreshJobs("bootstrap-run", "bootstrap");
    expect(jobs).toHaveLength(10);
    expect(jobs.map((job) => job.section)).toEqual([
      "gdpTracker",
      "sentimentPulse",
      "employmentStats",
      "taxRevenue",
      "nationalDebt",
      "migrationStats",
      "housePriceIndex",
      "realWages",
      "electionPolling",
      "nhsStats",
    ]);
    expect(jobs.some((job) => job.type === "refresh-contracts")).toBe(false);
    expect(jobs.some((job) => job.section === "bettingOdds")).toBe(false);
    expect(jobs.some((job) => job.section === "crimeStatistics")).toBe(false);
    expect(jobs.some((job) => job.section === "nhsStats")).toBe(true);
    expect(jobs.some((job) => job.type === "refresh-international-comparison")).toBe(false);
  });

  it("keeps comparison work out of the queue until national finalisation", async () => {
    const { env, store, sendBatch, send } = environment();
    const first = bootstrapMessage();
    await queuedWorker.queue({ messages: [first] }, env, {});

    expect(first.ack).toHaveBeenCalledOnce();
    expect(first.retry).not.toHaveBeenCalled();
    expect(sendBatch).toHaveBeenCalledOnce();
    expect(sendBatch.mock.calls[0][0]).toHaveLength(10);
    expect(send).toHaveBeenCalledWith(
      {
        type: "finalise-run",
        runId: bootstrapRunId(SHA),
        retryDelaySeconds: BOOTSTRAP_FINALISE_RETRY_SECONDS,
      },
      { delaySeconds: BOOTSTRAP_FINALISE_DELAY_SECONDS }
    );
    expect(send).toHaveBeenCalledTimes(1);

    const run = store.get(`${RUN_PREFIX}${bootstrapRunId(SHA)}`) as {
      scope: string;
      dispatchedAt: string | null;
      expectedJobIds: string[];
      comparisonRefreshRequested: boolean;
      comparisonRefreshForce: boolean;
    };
    expect(run.scope).toBe("bootstrap");
    expect(run.dispatchedAt).toBeTruthy();
    expect(run.expectedJobIds).toHaveLength(10);
    expect(run.comparisonRefreshRequested).toBe(true);
    expect(run.comparisonRefreshForce).toBe(false);
    expect(run.expectedJobIds).not.toContain("refresh-international-comparison");

    const duplicate = bootstrapMessage();
    await queuedWorker.queue({ messages: [duplicate] }, env, {});
    expect(duplicate.ack).toHaveBeenCalledOnce();
    expect(sendBatch).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("remembers a forced comparison refresh request until national finalisation", async () => {
    const { env, store, send } = environment();
    const message = {
      body: { type: "bootstrap-publication", deploymentId: SHA, forceComparison: true },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "refresh-international-comparison" }));
    expect(store.get(`${RUN_PREFIX}${bootstrapRunId(SHA)}`)).toMatchObject({
      comparisonRefreshRequested: true,
      comparisonRefreshForce: true,
    });
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("does not let a forced comparison request overtake an active national run", async () => {
    const { env, store, send } = environment();
    await queuedWorker.queue({ messages: [bootstrapMessage()] }, env, {});
    send.mockClear();
    const forcedRepeat = {
      body: { type: "bootstrap-publication", deploymentId: SHA, forceComparison: true },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [forcedRepeat] }, env, {});

    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "refresh-international-comparison" }));
    expect(store.get(`${RUN_PREFIX}${bootstrapRunId(SHA)}`)).toMatchObject({
      comparisonRefreshRequested: true,
      comparisonRefreshForce: true,
    });
    expect(forcedRepeat.ack).toHaveBeenCalledOnce();
  });

  it("queues comparison work only after a bootstrap run is already finalised", async () => {
    const { env, store, send } = environment();
    const runId = bootstrapRunId(SHA);
    store.set(`${RUN_PREFIX}${runId}`, {
      runId,
      scope: "bootstrap",
      status: "running",
      expectedJobIds: ["section:gdpTracker"],
      deadlineAt: new Date(Date.now() - 60_000).toISOString(),
      finalisedAt: null,
      comparisonRefreshRequested: true,
      comparisonRefreshForce: true,
    });
    store.set(`${RUN_PREFIX}${runId}:terminal:section:gdpTracker`, {
      jobId: "section:gdpTracker",
      status: "failure",
    });
    send.mockImplementation(async (job) => {
      expect(store.get(`${RUN_PREFIX}${runId}`)).toMatchObject({
        status: "incomplete",
      });
      expect(
        (store.get(`${RUN_PREFIX}${runId}`) as { finalisedAt: string }).finalisedAt
      ).toBeTruthy();
      expect(job).toMatchObject({
        type: expect.stringMatching(/^(refresh-international-comparison|finalise-international-comparison)$/),
      });
    });
    const message = {
      body: { type: "finalise-run", runId },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(send).toHaveBeenCalledTimes(8);
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: "refresh-international-comparison",
      runId,
      jobId: `comparison:${runId}:government-debt`,
      batchId: "government-debt",
      sourceIds: ["imf-gdp-2026", "imf-debt-2026"],
      force: true,
    }));
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({
      jobId: `comparison:${runId}:oda`,
      batchId: "oda",
      sourceIds: ["world-bank-population-2025", "oecd-oda-2025"],
    }));
    expect(send).toHaveBeenNthCalledWith(3, expect.objectContaining({
      jobId: `comparison:${runId}:defence`,
      batchId: "defence",
      sourceIds: ["world-bank-population-2025", "sipri-2025"],
    }));
    expect(send).toHaveBeenNthCalledWith(4, expect.objectContaining({
      jobId: `comparison:${runId}:social-spending`,
      batchId: "social-spending",
      sourceIds: ["world-bank-gdp-per-capita-2023", "oecd-socx-2023"],
    }));
    expect(send).toHaveBeenNthCalledWith(5, expect.objectContaining({
      jobId: `comparison:${runId}:healthcare`,
      batchId: "healthcare",
      sourceIds: ["world-bank-health-2024"],
    }));
    expect(send).toHaveBeenNthCalledWith(6, expect.objectContaining({
      jobId: `comparison:${runId}:tax-revenue`,
      batchId: "tax-revenue",
      sourceIds: ["world-bank-gdp-per-capita-2024", "oecd-tax-2024"],
    }));
    expect(send).toHaveBeenNthCalledWith(7, expect.objectContaining({
      jobId: `comparison:${runId}:debt-interest`,
      batchId: "debt-interest",
      sourceIds: ["world-bank-gdp-per-capita-2024", "imf-interest-2024"],
    }));
    expect(send).toHaveBeenNthCalledWith(8, expect.objectContaining({
      type: "finalise-international-comparison",
      runId,
      jobId: `comparison:${runId}`,
      expectedBatchIds: [
        "government-debt",
        "oda",
        "defence",
        "social-spending",
        "healthcare",
        "tax-revenue",
        "debt-interest",
      ],
    }), expect.any(Object));
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(store.get(`${RUN_PREFIX}${runId}`)).toMatchObject({
      comparisonRefreshQueuedAt: expect.any(String),
    });
  });

  it("requeues successful legacy batches without fragments before finalising a forced retry", async () => {
    const { env, store, send } = environment();
    const runId = bootstrapRunId(SHA);
    store.set(`${RUN_PREFIX}${runId}`, {
      runId,
      scope: "bootstrap",
      status: "incomplete",
      expectedJobIds: ["section:gdpTracker"],
      deadlineAt: new Date(Date.now() - 60_000).toISOString(),
      dispatchedAt: new Date(Date.now() - 60_000).toISOString(),
      finalisedAt: new Date(Date.now() - 30_000).toISOString(),
      comparisonRefreshRequested: true,
      comparisonRefreshForce: false,
      comparisonRefreshQueuedAt: new Date(Date.now() - 20_000).toISOString(),
    });
    store.set(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}:healthcare`, {
      runId,
      jobId: `comparison:${runId}:healthcare`,
      status: "success",
    });
    store.set(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`, {
      runId,
      jobId: `comparison:${runId}`,
      status: "failure",
    });
    const message = {
      body: { type: "bootstrap-publication", deploymentId: SHA, forceComparison: true },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(send).toHaveBeenCalledTimes(8);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: "refresh-international-comparison",
      runId,
      jobId: `comparison:${runId}:government-debt`,
      batchId: "government-debt",
      sourceIds: ["imf-gdp-2026", "imf-debt-2026"],
      force: true,
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: "refresh-international-comparison",
      batchId: "healthcare",
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: "finalise-international-comparison",
      expectedBatchIds: [
        "government-debt",
        "oda",
        "defence",
        "social-spending",
        "healthcare",
        "tax-revenue",
        "debt-interest",
      ],
    }), expect.any(Object));
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`)).toMatchObject({
      status: "pending",
      completedAt: null,
    });
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("does not queue another forced comparison when its terminal already succeeded", async () => {
    const { env, store, send } = environment();
    const runId = bootstrapRunId(SHA);
    store.set(`${RUN_PREFIX}${runId}`, {
      runId,
      scope: "bootstrap",
      status: "published",
      expectedJobIds: ["section:gdpTracker"],
      deadlineAt: new Date(Date.now() - 60_000).toISOString(),
      dispatchedAt: new Date(Date.now() - 60_000).toISOString(),
      finalisedAt: new Date(Date.now() - 30_000).toISOString(),
      comparisonRefreshRequested: true,
      comparisonRefreshForce: true,
      comparisonRefreshQueuedAt: new Date(Date.now() - 20_000).toISOString(),
    });
    store.set(`${RUN_PREFIX}${runId}:terminal:comparison:${runId}`, {
      runId,
      jobId: `comparison:${runId}`,
      status: "success",
    });
    const message = {
      body: { type: "bootstrap-publication", deploymentId: SHA, forceComparison: true },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({
      type: "refresh-international-comparison",
    }));
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("acknowledges a duplicate comparison job after its run terminal succeeded", async () => {
    const { env, store } = environment();
    const runId = bootstrapRunId(SHA);
    const jobId = `comparison:${runId}:healthcare`;
    store.set(`${RUN_PREFIX}${runId}:terminal:${jobId}`, { status: "success" });
    const message = {
      body: {
        type: "refresh-international-comparison",
        runId,
        jobId,
        batchId: "healthcare",
        sourceIds: ["world-bank-health-2024"],
        force: true,
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected fetch"));

    try {
      await queuedWorker.queue({ messages: [message] }, env, {});
    } finally {
      fetchSpy.mockRestore();
    }

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(env.DATA_JOBS.send).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("records finaliser errors on active bootstrap runs before retrying the Queue message", async () => {
    const { env, store } = environment();
    const runId = bootstrapRunId(SHA);
    store.set(`${RUN_PREFIX}${runId}`, {
      runId,
      scope: "bootstrap",
      status: "running",
      expectedJobIds: [],
      finalisedAt: null,
    });
    vi.mocked(env.METRICS_CACHE.get).mockRejectedValueOnce(new Error("KV read failed"));
    const message = {
      body: { type: "finalise-run", runId },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
    expect(store.get(`${RUN_PREFIX}${runId}`)).toMatchObject({
      finalisationFailure: {
        errorName: "Error",
        errorMessage: "KV read failed",
      },
    });
  });

  it("records and acknowledges a failed bootstrap source job so finalisation can proceed", async () => {
    const { env, store } = environment();
    const runId = bootstrapRunId(SHA);
    const message = {
      body: {
        type: "refresh-section",
        section: "unknown-section",
        runId,
        jobId: "section:gdpTracker",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(store.get(`${RUN_PREFIX}${runId}:terminal:section:gdpTracker`)).toMatchObject({
      status: "failure",
      result: {
        errorCode: "job-failed",
        errorMessage: "Section 'unknown-section' is outside the generic publication set",
      },
    });
  });

  it("keeps non-bootstrap source failures retryable", async () => {
    const { env } = environment();
    const message = {
      body: {
        type: "refresh-section",
        section: "unknown-section",
        runId: "daily-2026-10-03",
        jobId: "section:gdpTracker",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("rejects non-commit deployment identifiers", () => {
    expect(() => bootstrapRunId("main")).toThrow(
      "must be a full Git commit SHA"
    );
  });

  it("prompts finalisation as soon as every bootstrap source job succeeds", async () => {
    const { env, store, send } = environment();
    const runId = bootstrapRunId(SHA);
    store.set(`${RUN_PREFIX}${runId}`, {
      runId, scope: "bootstrap", finalisedAt: null,
      expectedJobIds: ["section:employmentStats", "external:electionPolling"],
    });
    store.set(`${RUN_PREFIX}${runId}:terminal:section:employmentStats`, {
      jobId: "section:employmentStats", status: "success",
    });
    expect(await enqueueCompletedBootstrapFinaliser(runId, env)).toBe(false);
    expect(send).not.toHaveBeenCalled();

    store.set(`${RUN_PREFIX}${runId}:terminal:external:electionPolling`, {
      jobId: "external:electionPolling", status: "success",
    });
    expect(await enqueueCompletedBootstrapFinaliser(runId, env)).toBe(true);
    expect(send).toHaveBeenCalledWith({
      type: "finalise-run", runId,
      retryDelaySeconds: BOOTSTRAP_FINALISE_RETRY_SECONDS,
    });
  });
});
