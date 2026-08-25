import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fetchPublicSnapshot,
  prepareWebSnapshot,
  validatePublicSnapshotUrl,
} from "../../scripts/fetch-public-snapshot-for-web-build.mjs";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../../worker/feed-registry.js";

const NOW = new Date("2026-08-25T12:00:00.000Z");
const FETCHED_AT = "2026-08-25T03:00:00.000Z";

function snapshot() {
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      delivery: "published-snapshot",
      generatedAt: FETCHED_AT,
      publicationState: "ready",
      missingRequiredSections: [],
      sources: {
        gdpTracker: {
          status: "ok",
          cacheState: "fresh",
          fetchedAt: FETCHED_AT,
          provenance: {
            registryVersion: FEED_REGISTRY_VERSION,
            section: "gdpTracker",
          },
        },
        migrationStats: {
          status: "ok",
          cacheState: "fresh",
          fetchedAt: FETCHED_AT,
          provenance: {
            registryVersion: FEED_REGISTRY_VERSION,
            section: "migrationStats",
          },
        },
      },
    },
    gdpTracker: {
      value: 0.3,
      __observation: {
        status: "current",
        period: "June 2026",
        observedAt: FETCHED_AT,
        maxAgeDays: 2,
      },
    },
    migrationStats: {
      value: 100,
      __observation: {
        status: "current",
        period: "2025",
        observedAt: "2026-08-23T03:00:00.000Z",
        maxAgeDays: 3,
      },
    },
  };
}

describe("web build publication snapshot", () => {
  it("keeps current source-owned sections and recalculates degraded state", () => {
    const value = snapshot();
    value.meta.sources.migrationStats.fetchedAt = "2026-08-20T03:00:00.000Z";

    const prepared = prepareWebSnapshot(value, NOW);

    expect(prepared).toHaveProperty("gdpTracker");
    expect(prepared).not.toHaveProperty("migrationStats");
    expect(prepared.meta.publicationState).toBe("degraded");
    expect(prepared.meta.missingRequiredSections).toEqual(
      expect.arrayContaining(REQUIRED_PUBLISHED_SECTION_IDS.filter((id) => id !== "gdpTracker")),
    );
  });

  it("rejects an unverified or off-contract publication URL", () => {
    expect(() => prepareWebSnapshot({ meta: {} }, NOW)).toThrow(/verified public publication/i);
    expect(() => validatePublicSnapshotUrl("http://public-data.org/data/metrics-snapshot.json"))
      .toThrow(/must be https/i);
    expect(() => validatePublicSnapshotUrl("https://attacker.example/data/metrics-snapshot.json"))
      .toThrow(/must be https/i);
  });

  it("fetches a bounded public snapshot and writes the exact current publication used by the web build", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gov-pulse-web-snapshot-"));
    const output = join(directory, "metrics-snapshot.json");
    try {
      const result = await fetchPublicSnapshot({
        output,
        now: NOW,
        fetchImpl: async () =>
          new Response(JSON.stringify(snapshot()), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      });

      expect(result.publicationState).toBe("degraded");
      expect(result.sections).toEqual(["gdpTracker", "migrationStats"]);
      expect(JSON.parse(await readFile(output, "utf8"))).toMatchObject({
        meta: { delivery: "published-snapshot", publicationState: "degraded" },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
