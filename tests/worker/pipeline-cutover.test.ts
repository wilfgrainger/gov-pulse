// @vitest-environment node

// Task 10e: the data Worker's cron and Queue handlers run the three-message
// pipeline, while legacy messages (in flight at deploy, the deploy bootstrap and
// international comparison) keep their legacy handler until gate G4.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const collectors = vi.hoisted(() => ({
  section: vi.fn(),
  external: vi.fn(),
  shard: vi.fn(),
}));
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
vi.mock("@/worker/publication-queue-dispatcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/worker/publication-queue-dispatcher")>();
  return { ...actual, dispatchPublicationMessage: vi.fn(actual.dispatchPublicationMessage) };
});

import publicWorker from "@/worker/public-data-entry";
import { dispatchPublicationMessage } from "@/worker/publication-queue-dispatcher";
import { PUBLICATION_CONFIG } from "@/contracts/evidence-policy";
import { PUBLICATION_CURRENT_KEY, PUBLICATION_STATUS_KEY } from "@/worker/publication-entry";
import { PUBLIC_SNAPSHOT_KEY } from "@/worker/public-snapshot";
import { EDITION_INDEX_KEY } from "@/worker/edition-archive";
import { CURRENT_RECORD_KEY as LEGACY_CONTRACTS_KEY } from "@/feeds/government-contracts/parse.js";
import { createRun } from "@/worker/publication-run-lifecycle";
import { runIdFor, runKey as legacyRunKey, terminalKey } from "@/worker/publication-run-store";
import { runKey } from "@/worker/pipeline";
import { BETTING_CRON, DAILY_CRON } from "@/worker/publication-schedule";
import {
  DAILY_TIME,
  collectorDefaults,
  committedSnapshot,
  cron,
  deliver,
  message,
  runDaily,
  sectionData,
  sectionRecord,
  seededHarness,
} from "@/tests/fixtures/wired-pipeline";

const LEGACY_TYPES = [
  "refresh-section",
  "refresh-external-section",
  "refresh-contracts",
  "finalise-run",
  "bootstrap-publication",
  "refresh-international-comparison",
  "finalise-international-comparison",
];
const SECTION_FEEDS = [
  "gdpTracker",
  "sentimentPulse",
  "employmentStats",
  "taxRevenue",
  "nationalDebt",
  "migrationStats",
  "housePriceIndex",
  "realWages",
  "crimeStatistics",
  "electionPolling",
];
const originalStates = Object.entries(PUBLICATION_CONFIG.publications).map(
  ([id, publication]) => [id, publication.state] as const,
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DAILY_TIME);
  collectors.section.mockImplementation(collectorDefaults.section);
  collectors.external.mockImplementation(collectorDefaults.external);
  collectors.shard.mockImplementation(collectorDefaults.shard);
  vi.mocked(dispatchPublicationMessage).mockClear();
  // No test reaches a real source.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("offline", { status: 503 })));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const [id, state] of originalStates) PUBLICATION_CONFIG.publications[id].state = state;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Retry waits are real delays; run them at once so tests count attempts.
function skipRetryDelays() {
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as unknown as typeof setTimeout);
}

