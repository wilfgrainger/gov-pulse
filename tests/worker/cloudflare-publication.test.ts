// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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
  rankDailyAwards,
} from "@/worker/government-contracts-cloudflare";
import { ukNationFromPostcode } from "@/contracts/government-contracts";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

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
    realWages: { headline: { regularPayRealGrowthPercent: 0.6, totalPayRealGrowthPercent: 0.9 } },
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

function rawRelease(
  index: number,
  day: string,
  amount: number,
  id = `award-${index}`,
  releaseId = `${String(index).padStart(6, "0")}-2026`,
  ocid = `ocds-h6vhtk-${index.toString(16).padStart(8, "0")}`,
) {
  return {
    ocid,
    id: releaseId,
    date: `${day}T13:00:00.000Z`,
    buyer: { name: "Buyer" },
    tender: { title: "Contract", procurementMethod: "open", mainProcurementCategory: "services" },
    awards: [{ id, title: "Award", date: `${day}T12:00:00.000Z`, value: { amount, currency: "GBP" }, suppliers: [{ name: "Supplier", id: "supplier-1" }] }],
    parties: [{ id: "supplier-1", address: { postalCode: "SY1 1AA" } }],
  };
}

describe("Cloudflare Free data publication", () => {
  it("reports the healthy schedule and configured retry workload transparently", () => {
    expect(FREE_TIER_BUDGET).toMatchObject({
      cronInvocationsPerDay: 9,
      queueJobsPerDayHealthyTarget: 30,
      queueOperationsPerDayHealthyTarget: 90,
      queueJobsPerDayConfiguredRetryUpperBound: 120,
      queueOperationsPerDayConfiguredRetryUpperBound: 360,
      officialSectionsPerDay: 12,
      contractRequestsPerDayMax: 36,
      kvWritesPerDayTargetMax: 120,
      kvReadsPerDayTargetMax: 300,
    });
    expect(FREE_TIER_BUDGET.queueOperationsPerDayConfiguredRetryUpperBound).toBeGreaterThan(
      FREE_TIER_BUDGET.queueOperationsPerDayHealthyTarget,
    );
    expect(FREE_TIER_BUDGET.kvWritesPerDayTargetMax).toBeLessThan(1_000);
    expect(FREE_TIER_BUDGET.kvReadsPerDayTargetMax).toBeLessThan(100_000);
  });

  it("schedules every public section and contracts daily", () => {
    const jobs = jobsForDay();
    expect(jobs).toHaveLength(13);
    expect(jobs.filter((job) => job.type === "refresh-section")).toHaveLength(9);
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

  it("publishes an atomic degraded edition when a required section expires", async () => {
    const current = snapshot();
    current.meta.sources.employmentStats.fetchedAt = "2026-04-01T00:00:00.000Z";
    const { env, store } = kvEnv({ [PUBLICATION_CURRENT_KEY]: current });

    const result = await publishFromCaches(env, {
      now: new Date("2026-07-18T03:30:00.000Z"),
    });

    expect(result.status.status).toBe("degraded");
    expect(result.status.missingRequired).toContain("employmentStats");
    expect(result.publication).not.toHaveProperty("employmentStats");
    expect(result.publication.meta.sources).not.toHaveProperty("employmentStats");
    expect(result.publication.meta.publicationState).toBe("degraded");
    expect(store.get(PUBLICATION_CURRENT_KEY)).toEqual(result.publication);
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
      fetchImpl: async () => new Response("no seed", { status: 503 }),
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

  it("keeps revisions outside each day's top 100 so the newest revision wins across shards", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const days = previousCompleteDays(now, 7);
    const amendment = JSON.parse(readFileSync(new URL("../fixtures/contracts/downward-amendment.json", import.meta.url), "utf8"));
    const initial = [
      rawRelease(1, days[0], amendment.original.amount, amendment.awardId, amendment.original.releaseId, amendment.ocid),
      ...Array.from({ length: 100 }, (_, index) => rawRelease(index + 2, days[0], 2_000)),
    ];
    const daily = rankDailyAwards(initial, days[0], now);
    const revision = rankDailyAwards([
      rawRelease(1, days[1], amendment.revision.amount, amendment.awardId, amendment.revision.releaseId, amendment.ocid),
    ], days[1], now);
    const shards = [daily, revision, ...days.slice(2).map((day) => ({
      schemaVersion: 1,
      day,
      complete: true,
      collectedAt: now.toISOString(),
      awards: [],
      dataQuality: quality(0),
    }))];

    expect(daily.awards).toHaveLength(101);
    const publication = buildContractsFromShards(shards, now);
    expect(publication?.awards).toHaveLength(100);
    expect(publication?.awards.some((item) => item.amount === 1_000_000)).toBe(false);
    expect(publication?.awards.some((item) => item.awardId === amendment.awardId)).toBe(false);
  });

  it("does not classify border-straddling postcodes as a UK nation", () => {
    expect(ukNationFromPostcode("SY1 1AA")).toBe("Other/Unknown");
    expect(ukNationFromPostcode("TD1 1AA")).toBe("Other/Unknown");
    expect(ukNationFromPostcode("JE1 1AA")).toBe("Other/Unknown");
  });

  it("rejects a day shard above its retained-award cap instead of truncating it", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const day = previousCompleteDays(now, 7)[0];
    const releases = Array.from({ length: 2_501 }, (_, index) =>
      rawRelease(index + 1, day, 10_000 + index),
    );
    expect(() => rankDailyAwards(releases, day, now)).toThrow(/2,?500-award shard limit/i);
  });

  it("retains cancellation tombstones so an earlier active release is removed", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const days = previousCompleteDays(now, 7);
    const active = rawRelease(1, days[0], 1_000_000, "award-1");
    const cancelled = rawRelease(1, days[1], 1_000_000, "award-1");
    cancelled.awards[0].status = "cancelled";
    delete cancelled.awards[0].value;
    delete cancelled.awards[0].suppliers;
    const first = rankDailyAwards([active, ...Array.from({ length: 100 }, (_, index) =>
      rawRelease(index + 2, days[0], 2_000, `award-${index + 2}`))], days[0], now);
    const second = rankDailyAwards([cancelled], days[1], now);
    const rest = days.slice(2).map((day) => ({
      schemaVersion: 1, day, complete: true, collectedAt: now.toISOString(), awards: [], dataQuality: quality(0),
    }));

    expect(buildContractsFromShards([first, second, ...rest], now)?.awards).toHaveLength(100);
    expect(buildContractsFromShards([first, second, ...rest], now)?.awards.some((item) => item.awardId === "award-1")).toBe(false);
  });

  it("uses the higher release sequence when duplicate notices share a publication timestamp", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const day = previousCompleteDays(now, 7)[0];
    const original = rawRelease(1, day, 1_000_000, "award-1", "100001-2026");
    const latest = rawRelease(1, day, 900_000, "award-1", "100002-2026");
    const shard = rankDailyAwards([latest, original], day, now);
    expect(shard.awards).toHaveLength(1);
    expect(shard.awards[0].releaseId).toBe("100002-2026");
    expect(shard.awards[0].amount).toBe(900_000);
  });

  it("does not build a publication from an incomplete or wrong seven-day window", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    const days = previousCompleteDays(now, 7);
    const shards = days.map((day) => ({
      schemaVersion: 1, day, complete: true, collectedAt: now.toISOString(), awards: [], dataQuality: quality(0),
    }));
    shards[0].complete = false;
    expect(buildContractsFromShards(shards, now)).toBeNull();
    expect(buildContractsFromShards(shards.slice(1), now)).toBeNull();
  });
});
