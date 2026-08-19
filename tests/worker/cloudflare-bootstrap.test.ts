// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import queuedWorker, {
  BOOTSTRAP_FINALISE_DELAY_SECONDS,
  BOOTSTRAP_FINALISE_RETRY_SECONDS,
  RUN_PREFIX,
  bootstrapRunId,
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
    expect(jobs).toHaveLength(8);
    expect(jobs.map((job) => job.section)).toEqual([
      "gdpTracker",
      "sentimentPulse",
      "employmentStats",
      "taxRevenue",
      "nationalDebt",
      "migrationStats",
      "electionPolling",
      "nhsStats",
    ]);
    expect(jobs.some((job) => job.type === "refresh-contracts")).toBe(false);
    expect(jobs.some((job) => job.section === "bettingOdds")).toBe(false);
    expect(jobs.some((job) => job.section === "crimeStatistics")).toBe(false);
    expect(jobs.some((job) => job.type === "refresh-international-comparison")).toBe(false);
  });

  it("creates one deterministic national run and dispatches an independent comparison refresh once", async () => {
    const { env, store, sendBatch, send } = environment();
    const first = bootstrapMessage();
    await queuedWorker.queue({ messages: [first] }, env, {});

    expect(first.ack).toHaveBeenCalledOnce();
    expect(first.retry).not.toHaveBeenCalled();
    expect(sendBatch).toHaveBeenCalledOnce();
    expect(sendBatch.mock.calls[0][0]).toHaveLength(8);
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
    expect(run.expectedJobIds).toHaveLength(8);
    expect(run.expectedJobIds).not.toContain("refresh-international-comparison");

    const duplicate = bootstrapMessage();
    await queuedWorker.queue({ messages: [duplicate] }, env, {});
    expect(duplicate.ack).toHaveBeenCalledOnce();
    expect(sendBatch).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("rejects non-commit deployment identifiers", () => {
    expect(() => bootstrapRunId("main")).toThrow(
      "must be a full Git commit SHA"
    );
  });
});
