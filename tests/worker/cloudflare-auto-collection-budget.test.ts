// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLICATION_CONFIG } from "@/contracts/evidence-policy";
import queuedWorker, {
  BETTING_CRON,
  DAILY_CRON,
  refreshJobs,
} from "@/worker/queued-publication-entry";

const original = Object.entries(PUBLICATION_CONFIG.publications).map(
  ([id, publication]) => [id, publication.state] as const,
);

afterEach(() => {
  for (const [id, state] of original) {
    PUBLICATION_CONFIG.publications[id].state = state;
  }
  vi.restoreAllMocks();
});

describe("Cloudflare automatic collection budget", () => {
  it("schedules and bootstraps only published publications", () => {
    for (const item of Object.values(PUBLICATION_CONFIG.publications)) item.state = "held";
    PUBLICATION_CONFIG.publications.nationalDebt.state = "published";
    PUBLICATION_CONFIG.publications.editionArchive.state = "published";

    expect(refreshJobs("daily", "daily", { publishedOnly: true })).toEqual([
      {
        type: "refresh-section",
        section: "nationalDebt",
        runId: "daily",
        jobId: "section:nationalDebt",
      },
    ]);
    expect(refreshJobs("betting", "betting", { publishedOnly: true })).toEqual([]);
    // A deploy bootstrap never collects a held publication either.
    expect(refreshJobs("bootstrap", "bootstrap").map((job) => job.section)).toEqual(["nationalDebt"]);
  });

  it("does no Queue or KV work for an inactive three-hour cron", async () => {
    PUBLICATION_CONFIG.publications.bettingOdds.state = "held";
    const read = vi.fn();
    const put = vi.fn();
    const sendBatch = vi.fn();
    const send = vi.fn();
    const pending: Promise<unknown>[] = [];
    queuedWorker.scheduled(
      { cron: BETTING_CRON, scheduledTime: Date.UTC(2026, 9, 22, 3, 47) },
      { METRICS_CACHE: { get: read, put }, DATA_JOBS: { sendBatch, send } },
      { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
    );
    await Promise.all(pending);
    expect(read).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(sendBatch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("retains a daily collector when its evidence publication is published", () => {
    for (const item of Object.values(PUBLICATION_CONFIG.publications)) item.state = "held";
    PUBLICATION_CONFIG.publications.nationalDebt.state = "published";
    expect(refreshJobs("daily", "daily", { publishedOnly: true })).toHaveLength(1);
    PUBLICATION_CONFIG.publications.bettingOdds.state = "published";
    expect(refreshJobs("betting", "betting", { publishedOnly: true })).toHaveLength(1);
    expect(DAILY_CRON).toBe("17 3 * * *");
  });
});
