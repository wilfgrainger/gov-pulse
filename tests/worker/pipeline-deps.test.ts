// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { previousCompleteDays, rankDailyAwards } from "@/feeds/government-contracts/parse";
import { createPipeline } from "@/worker/pipeline";
import { createCollectorDeps, createPipelineDeps } from "@/worker/pipeline-deps";

const NOW = new Date("2026-11-10T03:17:00.000Z");
const DAYS = previousCompleteDays(NOW, 7);
const release = (day: string, index: number) => ({
  ocid: `ocds-h6vhtk-${index.toString(16).padStart(8, "0")}`,
  id: `${String(index).padStart(6, "0")}-2026`,
  date: `${day}T13:00:00.000Z`,
  buyer: { name: "Buyer" },
  tender: { title: "Contract", procurementMethod: "open", mainProcurementCategory: "services" },
  awards: [{ id: `award-${index}`, title: "Award", date: `${day}T12:00:00.000Z`, value: { amount: 1000 + index, currency: "GBP" }, suppliers: [{ name: "Supplier", id: "supplier-1" }] }],
  contracts: [],
  parties: [{ id: "supplier-1", address: { postalCode: "SY1 1AA" } }],
});
const dayShard = (day: string, index: number) => rankDailyAwards([release(day, index)], day, NOW, {});
const record = (section: string) => ({ section, data: { ok: true }, fetchedAt: NOW.toISOString() });

function deps() {
  const collectSection = vi.fn(async (section: string) => record(section));
  const collectExternal = vi.fn(async (section: string) => record(section));
  return { collectSection, collectExternal, ...createCollectorDeps({ collectSection, collectExternal }) };
}

describe("pipeline collector deps", () => {
  it("routes a generic section and an external section to their own collectors", async () => {
    const d = deps();
    await expect(d.collectFeed({}, "gdpTracker", { runId: "r", now: NOW })).resolves.toEqual(record("gdpTracker"));
    await expect(d.collectFeed({}, "electionPolling", { runId: "r", now: NOW })).resolves.toEqual(record("electionPolling"));
    expect(d.collectSection).toHaveBeenCalledTimes(1);
    expect(d.collectExternal).toHaveBeenCalledWith("electionPolling", expect.objectContaining({ now: NOW }));
  });

  it("refuses a feed without a collection plan and a sharded feed as a whole", async () => {
    const d = deps();
    await expect(d.collectFeed({}, "notAFeed", { runId: "r", now: NOW })).rejects.toThrow(/no collector/i);
    await expect(d.collectFeed({}, "governmentContracts", { runId: "r", now: NOW })).rejects.toThrow(/no collector/i);
  });

  it("declares seven complete UTC day shards for contracts and none for sections", async () => {
    const d = deps();
    expect(await d.shardKeysFor("governmentContracts", NOW)).toEqual(DAYS);
    expect(await d.shardKeysFor("gdpTracker", NOW)).toBeNull();
    // Comparison batches need a baseline publication; this slice does not collect them.
    expect(await d.shardKeysFor("internationalComparison", NOW)).toBeNull();
  });

  it("combines seven complete day shards into a governmentContracts section record", async () => {
    const d = deps();
    const shards = Object.fromEntries(DAYS.map((day, index) => [day, dayShard(day, index)]));
    const combined = await d.combineShards("governmentContracts", shards, { now: NOW });
    expect(combined.section).toBe("governmentContracts");
    expect(combined.fetchedAt).toBe(NOW.toISOString());
    expect((combined.data as { awards: unknown[] }).awards).toHaveLength(7);
  });

  it("never combines a partial window", async () => {
    const d = deps();
    const shards = Object.fromEntries(DAYS.slice(1).map((day, index) => [day, dayShard(day, index)]));
    await expect(d.combineShards("governmentContracts", shards, { now: NOW })).rejects.toThrow(/incomplete/i);
    await expect(d.collectShard({}, "gdpTracker", DAYS[0], { runId: "r", now: NOW })).rejects.toThrow(/not sharded/i);
  });

  it("satisfies the pipeline dependency contract", () => {
    expect(() => createPipeline(createPipelineDeps())).not.toThrow();
  });
});