describe("queue routing", () => {
  it.each(LEGACY_TYPES)("hands a legacy '%s' message to the legacy dispatcher unchanged", async (type) => {
    const h = seededHarness();
    const msg = message({ body: { type }, attempts: 1 });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await publicWorker.queue({ messages: [msg] } as never, h.env as never, {} as never);

    expect(dispatchPublicationMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(dispatchPublicationMessage).mock.calls[0][0]).toBe(msg);
    expect(h.putKeys().filter((key) => key.startsWith("v20:"))).toEqual([]);
  });

  it("runs the new message types on the pipeline, never the legacy dispatcher", async () => {
    const h = seededHarness();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await deliver(h, {
      body: { type: "finalise", runId: "2026-11-10T03-17-00.000Z", deadlineAt: DAILY_TIME.toISOString() },
      attempts: 1,
    });

    // No such pipeline run: retried, not acknowledged, nothing written.
    expect(outcome).toBe("retry");
    expect(dispatchPublicationMessage).not.toHaveBeenCalled();
    expect(h.env.METRICS_CACHE.put).not.toHaveBeenCalled();
  });

  it("retries an unknown message shape without acknowledging it or writing anything", async () => {
    const h = seededHarness();
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const body of [
      { type: "mystery", runId: "r", jobId: "j" },
      { runId: "r", jobId: "j" },
      { type: "collect", runId: "r" },
    ]) {
      const msg = message({ body, attempts: 1 });
      await publicWorker.queue({ messages: [msg] } as never, h.env as never, {} as never);
      expect(msg.retry).toHaveBeenCalledTimes(1);
      expect(msg.ack).not.toHaveBeenCalled();
    }
    expect(dispatchPublicationMessage).not.toHaveBeenCalled();
    expect(h.env.METRICS_CACHE.put).not.toHaveBeenCalled();
  });

  it("routes a mixed batch: a half-finished legacy run finishes on legacy code beside a pipeline run", async () => {
    const h = seededHarness();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // A legacy daily run created by the previous revision, one job left.
    const startedAt = new Date(DAILY_TIME.getTime() - 86_400_000);
    const { run: legacyRun } = await createRun(h.env, startedAt, "daily", { publishedOnly: true });
    for (const jobId of legacyRun.expectedJobIds) {
      if (jobId === "section:gdpTracker") continue;
      h.store.set(terminalKey(legacyRun.runId, jobId), { runId: legacyRun.runId, jobId, status: "success" });
    }
    // A pipeline run started by the new cron.
    await cron(h);
    const pipelineCollect = h.queue.find((item) => item.body.type === "collect" && item.body.feedId === "realWages")!;

    const legacyJob = message({ body: { type: "refresh-section", section: "gdpTracker", runId: legacyRun.runId, jobId: "section:gdpTracker" }, attempts: 1 });
    const legacyFinalise = message({ body: { type: "finalise-run", runId: legacyRun.runId }, attempts: 1 });
    const pipelineMsg = message(pipelineCollect);
    const unknown = message({ body: { type: "mystery" }, attempts: 1 });
    await publicWorker.queue(
      { messages: [legacyJob, pipelineMsg, unknown, legacyFinalise] } as never,
      h.env as never,
      {} as never,
    );

    expect(dispatchPublicationMessage).toHaveBeenCalledTimes(2);
    expect(legacyJob.ack).toHaveBeenCalled();
    expect(legacyFinalise.ack).toHaveBeenCalled();
    expect(pipelineMsg.ack).toHaveBeenCalled();
    expect(unknown.retry).toHaveBeenCalled();
    expect(unknown.ack).not.toHaveBeenCalled();
    // The legacy run finalised through the legacy finaliser and its keys.
    const finished = h.read(legacyRunKey(legacyRun.runId));
    expect(finished.finalisedAt).toEqual(expect.any(String));
    expect(finished.status).toBe("published");
    expect(h.read(terminalKey(legacyRun.runId, "section:gdpTracker")).status).toBe("success");
    // The pipeline collect recorded its own run's attempt.
    const pipelineRunId = String(pipelineCollect.body.runId);
    expect(h.read("v20:feed:realWages").lastAttempt).toMatchObject({ runId: pipelineRunId, status: "success" });
  });
});

