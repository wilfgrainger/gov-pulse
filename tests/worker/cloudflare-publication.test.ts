// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import queuedWorker, {
  FREE_TIER_BUDGET,
  RUN_PREFIX,
  createRun,
  finaliseRun,
  jobsForDay,
  publishFromCaches,
  refreshJobs,
} from "@/worker/queued-publication-entry";
import { PUBLICATION_CURRENT_KEY } from "@/worker/publication-entry";
import {
  buildContractsFromShards,
  previousCompleteDays,
} from "@/worker/government-contracts-cloudflare";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

const REQUIRED = [
  "sentimentPulse",
  "gdpTracker",
  "employmentStats",
  "nationalDebt",
  "taxRevenue",
  "migrationStats",
  "electionPolling",
  "nhsStats",
];

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          try {
            store.set(key, JSON.parse(value));
          } catch {
            store.set(key, value);
          }
        }),
      },
    },
  };
}

function snapshot() {
  const fetchedAt = "2026-07-17T10:00:00.000Z";
  const sources = Object.fromEntries(
    REQUIRED.map((section) => [
      section,
      { status: "ok", cacheState: "fresh", fetchedAt },
    ])
  );
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: "2026-07-17T12:00:00.000Z",
      fetchedAt: "2026-07-17T12:00:00.000Z",
      publicationMode: "queue-free-tier",
      freeTierBudget: FREE_TIER_BUDGET,
      sources,
    },
    ...Object.fromEntries(REQUIRED.map((section) => [section, { value: section }])),
    migrationStats: { headline: { netMigration: 171_000 } },
  };
}

function quality(validComparableAwards: number) {
  return {
    pagesFetched: 4,
    requestsMade: 4,
    releasesSeen: validComparableAwards,
    awardsSeen: validComparableAwards,
    validComparableAwards,
    excludedMissingValue: 0,
    excludedNonGbp: 0,
    excludedMissingBuyer: 0,
    excludedMissingSupplier: 0,
    excludedMalformed: 0,
    duplicatesRemoved: 0,
  };
}

function award(index: number, day: string) {
  const release = String(index + 1).padStart(6, "0");
  const ocid = `ocds-h6vhtk-${(index + 1).toString(16)}`;
  return {
    rank: 0,
    key: `${ocid}:award-${index + 1}`,
    ocid,
    releaseId: `${release}-2026`,
    awardId: `award-${index + 1}`,
    title: `Award ${index + 1}`,
    buyer: `Buyer ${(index % 8) + 1}`,
    suppliers: [`Supplier ${(index % 20) + 1}`],
    awardDate: `${day}T12:00:00.000Z`,
    publishedAt: `${day}T13:00:00.000Z`,
    amount: 10_000_000 - index * 10_000,
    currency: "GBP",
    procurementMethod: "open",
    procurementMethodDetails: "Open procedure",
    mainProcurementCategory: "services",
    framework: false,
    noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${release}-2026`,
    procurementUrl: `https://www.find-tender.service.gov.uk/procurement/${ocid}`,
  };
}

