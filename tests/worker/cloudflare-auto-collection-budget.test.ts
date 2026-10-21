// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLICATION_CONFIG } from "@/contracts/publication-policy";
import queuedWorker, {
  BETTING_CRON,
  DAILY_CRON,
  refreshJobs,
} from "@/worker/queued-publication-entry";

const original = Object.fromEntries(
  Object.entries(PUBLICATION_CONFIG.publications).map(([id, value]) => [id, value.enabled]),
);

afterEach(() => {
  for (const [id, enabled] of Object.entries(original)) {
    PUBLICATION_CONFIG.publications[id].enabled = enabled;
  }
  vi.restoreAllMocks();
});

describe("Cloudflare automatic collection budget", () => {
  it("keeps explicit bootstrap coverage while scheduling only enabled publications", () => {
    for (const item of Object.values(PUBLICATION_CONFIG.publications)) item.enabled = false;
    PUBLICATION_CONFIG.publications.nationalDebt.enabled = true;
    PUBLICATION_CONFIG.publications.editionArchive.enabled = true;

    expect(refreshJobs("daily", "daily", { publishedOnly: true })).toEqual([
      {
        type: "refresh-section",
        section: "nationalDebt",
        runId: "daily",
        jobId: "section:nationalDebt",
      },
    ]);
    expect(refreshJobs("betting", "betting", { publishedOnly: true })).toEqual([]);
    expect(refreshJobs("bootstrap", "bootstrap").length).toBeGreaterThan(1);
    expect(refreshJobs("manual", "daily").some((job) => job.section === "bettingOdds")).toBe(true);
  });

  it("does no Queue or KV work for an inactive three-hour cron", async () => {
    PUBLICATION_CONFIG.publications.bettingOdds.enabled = false;
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

  it("retains a daily collector when its evidence publication is enabled", () => {
    for (const item of Object.values(PUBLICATION_CONFIG.publications)) item.enabled = false;
    PUBLICATION_CONFIG.publications.nationalDebt.enabled = true;
    expect(refreshJobs("daily", "daily", { publishedOnly: true })).toHaveLength(1);
    // Restoring the disabled betting publication deliberately turns its cron back on.
    PUBLICATION_CONFIG.publications.bettingOdds.enabled = true;
    expect(refreshJobs("betting", "betting", { publishedOnly: true })).toHaveLength(1);
    expect(DAILY_CRON).toBe("17 3 * * *");
  });
});