describe("deploy bootstrap stays on the legacy path until G4", () => {
  it("a legacy bootstrap finalises on legacy code and still triggers the held comparison refresh, which stays unpublished", async () => {
    const h = seededHarness();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sha = "c".repeat(40);
    expect(await deliver(h, { body: { type: "bootstrap-publication", deploymentId: sha, forceComparison: true }, attempts: 1 })).toBe("ack");
    const runId = `bootstrap-${sha}`;
    const run = h.read(legacyRunKey(runId));
    expect(run).toMatchObject({ scope: "bootstrap", comparisonRefreshRequested: true });
    expect(h.read(runKey(runId))).toBeNull();
    for (const jobId of run.expectedJobIds) {
      h.store.set(terminalKey(runId, jobId), { runId, jobId, status: "success" });
    }
    h.queue.length = 0;

    expect(await deliver(h, { body: { type: "finalise-run", runId }, attempts: 1 })).toBe("ack");

    expect(h.read(legacyRunKey(runId))).toMatchObject({ finalisedAt: expect.any(String), comparisonRefreshQueuedAt: expect.any(String) });
    const types = h.queue.map((item) => item.body.type);
    expect(types).toContain("refresh-international-comparison");
    expect(types).toContain("finalise-international-comparison");
    const comparison = await publicWorker.fetch(
      new Request("https://public-data.org/data/international-comparison.json"),
      h.env as never,
    );
    expect(comparison.status).toBe(503);
  });
});

describe("cron", () => {
  it("starts the daily run on the pipeline: one run record, collect messages and a finaliser", async () => {
    const h = seededHarness();
    await cron(h);

    const runId = runIdFor(DAILY_TIME);
    const run = h.read(runKey(runId));
    expect(run).toMatchObject({ runId, scope: "daily", dispatchedAt: expect.any(String) });
    const types = h.queue.map((item) => item.body.type);
    expect(new Set(types)).toEqual(new Set(["collect", "finalise"]));
    expect(h.queue.filter((item) => item.body.type === "collect").map((item) => item.body.feedId).sort()).toEqual(
      [...SECTION_FEEDS, "governmentContracts"].sort(),
    );
    expect(h.read(legacyRunKey(runId))).toBeNull();
  });

  it("retries a failed collect batch send, then dispatches the run once", async () => {
    skipRetryDelays();
    const h = seededHarness();
    h.env.DATA_JOBS.sendBatch.mockRejectedValueOnce(new Error("queue unavailable"));

    await cron(h);

    expect(h.env.DATA_JOBS.sendBatch).toHaveBeenCalledTimes(2);
    expect(h.queue.filter((item) => item.body.type === "collect")).toHaveLength(11);
    expect(h.read(runKey(runIdFor(DAILY_TIME))).dispatchedAt).toEqual(expect.any(String));
  });

  it("leaves the run retryable when every send attempt fails, and logs it", async () => {
    skipRetryDelays();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = seededHarness();
    h.env.DATA_JOBS.sendBatch.mockRejectedValue(new Error("queue unavailable"));

    await cron(h);

    expect(h.env.DATA_JOBS.sendBatch).toHaveBeenCalledTimes(3);
    expect(h.env.DATA_JOBS.send).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "Cloudflare publication scheduling failed",
      expect.objectContaining({ error: "queue unavailable" }),
    );
    const run = h.read(runKey(runIdFor(DAILY_TIME)));
    expect(run).toMatchObject({ jobsEnqueuedAt: null, dispatchedAt: null, finalisedAt: null });

    // A redelivered cron for the same instant resumes the run and sends once.
    h.env.DATA_JOBS.sendBatch.mockImplementation(async (messages: { body: Record<string, unknown> }[]) => {
      for (const item of messages) h.queue.push({ body: item.body, attempts: 1 });
    });
    await cron(h);
    expect(h.queue.filter((item) => item.body.type === "collect")).toHaveLength(11);
    expect(h.read(runKey(runIdFor(DAILY_TIME))).dispatchedAt).toEqual(expect.any(String));
  });

  it("held feeds cause zero writes and zero sends", async () => {
    const h = seededHarness();
    await cron(h, BETTING_CRON);
    for (const item of Object.values(PUBLICATION_CONFIG.publications)) item.state = "held";
    await cron(h, DAILY_CRON);

    expect(h.env.METRICS_CACHE.put).not.toHaveBeenCalled();
    expect(h.env.DATA_JOBS.send).not.toHaveBeenCalled();
    expect(h.env.DATA_JOBS.sendBatch).not.toHaveBeenCalled();
  });

  it("keeps the held international comparison off the daily cron", async () => {
    expect(PUBLICATION_CONFIG.publications.internationalComparison.state).not.toBe("published");
    const h = seededHarness();
    await cron(h);
    expect(h.queue.some((item) => String(item.body.type).includes("comparison"))).toBe(false);
  });
});

