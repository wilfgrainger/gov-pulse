// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_P95_MS,
  MIN_RUN_WINDOW_MS,
  dispatch,
  dueFeeds,
  parseMessage,
  runDeadline,
} from "@/worker/pipeline";
import { refreshJobs } from "@/worker/publication-plan";

const NOW = new Date("2026-11-06T03:17:00.000Z");
const idsOf = (jobs: { section?: string; type: string }[]) =>
  jobs.map((job) => (job.type === "refresh-contracts" ? "governmentContracts" : job.section));

describe("pipeline due feeds", () => {
  it("daily matches the published collection plan, contracts included", () => {
    expect(dueFeeds(NOW, "daily")).toEqual(
      idsOf(refreshJobs("r", "daily", { publishedOnly: true })),
    );
  });

  it("held feeds are never due on a recurring scope", () => {
    expect(dueFeeds(NOW, "daily")).not.toContain("nhsStats");
    expect(dueFeeds(NOW, "3h")).toEqual([]);
  });

  it("bootstrap covers the required feeds and adds contracts only when asked", () => {
    const base = dueFeeds(NOW, "bootstrap");
    expect(base).toEqual(idsOf(refreshJobs("r", "bootstrap")));
    expect(base).not.toContain("governmentContracts");
    expect(dueFeeds(NOW, "bootstrap", { includeContracts: true })).toContain("governmentContracts");
  });

  it("weekly has nothing scheduled yet", () => {
    expect(dueFeeds(NOW, "weekly")).toEqual([]);
  });

  it("rejects an unknown scope", () => {
    expect(() => dueFeeds(NOW, "hourly" as never)).toThrow(/scope/);
  });
});

describe("pipeline run deadline", () => {
  it("never shortens the 25 minute window", () => {
    const deadline = runDeadline(NOW, ["gdpTracker"], { gdpTracker: 1000 });
    expect(deadline.getTime() - NOW.getTime()).toBe(MIN_RUN_WINDOW_MS);
  });

  it("is derived from measured p95 durations x 1.5 when that exceeds 25 minutes", () => {
    const feeds = Array.from({ length: 50 }, (_, i) => `feed${i}`);
    const p95 = Object.fromEntries(feeds.map((id) => [id, 40_000]));
    const deadline = runDeadline(NOW, feeds, p95);
    expect(deadline.getTime() - NOW.getTime()).toBe(50 * 40_000 * 1.5);
  });

  it("50 synthetic feeds at measured p95 finish before the derived deadline", () => {
    const feeds = Array.from({ length: 50 }, (_, i) => `feed${i}`);
    const p95 = Object.fromEntries(feeds.map((id) => [id, 21_239]));
    const serialTime = feeds.reduce((sum, id) => sum + p95[id], 0);
    expect(NOW.getTime() + serialTime).toBeLessThan(runDeadline(NOW, feeds, p95).getTime());
  });

  it("uses the measured worst case for a feed with no measurement", () => {
    const deadline = runDeadline(NOW, Array.from({ length: 100 }, (_, i) => `f${i}`), {});
    expect(deadline.getTime() - NOW.getTime()).toBe(100 * DEFAULT_P95_MS * 1.5);
  });
});

describe("pipeline messages", () => {
  it("accepts the three message types", () => {
    expect(parseMessage({ type: "collect", runId: "r", feedId: "gdpTracker" }).type).toBe("collect");
    expect(parseMessage({ type: "collect", runId: "r", feedId: "governmentContracts", shard: "2026-11-05" }).type).toBe("collect");
    expect(parseMessage({ type: "finalise", runId: "r", deadlineAt: NOW.toISOString() }).type).toBe("finalise");
    expect(parseMessage({ type: "bootstrap", scope: "bootstrap" }).type).toBe("bootstrap");
  });

  it("rejects malformed messages", () => {
    expect(() => parseMessage({ type: "collect", runId: "r" })).toThrow();
    expect(() => parseMessage({ type: "finalise", runId: "r", deadlineAt: "not a date" })).toThrow();
    expect(() => parseMessage(null)).toThrow();
  });

  it("unknown message type is retried, not acked", async () => {
    const message = { body: { type: "refresh-section" }, attempts: 1, ack: vi.fn(), retry: vi.fn() };
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await dispatch(message, {}, {});
    error.mockRestore();
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });
});
