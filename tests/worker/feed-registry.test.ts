import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decorateJsonResponse } from "@/worker/entry";
import { sectionDescriptors } from "@/worker/index";
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
    expect(Object.keys(FEED_REGISTRY).sort()).toEqual(Object.keys(sectionDescriptors).sort());
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
      ["bettingOdds", "crimeStatistics"].sort()
    );
    expect(REQUIRED_PUBLISHED_SECTION_IDS).toHaveLength(8);
    expect(REQUIRED_PUBLISHED_SECTION_IDS).not.toContain("bettingOdds");
    expect(REQUIRED_PUBLISHED_SECTION_IDS).not.toContain("crimeStatistics");
    expect(provenanceFor("bettingOdds")?.publicationRequirement).toBe(
      "optional"
    );
    expect(provenanceFor("crimeStatistics")?.publicationRequirement).toBe(
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

describe("registry response decoration", () => {
  it("returns malformed JSON untouched and still readable", async () => {
    const original = new Response("{", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const result = await decorateJsonResponse(
      new Request("https://worker.example/health"),
      original
    );

    expect(result).toBe(original);
    expect(await result.text()).toBe("{");
  });

  it("removes stale transport headers after rewriting a body", async () => {
    const original = new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "15",
        "Content-Encoding": "gzip",
      },
    });

    const result = await decorateJsonResponse(
      new Request("https://worker.example/health"),
      original
    );
    const payload = await result.json();

    expect(payload.registryVersion).toBe(FEED_REGISTRY_VERSION);
    expect(payload.feedCount).toBe(Object.keys(FEED_REGISTRY).length);
    expect(result.headers.has("Content-Length")).toBe(false);
    expect(result.headers.has("Content-Encoding")).toBe(false);
  });

  it("does not attempt to decorate non-object JSON", async () => {
    const original = new Response(JSON.stringify(["ok"]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const result = await decorateJsonResponse(
      new Request("https://worker.example/health"),
      original
    );

    expect(result).toBe(original);
    expect(await result.json()).toEqual(["ok"]);
  });
});