describe("cron to publication through the wired Worker", () => {
  async function health(h: ReturnType<typeof seededHarness>) {
    const response = await publicWorker.fetch(new Request("https://public-data.org/data/health.json"), h.env as never);
    return response.json();
  }

  it("a healthy run publishes, serves health and an archive edition, and keeps the legacy keys current", async () => {
    const h = seededHarness();
    const { runId } = await runDaily(h);

    expect(h.read(runKey(runId))).toMatchObject({ status: "published", missingFeeds: [] });
    expect(h.dlq).toEqual([]);
    const publication = h.read(PUBLICATION_CURRENT_KEY);
    expect(publication.gdpTracker).toEqual(sectionData("gdpTracker", DAILY_TIME));
    expect(publication.governmentContracts).toBeTruthy();
    expect(h.read(PUBLICATION_STATUS_KEY)).toMatchObject({ generatedAt: publication.meta.generatedAt });
    expect(h.metadata.get(PUBLIC_SNAPSHOT_KEY)).toMatchObject({ generatedAt: publication.meta.generatedAt });
    const index = h.read(EDITION_INDEX_KEY);
    expect(JSON.stringify(index)).toContain(publication.meta.measureCatalog.editionId);
    // Legacy readers (the previous revision on rollback, the divergence log)
    // still find current legacy fragments and the legacy contracts record.
    for (const section of SECTION_FEEDS) {
      expect(h.read(`v12:publication:section:${section}`)).toEqual(h.read(`v20:feed:${section}`).record);
    }
    expect(h.read(LEGACY_CONTRACTS_KEY)).toEqual(h.read("v20:feed:governmentContracts").record);
    const body = await health(h);
    expect(body).toEqual({ status: "ready", ready: true, held: ["nhsStats"] });
    expect(body).not.toHaveProperty("missingRequiredSections");
    expect(JSON.stringify(body)).not.toMatch(/collector-failed|v1[234]:|v20:/);
  });

  it("a collector failing every retry keeps prior evidence only within its validity and the run is incomplete", async () => {
    const failingSource = async (section: string, env?: unknown, ctx?: unknown, now?: Date) => {
      if (section === "housePriceIndex") throw new Error("ONS bulletin unreachable");
      return collectorDefaults.section(section, env, ctx, now);
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const yesterday = new Date(DAILY_TIME.getTime() - 86_400_000);

    // (a) the prior record is still valid at finalisation: it is served.
    const validUntil = new Date(DAILY_TIME.getTime() + 7 * 86_400_000).toISOString();
    const prior = sectionRecord("housePriceIndex", yesterday, validUntil);
    let h = seededHarness(DAILY_TIME, {
      "v20:feed:housePriceIndex": { feedId: "housePriceIndex", record: prior, lastAttempt: { runId: "earlier", at: yesterday.toISOString(), status: "success", reason: null } },
    });
    collectors.section.mockImplementation(failingSource);
    let { runId } = await runDaily(h);

    expect(h.read(runKey(runId))).toMatchObject({ status: "incomplete", missingFeeds: ["housePriceIndex"] });
    expect(h.dlq).toEqual([expect.objectContaining({ type: "collect", feedId: "housePriceIndex" })]);
    expect(h.read("v20:feed:housePriceIndex")).toMatchObject({ record: prior, lastAttempt: { runId, status: "failure" } });
    expect(h.read(PUBLICATION_CURRENT_KEY).housePriceIndex).toEqual(prior.data);
    expect((await health(h)).ready).toBe(true);

    // (b) the prior record and the committed copy have expired: unavailable.
    const expired = new Date(DAILY_TIME.getTime() - 60_000).toISOString();
    const committed = committedSnapshot(yesterday);
    (committed as Record<string, unknown>).housePriceIndex = sectionData("housePriceIndex", yesterday, expired);
    h = seededHarness(DAILY_TIME, {
      [PUBLICATION_CURRENT_KEY]: committed,
      "v20:feed:housePriceIndex": { feedId: "housePriceIndex", record: sectionRecord("housePriceIndex", yesterday, expired), lastAttempt: { runId: "earlier", at: yesterday.toISOString(), status: "success", reason: null } },
    });
    ({ runId } = await runDaily(h));

    expect(h.read(runKey(runId))).toMatchObject({ status: "incomplete", missingFeeds: ["housePriceIndex"] });
    expect(h.read("v20:feed:housePriceIndex")).toMatchObject({ record: null, lastAttempt: { runId, status: "failure" } });
    expect(h.read(PUBLICATION_CURRENT_KEY)).not.toHaveProperty("housePriceIndex");
    const body = await health(h);
    expect(body).toMatchObject({ status: "degraded", ready: false, missingRequiredSections: ["housePriceIndex"] });
    expect(body.unavailableSections).toContainEqual({ id: "housePriceIndex", reason: "collector-failed" });
  });

  it("never collects a held feed and never serves it", async () => {
    expect(PUBLICATION_CONFIG.publications.nhsStats.state).not.toBe("published");
    const h = seededHarness();
    await runDaily(h);

    expect(collectors.section.mock.calls.map(([section]) => section)).not.toContain("nhsStats");
    expect(h.read("v20:feed:nhsStats")).toBeNull();
    expect(h.store.get(PUBLIC_SNAPSHOT_KEY)).not.toContain("nhsStats");
    expect((await health(h)).held).toEqual(["nhsStats"]);
  });

  it("redelivered messages after a successful run write nothing and send nothing", async () => {
    const h = seededHarness();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sent: { body: Record<string, unknown>; attempts: number }[] = [];
    h.env.DATA_JOBS.sendBatch.mockImplementation(async (messages: { body: Record<string, unknown> }[]) => {
      for (const item of messages) {
        h.queue.push({ body: item.body, attempts: 1 });
        sent.push({ body: item.body, attempts: 1 });
      }
    });
    const { finalise } = await runDaily(h);
    const puts = h.env.METRICS_CACHE.put.mock.calls.length;
    const sends = h.env.DATA_JOBS.send.mock.calls.length + h.env.DATA_JOBS.sendBatch.mock.calls.length;

    for (const item of [...sent, finalise]) {
      expect(await deliver(h, { body: item.body, attempts: 2 })).toBe("ack");
    }
    await cron(h);

    expect(h.env.METRICS_CACHE.put.mock.calls.length).toBe(puts);
    expect(h.env.DATA_JOBS.send.mock.calls.length + h.env.DATA_JOBS.sendBatch.mock.calls.length).toBe(sends);
  });
});

describe("rollback to the previous revision", () => {
  // publication-queue-dispatcher.js is unchanged from the deployed revision.
  it("the legacy dispatcher retries a new-type message and writes nothing, so it reaches the dead-letter queue", async () => {
    const actual = await vi.importActual<typeof import("@/worker/publication-queue-dispatcher")>(
      "@/worker/publication-queue-dispatcher",
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const body of [
      { type: "collect", runId: "2026-11-10T03-17-00.000Z", feedId: "gdpTracker" },
      { type: "finalise", runId: "2026-11-10T03-17-00.000Z", deadlineAt: DAILY_TIME.toISOString() },
      { type: "bootstrap", scope: "bootstrap", runId: `bootstrap-${"a".repeat(40)}` },
    ]) {
      const h = seededHarness();
      const msg = message({ body, attempts: 4 });
      await actual.dispatchPublicationMessage(msg, h.env, {});
      expect(msg.retry).toHaveBeenCalledTimes(1);
      expect(msg.ack).not.toHaveBeenCalled();
      expect(h.env.METRICS_CACHE.put).not.toHaveBeenCalled();
      expect(h.env.DATA_JOBS.send).not.toHaveBeenCalled();
    }
  });
});
