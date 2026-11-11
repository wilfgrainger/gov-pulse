// @vitest-environment node
// With the real publication config, no held source is ever collected: some
// holds exist because the publisher's terms do not permit automated collection.
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicationHeld } from "@/contracts/evidence-policy";
import { dueFeeds } from "@/worker/pipeline";
import queuedWorker, {
  BETTING_CRON,
  DAILY_CRON,
  RUN_PREFIX,
  bootstrapRunId,
  enqueueInternationalComparisonRefresh,
  refreshJobs,
} from "@/worker/queued-publication-entry";

const HELD = ["electionPolling", "bettingOdds", "nhsStats", "releaseCalendar", "nhsReleaseCalendar"];
const SHA = "c".repeat(40);
const NOW = new Date("2026-11-11T12:00:00.000Z");

function environment() {
  const store = new Map<string, unknown>();
  const send = vi.fn(async () => undefined);
  const sendBatch = vi.fn(async () => undefined);
  return {
    store,
    send,
    sendBatch,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => { store.set(key, JSON.parse(value)); }),
      },
      DATA_JOBS: { send, sendBatch },
    },
  };
}

function sentBodies(send: ReturnType<typeof vi.fn>, sendBatch: ReturnType<typeof vi.fn>) {
  return [
    ...send.mock.calls.map(([body]) => body),
    ...sendBatch.mock.calls.flatMap(([messages]) => messages.map((message: { body: unknown }) => message.body)),
  ] as Array<{ type?: string; section?: string }>;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("held sources are never collected", () => {
  it("the real config holds the grey-area and re-baselined sources", () => {
    for (const id of [...HELD, "internationalComparison"]) expect(publicationHeld(id)).toBe(true);
  });

  it("cron (daily and three-hourly) and bootstrap select no held feed", () => {
    const planned = [
      ...refreshJobs("d", "daily", { publishedOnly: true }),
      ...refreshJobs("b", "betting", { publishedOnly: true }),
      ...refreshJobs("s", "bootstrap"),
      ...refreshJobs("s", "bootstrap", { includeContracts: true }),
    ].map((job) => job.section);
    const due = [
      ...dueFeeds(NOW, "daily"),
      ...dueFeeds(NOW, "3h"),
      ...dueFeeds(NOW, "bootstrap"),
      ...dueFeeds(NOW, "bootstrap", { includeContracts: true }),
    ];
    for (const id of HELD) {
      expect(planned).not.toContain(id);
      expect(due).not.toContain(id);
    }
  });

  it("scheduled crons enqueue no held feed and the three-hour cron does no work", async () => {
    for (const cron of [DAILY_CRON, BETTING_CRON]) {
      const { env, send, sendBatch } = environment();
      const pending: Promise<unknown>[] = [];
      queuedWorker.scheduled({ cron, scheduledTime: NOW.getTime() }, env, { waitUntil: (p: Promise<unknown>) => pending.push(p) });
      await Promise.all(pending);
      const sections = sentBodies(send, sendBatch).map((body) => body.section);
      for (const id of HELD) expect(sections).not.toContain(id);
      if (cron === BETTING_CRON) {
        expect(send).not.toHaveBeenCalled();
        expect(sendBatch).not.toHaveBeenCalled();
      }
    }
  });

  it("a deploy bootstrap never enqueues international comparison work or contacts its publishers", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const { env, store, send, sendBatch } = environment();

    expect(await enqueueInternationalComparisonRefresh(env, { runId: "daily", now: NOW }))
      .toMatchObject({ queued: 0, reason: "held" });

    // First delivery creates the run; the repeat arrives after finalisation and
    // would previously queue comparison batches directly.
    const message = () => ({
      body: { type: "bootstrap-publication", deploymentId: SHA, forceComparison: true },
      ack: vi.fn(),
      retry: vi.fn(),
    });
    await queuedWorker.queue({ messages: [message()] }, env, {});
    const runId = bootstrapRunId(SHA);
    store.set(`${RUN_PREFIX}${runId}`, {
      ...(store.get(`${RUN_PREFIX}${runId}`) as object),
      status: "incomplete",
      finalisedAt: NOW.toISOString(),
    });
    await queuedWorker.queue({ messages: [message()] }, env, {});

    const bodies = sentBodies(send, sendBatch);
    expect(bodies.filter((body) => /international-comparison/.test(String(body.type)))).toHaveLength(0);
    for (const id of HELD) expect(bodies.map((body) => body.section)).not.toContain(id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