describe("Cloudflare Free data publication", () => {
  it("keeps the bounded control plane well inside free-tier allowances", () => {
    expect(FREE_TIER_BUDGET).toMatchObject({
      cronInvocationsPerDay: 9,
      queueJobsPerDayMax: 28,
      queueOperationsPerDayMax: 84,
      officialSectionsPerDay: 10,
      contractRequestsPerDayMax: 36,
      kvWritesPerDayTargetMax: 120,
      kvReadsPerDayTargetMax: 300,
    });
    expect(FREE_TIER_BUDGET.queueOperationsPerDayMax).toBeLessThan(10_000);
    expect(FREE_TIER_BUDGET.kvWritesPerDayTargetMax).toBeLessThan(1_000);
    expect(FREE_TIER_BUDGET.kvReadsPerDayTargetMax).toBeLessThan(100_000);
  });

  it("schedules every public section and contracts daily", () => {
    const jobs = jobsForDay();
    expect(jobs).toHaveLength(11);
    expect(jobs.filter((job) => job.type === "refresh-section")).toHaveLength(7);
    expect(
      jobs.filter((job) => job.type === "refresh-external-section")
    ).toHaveLength(3);
    expect(jobs.filter((job) => job.type === "refresh-contracts")).toHaveLength(1);
  });

  it("uses a single betting-only refresh between daily runs", () => {
    expect(refreshJobs("betting-run", "betting")).toEqual([
      {
        type: "refresh-external-section",
        section: "bettingOdds",
        runId: "betting-run",
        jobId: "external:bettingOdds",
      },
    ]);
  });

  it("does not expose the operational publication through the Worker", async () => {
    const { env } = kvEnv({ [PUBLICATION_CURRENT_KEY]: snapshot() });
    const waitUntil = vi.fn();
    const response = await queuedWorker.fetch(
      new Request("https://data-worker.public-data.org/data/metrics-snapshot.json"),
      env,
      { waitUntil }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(env.METRICS_CACHE.get).not.toHaveBeenCalled();
    expect(env.METRICS_CACHE.put).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("overlays current fragments while retaining current last-known-good evidence", async () => {
    const current = snapshot();
    const fragment = {
      section: "gdpTracker",
      data: { headline: { monthlyGrowth: 0.1, period: "May 2026" } },
      source: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: "2026-07-18T03:20:00.000Z",
        source: "ONS GDP monthly estimate",
      },
      fetchedAt: "2026-07-18T03:20:00.000Z",
    };
    const { env, store } = kvEnv({
      [PUBLICATION_CURRENT_KEY]: current,
      "v12:publication:section:gdpTracker": fragment,
    });

    const result = await publishFromCaches(env, {
      now: new Date("2026-07-18T03:30:00.000Z"),
    });

    expect(result.changed).toBe(true);
    expect(result.publication.migrationStats).toEqual(current.migrationStats);
    expect(result.publication.gdpTracker).toEqual(fragment.data);
    expect(result.publication.meta.publicationMode).toBe("queue-free-tier");
    expect(result.publication.meta.delivery).toBe("published-snapshot");
    expect(result.publication.meta.publicationDiagnostics).toEqual(
      expect.any(Object),
    );
    expect(store.get(PUBLICATION_CURRENT_KEY)).toEqual(result.publication);
  });

  it("keeps the canonical edition complete when a required section expires", async () => {
    const current = snapshot();
    current.meta.sources.nhsStats.fetchedAt = "2026-04-01T00:00:00.000Z";
    const { env, store } = kvEnv({ [PUBLICATION_CURRENT_KEY]: current });

    const result = await publishFromCaches(env, {
      now: new Date("2026-07-18T03:30:00.000Z"),
    });

    expect(result.incomplete).toBe(true);
    expect(result.status.status).toBe("incomplete");
    expect(result.status.missingRequired).toContain("nhsStats");
    expect(store.get(PUBLICATION_CURRENT_KEY)).toEqual(current);
  });

  it("preserves the edition clock while storing refreshed retrieval clocks", async () => {
    const current = snapshot();
    const fragment = {
      section: "migrationStats",
      data: structuredClone(current.migrationStats),
      source: {
        ...current.meta.sources.migrationStats,
        fetchedAt: "2026-07-17T11:00:00.000Z",
      },
      fetchedAt: "2026-07-17T11:00:00.000Z",
    };
    const { env, store } = kvEnv({
      [PUBLICATION_CURRENT_KEY]: current,
      "v12:publication:section:migrationStats": fragment,
    });

    const first = await publishFromCaches(env, {
      now: new Date("2026-07-17T12:30:00.000Z"),
    });
    store.set("v12:publication:section:migrationStats", {
      ...fragment,
      source: { ...fragment.source, fetchedAt: "2026-07-17T11:30:00.000Z" },
      fetchedAt: "2026-07-17T11:30:00.000Z",
    });
    const result = await publishFromCaches(env, {
      now: new Date("2026-07-17T13:00:00.000Z"),
    });

    expect(first.changed).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.publication.meta.generatedAt).toBe(first.publication.meta.generatedAt);
    expect(result.publication.meta.fetchedAt).toBe(first.publication.meta.fetchedAt);
    expect(
      (store.get(PUBLICATION_CURRENT_KEY) as ReturnType<typeof snapshot>).meta.sources.migrationStats.fetchedAt
    ).toBe("2026-07-17T11:30:00.000Z");
  });

  it("finalises an all-failed run without publishing a false fresh edition", async () => {
    const now = new Date("2026-08-01T03:17:00.000Z");
    const { env, store } = kvEnv();
    const { run } = await createRun(env, now);
    for (const jobId of run.expectedJobIds) {
      store.set(`${RUN_PREFIX}${run.runId}:terminal:${jobId}`, {
        runId: run.runId,
        jobId,
        status: "failure",
      });
    }

    const result = await finaliseRun(run.runId, env, {
      now: new Date("2026-08-01T03:43:00.000Z"),
    });

    expect(result.run.status).toBe("incomplete");
    expect(result.run.successfulJobIds).toEqual([]);
    expect(store.has(PUBLICATION_CURRENT_KEY)).toBe(false);
  });

  it("does not publish or mark a run successful when a required job fails", async () => {
    const now = new Date("2026-08-01T03:17:00.000Z");
    const { env, store } = kvEnv();
    const { run } = await createRun(env, now);
    for (const [index, jobId] of run.expectedJobIds.entries()) {
      store.set(`${RUN_PREFIX}${run.runId}:terminal:${jobId}`, {
        runId: run.runId,
        jobId,
        status: index === 0 ? "failure" : "success",
      });
    }

    const result = await finaliseRun(run.runId, env, {
      now: new Date("2026-08-01T03:43:00.000Z"),
    });

    expect(result.run.status).toBe("incomplete");
    expect(result.run.failedJobIds).toEqual([run.expectedJobIds[0]]);
    expect(store.has(PUBLICATION_CURRENT_KEY)).toBe(false);
  });

  it("keeps a failed run open for Queue retries until its deadline", async () => {
    const now = new Date("2026-08-01T03:17:00.000Z");
    const { env, store } = kvEnv();
    const { run } = await createRun(env, now);
    for (const jobId of run.expectedJobIds) {
      store.set(`${RUN_PREFIX}${run.runId}:terminal:${jobId}`, {
        runId: run.runId,
        jobId,
        status: "failure",
      });
    }

    const result = await finaliseRun(run.runId, env, {
      now: new Date("2026-08-01T03:40:00.000Z"),
    });

    expect(result.pending).toBe(true);
    expect(result.run.finalisedAt).toBeNull();
  });

  it("builds exactly 100 ranked awards only from seven complete UTC shards", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const days = previousCompleteDays(now, 7);
    let cursor = 0;
    const shards = days.map((day) => {
      const awards = Array.from({ length: 20 }, () => award(cursor++, day));
      return {
        schemaVersion: 1,
        day,
        complete: true,
        collectedAt: now.toISOString(),
        awards,
        dataQuality: quality(awards.length),
      };
    });

    const payload = buildContractsFromShards(shards, now);
    expect(payload?.awards).toHaveLength(100);
    expect(payload?.awards[0].rank).toBe(1);
    expect(payload?.awards[99].rank).toBe(100);
    expect(payload?.dataQuality.validComparableAwards).toBe(140);
    expect(payload?.window.updatedFrom).toBe(`${days[0]}T00:00:00.000Z`);
    expect(payload?.window.updatedTo).toBe(`${days[6]}T23:59:59.999Z`);
  });
});