// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  INTERNATIONAL_COMPARISON_REFRESH_BATCHES,
  INTERNATIONAL_SOURCES,
  collectShard,
  combine,
} from "@/feeds/international-comparison/parse.js";
import { FEEDS } from "@/feeds/index.js";

describe("international-comparison sharded feed", () => {
  const entry = FEEDS.find((feed) => feed.definition.id === "internationalComparison");

  it("declares its source batches as shards and registers collectShard and combine", () => {
    expect(entry?.definition.shards?.kind).toBe("batch");
    expect(entry?.definition.shards?.batches).toBe(INTERNATIONAL_COMPARISON_REFRESH_BATCHES);
    expect(entry?.collectShard).toBe(collectShard);
    expect(entry?.combine).toBe(combine);
    expect(entry?.collect).toBeUndefined();
  });

  it("batches cover every runtime source exactly as the queue dispatcher expects", () => {
    expect(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.map(({ id }) => id)).toEqual([
      "government-debt", "oda", "defence", "social-spending", "healthcare", "tax-revenue", "debt-interest",
    ]);
    const covered = new Set(INTERNATIONAL_COMPARISON_REFRESH_BATCHES.flatMap(({ sourceIds }) => sourceIds));
    expect([...covered].sort()).toEqual([...INTERNATIONAL_SOURCES].sort());
    expect(Object.isFrozen(INTERNATIONAL_COMPARISON_REFRESH_BATCHES[0])).toBe(true);
    expect(Object.isFrozen(INTERNATIONAL_COMPARISON_REFRESH_BATCHES[0].sourceIds)).toBe(true);
  });

  it("collectShard refuses an unknown batch or a missing baseline instead of publishing a guess", async () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    await expect(collectShard({ fetch, now, previous: {} }, "no-such-batch")).rejects.toThrow(/baseline is not available/);
    await expect(collectShard({ fetch, now, previous: null }, "oda")).rejects.toThrow(/baseline is not available/);
  });
});
