// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import queuedWorker, {
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  RUN_PREFIX,
  bootstrapRunId,
  enqueueCompletedBootstrapFinaliser,
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

  it("creates one deterministic national run and dispatches an independent comparison refresh once", async () => {
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
    expect(send).toHaveBeenCalledWith({ type: "refresh-international-comparison" });
    expect(send).toHaveBeenCalledTimes(2);

    const run = store.get(`${RUN_PREFIX}${bootstrapRunId(SHA)}`) as {
      scope: string;
      dispatchedAt: string | null;
      expectedJobIds: string[];
    };
    expect(run.scope).toBe("bootstrap");
    expect(run.dispatchedAt).toBeTruthy();
    expect(run.expectedJobIds).toHaveLength(10);
    expect(run.expectedJobIds).not.toContain("refresh-international-comparison");

    const duplicate = bootstrapMessage();
    await queuedWorker.queue({ messages: [duplicate] }, env, {});
    expect(duplicate.ack).toHaveBeenCalledOnce();
    expect(sendBatch).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("forces the independent comparison refresh when manual bootstrap requests it", async () => {
    const { env, send } = environment();
    const message = {
      body: { type: "bootstrap-publication", deploymentId: SHA, forceComparison: true },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [message] }, env, {});

    expect(send).toHaveBeenCalledWith({ type: "refresh-international-comparison", force: true });
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("still queues a forced comparison refresh when the national bootstrap is already active", async () => {
    const { env, send } = environment();
    await queuedWorker.queue({ messages: [bootstrapMessage()] }, env, {});
    send.mockClear();
    const forcedRepeat = {
      body: { type: "bootstrap-publication", deploymentId: SHA, forceComparison: true },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await queuedWorker.queue({ messages: [forcedRepeat] }, env, {});

    expect(send).toHaveBeenCalledWith({ type: "refresh-international-comparison", force: true });
    expect(forcedRepeat.ack).toHaveBeenCalledOnce();
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
