// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  createMemoryKv,
  hasRequiredHistoryShape,
  isUsableSeedSection,
  sanitizePublishedSnapshot,
  validateSnapshot,
} from "@/scripts/build-static-snapshot.mjs";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

describe("static metrics snapshot", () => {
  it("provides the KV behaviour used by the Worker wrappers", async () => {
    const kv = createMemoryKv();
    await kv.put("record", JSON.stringify({ section: "gdpTracker" }));
    expect(await kv.get("record", "json")).toEqual({ section: "gdpTracker" });
    await kv.delete("record");
    expect(await kv.get("record", "json")).toBeNull();
  });

  it("requires current observation evidence before counting a section", () => {
    const snapshot = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: {
          gdpTracker: { status: "ok", cacheState: "fresh" },
          taxRevenue: { status: "error", cacheState: "missing" },
        },
      },
      gdpTracker: {
        __observation: {
          status: "current",
          period: "April 2026",
          observedAt: "2026-04-30T00:00:00.000Z",
        },
      },
    };

    expect(validateSnapshot(snapshot, 1)).toEqual(["gdpTracker"]);
    expect(() => validateSnapshot(snapshot, 2)).toThrow("2 required");
  });

  it("rejects snapshots from an obsolete registry", () => {
    expect(() =>
      validateSnapshot({ meta: { registryVersion: "v10", sources: {} } }, 1)
    ).toThrow("repository feed registry");
  });

  it("reuses only a still-current section from the same registry", () => {
    const now = Date.parse("2026-07-15T12:00:00Z");
    const seed = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: {
          bettingOdds: {
            status: "ok",
            cacheState: "fresh",
            fetchedAt: "2026-07-15T10:00:00Z",
          },
        },
      },
      bettingOdds: {
        expiresAt: "2026-07-15T14:00:00Z",
        __observation: { status: "current" },
      },
    };

    expect(isUsableSeedSection(seed, "bettingOdds", now)).toBe(true);
    expect(
      isUsableSeedSection(
        {
          ...seed,
          bettingOdds: {
            ...seed.bettingOdds,
            expiresAt: "2026-07-15T11:59:59Z",
          },
        },
        "bettingOdds",
        now
      )
    ).toBe(false);
    expect(
      isUsableSeedSection(
        {
          ...seed,
          meta: { ...seed.meta, registryVersion: "v10" },
        },
        "bettingOdds",
        now
      )
    ).toBe(false);
  });

  it("does not reuse a pre-history migration snapshot after a refresh miss", () => {
    const currentHistory = [
      { period: "YE December 2024", netMigration: 331_000 },
      { period: "YE December 2025", netMigration: 171_000 },
    ];
    expect(
      hasRequiredHistoryShape("migrationStats", {
        comparison: currentHistory,
      })
    ).toBe(false);
    expect(
      hasRequiredHistoryShape("migrationStats", {
        history: currentHistory,
        annualDelta: {
          immigration: -199_000,
          emigration: -38_000,
          netMigration: -160_000,
        },
      })
    ).toBe(true);

    const now = Date.parse("2026-07-16T12:00:00Z");
    expect(
      isUsableSeedSection(
        {
          meta: {
            registryVersion: FEED_REGISTRY_VERSION,
            sources: {
              migrationStats: {
                status: "ok",
                cacheState: "fresh",
                fetchedAt: "2026-07-16T11:00:00Z",
              },
            },
          },
          migrationStats: {
            comparison: currentHistory,
            __observation: { status: "current" },
          },
        },
        "migrationStats",
        now
      )
    ).toBe(false);
  });

  it("requires every named publication-critical section", () => {
    const snapshot = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: {
          gdpTracker: { status: "ok", cacheState: "fresh" },
          bettingOdds: { status: "error", cacheState: "missing" },
        },
      },
      gdpTracker: {
        __observation: {
          status: "current",
          period: "April 2026",
          observedAt: "2026-04-30T00:00:00.000Z",
        },
      },
    };

    expect(validateSnapshot(snapshot, 1, ["gdpTracker"])).toEqual([
      "gdpTracker",
    ]);
    expect(() =>
      validateSnapshot(snapshot, 1, ["gdpTracker", "taxRevenue"])
    ).toThrow("missing required sections: taxRevenue");
  });

  it("removes implementation details from published metadata", () => {
    expect(
      sanitizePublishedSnapshot({
        backend: "provider-specific-runtime",
        meta: { generator: "deployment-platform" },
        provenance: { retrieval: "legacy-worker-ingest" },
        data: [{ value: 42 }],
      })
    ).toEqual({
      meta: {},
      provenance: { retrieval: "scheduled-publication-check" },
      data: [{ value: 42 }],
    });
  });
});
