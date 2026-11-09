// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLICATION_CONFIG } from "@/contracts/evidence-policy";
import queuedWorker, { DAILY_CRON } from "@/worker/queued-publication-entry";
import { runIdFor, runKey } from "@/worker/publication-run-store";

const DAILY_TIME = Date.UTC(2026, 10, 9, 3, 17);

const original = Object.entries(PUBLICATION_CONFIG.publications).map(
  ([id, publication]) => [id, publication.state] as const,
);

afterEach(() => {
  for (const [id, state] of original) {
    PUBLICATION_CONFIG.publications[id].state = state;
  }
  vi.restoreAllMocks();
});

function publishOnlyNationalDebt() {
  for (const item of Object.values(PUBLICATION_CONFIG.publications)) item.state = "held";
  PUBLICATION_CONFIG.publications.nationalDebt.state = "published";
}

// Retry waits are real delays; run them immediately so the tests count attempts.
function skipRetryDelays() {
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as unknown as typeof setTimeout);
}

function queueEnv() {
  const store = new Map<string, string>();
  const env = {
    METRICS_CACHE: {
      get: vi.fn(async (key: string) => (store.has(key) ? JSON.parse(store.get(key)!) : null)),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    },
    DATA_JOBS: {
      sendBatch: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
    },
  };
  return { env, store };
}

async function runDailyCron(env: unknown) {
  const pending: Promise<unknown>[] = [];
  queuedWorker.scheduled(
    { cron: DAILY_CRON, scheduledTime: DAILY_TIME },
    env as never,
    { waitUntil: (promise: Promise<unknown>) => pending.push(promise) } as never,
  );
  await Promise.all(pending);
}

describe("daily publication enqueue", () => {
  it("retries a failed job batch send and then dispatches the run", async () => {
    publishOnlyNationalDebt();
    skipRetryDelays();
    const { env, store } = queueEnv();
    env.DATA_JOBS.sendBatch.mockRejectedValueOnce(new Error("queue unavailable"));

    await runDailyCron(env);

    expect(env.DATA_JOBS.sendBatch).toHaveBeenCalledTimes(2);
    const run = JSON.parse(store.get(runKey(runIdFor(new Date(DAILY_TIME))))!);
    expect(run.dispatchedAt).toEqual(expect.any(String));
  });

  it("retries a failed finalise send without sending the job batch again", async () => {
    publishOnlyNationalDebt();
    skipRetryDelays();
    const { env } = queueEnv();
    env.DATA_JOBS.send.mockRejectedValueOnce(new Error("queue unavailable"));

    await runDailyCron(env);

    expect(env.DATA_JOBS.sendBatch).toHaveBeenCalledTimes(1);
    expect(env.DATA_JOBS.send).toHaveBeenCalledTimes(2);
    expect(env.DATA_JOBS.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "finalise-run" }),
      { delaySeconds: 20 * 60 },
    );
  });

  it("gives up after three attempts and logs the failure", async () => {
    publishOnlyNationalDebt();
    skipRetryDelays();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { env } = queueEnv();
    env.DATA_JOBS.sendBatch.mockRejectedValue(new Error("queue unavailable"));

    await runDailyCron(env);

    expect(env.DATA_JOBS.sendBatch).toHaveBeenCalledTimes(3);
    expect(env.DATA_JOBS.send).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "Cloudflare publication scheduling failed",
      expect.objectContaining({ error: "queue unavailable" }),
    );
  });
});
