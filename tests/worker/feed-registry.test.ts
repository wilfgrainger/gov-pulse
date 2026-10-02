import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AUTOMATED_METRIC_KEYS } from "@/app/lib/metricFallbacks";
import {
  FEED_REGISTRY,
  FEED_REGISTRY_VERSION,
  OPTIONAL_PUBLISHED_SECTION_IDS,
  REQUIRED_PUBLISHED_SECTION_IDS,
  applyFeedRegistry,
  provenanceFor,
  registrySnapshot,
} from "@/worker/feed-registry";

describe("feed registry", () => {
  it("covers every automated Worker section exactly once", () => {
    expect(Object.keys(FEED_REGISTRY).sort()).toEqual(
      [...AUTOMATED_METRIC_KEYS].sort()
    );
  });

  it("provides direct HTTPS provenance for every feed", () => {
    for (const [section, feed] of Object.entries(FEED_REGISTRY)) {
      expect(feed.section).toBe(section);
      expect(feed.title).not.toBe("");
      expect(feed.geography).not.toBe("");
      expect(feed.upstreams.length).toBeGreaterThan(0);

      for (const upstream of feed.upstreams) {
        expect(upstream.publisher).not.toBe("");
        expect(upstream.label).not.toBe("");
        expect(upstream.url).toMatch(/^https:\/\//);
        expect(upstream.sourceClass).not.toBe("");
      }
    }
  });

  it("matches public cadence labels to the configured Cloudflare schedules", () => {
    const wrangler = readFileSync(
      resolve(process.cwd(), "worker/wrangler.toml"),
      "utf8"
    );
    expect(wrangler).toContain('crons = ["17 3 * * *", "47 */3 * * *"]');

    const dailySections = [
      "sentimentPulse",
      "gdpTracker",
      "employmentStats",
      "nationalDebt",
      "taxRevenue",
      "migrationStats",
      "electionPolling",
      "nhsStats",
      "crimeStatistics",
    ] as const;
    for (const section of dailySections) {
      expect(FEED_REGISTRY[section].refreshCadence).toBe("daily");
    }
    expect(FEED_REGISTRY.bettingOdds.refreshCadence).toBe("every 3 hours");
  });

  it("publishes only the evidence registry", () => {
    const snapshot = registrySnapshot();
    expect(FEED_REGISTRY_VERSION).toBe("2026-08-02.1");
    expect(snapshot.version).toBe(FEED_REGISTRY_VERSION);
    expect(snapshot).toEqual({
      version: FEED_REGISTRY_VERSION,
      feeds: FEED_REGISTRY,
    });
  });

  it("creates stable machine-readable provenance", () => {
    const provenance = provenanceFor("nationalDebt");
    expect(provenance).toMatchObject({
      registryVersion: FEED_REGISTRY_VERSION,
      section: "nationalDebt",
      evidenceClass: "official-data",
      geography: "United Kingdom",
      retrieval: "scheduled-publication-check",
    });
    expect(provenance?.upstreams.map((source) => source.seriesId)).toEqual([
      "HF6W",
      "HF6X",
    ]);
  });

  it("keeps volatile market evidence outside the critical publication gate", () => {
    expect(OPTIONAL_PUBLISHED_SECTION_IDS.slice().sort()).toEqual(
      ["bettingOdds", "crimeStatistics", "nhsStats"].sort()
    );
    expect(REQUIRED_PUBLISHED_SECTION_IDS).toHaveLength(9);
    expect(REQUIRED_PUBLISHED_SECTION_IDS).not.toContain("bettingOdds");
    expect(REQUIRED_PUBLISHED_SECTION_IDS).not.toContain("crimeStatistics");
    expect(REQUIRED_PUBLISHED_SECTION_IDS).not.toContain("nhsStats");
    expect(provenanceFor("bettingOdds")?.publicationRequirement).toBe(
      "optional"
    );
    expect(provenanceFor("crimeStatistics")?.publicationRequirement).toBe(
      "optional"
    );
    expect(provenanceFor("nhsStats")?.publicationRequirement).toBe(
      "optional"
    );
    expect(provenanceFor("nationalDebt")?.publicationRequirement).toBe(
      "required"
    );
  });

  it("rejects descriptor drift instead of silently omitting a feed", () => {
    expect(() => applyFeedRegistry({ nationalDebt: {} })).toThrow(/Feed registry mismatch/);
  });
});
