import { describe, expect, it } from "vitest";
import { FEED_REGISTRY } from "../../worker/feed-registry.js";
import { BETTING_CRON, DAILY_CRON } from "../../worker/queued-publication-entry.js";
import { deriveScheduledWork } from "../../scripts/audit-free-budget.mjs";

describe("Cloudflare-free scheduled workload accounting", () => {
  it("derives the healthy scheduled baseline from registry and cron definitions", () => {
    expect(deriveScheduledWork(FEED_REGISTRY, [DAILY_CRON, BETTING_CRON])).toMatchObject({
      messagesPerDay: 30,
      operationsPerDay: 90,
      archiveKv: {
        finalizerRunsPerDay: 1,
        readsPerRun: 2,
        maximumOperationsPerRun: 8,
        maximumConfiguredOperationsPerDay: 32,
      },
    });
  });

  it("increases the daily workload when an active daily feed is added", () => {
    const registry = {
      ...FEED_REGISTRY,
      addedDailyFeed: { operationalStatus: "active", refreshCadence: "daily" },
    };
    expect(deriveScheduledWork(registry, [DAILY_CRON, BETTING_CRON]).messagesPerDay).toBe(31);
  });

  it("counts failed delivery retries as additional queue work", () => {
    expect(deriveScheduledWork(FEED_REGISTRY, [DAILY_CRON, BETTING_CRON], {
      retryDeliveries: 4,
    })).toMatchObject({ messagesPerDay: 34, operationsPerDay: 102 });
  });
});
