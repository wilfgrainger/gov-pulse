// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  buildContractsFromShards,
  collectDayShard,
  collectShard,
  combine,
  previousCompleteDays,
} from "@/feeds/government-contracts/parse.js";
import { FEEDS } from "@/feeds/index.js";

const now = new Date("2026-10-04T12:00:00.000Z");
const emptyReleases = () =>
  vi.fn(async () => new Response(
    JSON.stringify({ publisher: { name: "Cabinet Office" }, version: "1.1", releases: [] }),
    { headers: { "content-type": "application/json" } },
  )) as unknown as typeof fetch;

describe("government-contracts sharded feed", () => {
  it("declares seven day shards and registers collectShard and combine", () => {
    const entry = FEEDS.find((feed) => feed.definition.id === "governmentContracts");
    expect(entry?.definition.shards).toEqual({ kind: "day", window: 7 });
    expect(entry?.collectShard).toBe(collectShard);
    expect(entry?.combine).toBe(combine);
    expect(entry?.collect).toBeUndefined();
  });

  it("collectShard returns exactly the shard collectDayShard stores, without touching storage", async () => {
    const day = previousCompleteDays(now, 7)[0];
    const writes: Record<string, string> = {};
    const env = { METRICS_CACHE: { get: async () => null, put: async (key: string, value: string) => { writes[key] = value; } } };
    const stored = await collectDayShard(day, env, emptyReleases(), now);
    const viaFeed = await collectShard({ fetch: emptyReleases(), now }, day);
    expect(viaFeed).toEqual(stored);
    expect(JSON.parse(writes[`v12:contracts:day:${day}`])).toEqual(stored);
  });

  it("combine withholds the payload unless all seven complete day shards are present", async () => {
    const days = previousCompleteDays(now, 7);
    const shards = Object.fromEntries(
      await Promise.all(days.slice(0, 6).map(async (day) => [day, await collectShard({ fetch: emptyReleases(), now }, day)])),
    );
    expect(combine(shards, { now })).toBeNull();
    expect(buildContractsFromShards(Object.values(shards), now)).toBeNull();
  });
});
