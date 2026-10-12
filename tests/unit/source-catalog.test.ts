import { describe, expect, it } from "vitest";
import { DATA_SOURCES } from "@/app/lib/config";
import { DATA_SOURCE_DETAILS } from "@/app/lib/dataSourceDetails";
import {
  FEED_CATALOG,
  SOURCE_CATALOG,
  SOURCE_CATALOG_VERSION,
  feedFor,
  sourceFor,
  sourceLinksForFeed,
  sourcesForFeed,
} from "@/contracts/source-catalog.js";
import {
  FEED_REGISTRY,
  PUBLICATION_SOURCE_REGISTRY,
} from "@/worker/feed-registry";

describe("canonical source catalog", () => {
  it("owns every upstream identity once and only exposes HTTPS primary URLs", () => {
    expect(SOURCE_CATALOG_VERSION).toBe("2026-10-06.1");
    expect(Object.keys(SOURCE_CATALOG).length).toBeGreaterThan(25);

    for (const [id, source] of Object.entries(SOURCE_CATALOG)) {
      expect(source.id).toBe(id);
      expect(source.publisher.trim()).not.toBe("");
      expect(source.primaryUrls.length).toBeGreaterThan(0);
      expect(source.primaryUrls.every((url) => url.startsWith("https://"))).toBe(true);
      expect(sourceFor(id)).toBe(source);
    }
  });

  it("requires every feed source reference to resolve through the source catalog", () => {
    for (const [id, feed] of Object.entries(FEED_CATALOG)) {
      expect(feed.id).toBe(id);
      expect(feedFor(id)).toBe(feed);
      expect(sourcesForFeed(id).map((source) => source.id)).toEqual(feed.sourceIds);
      for (const sourceId of feed.sourceIds) {
        expect(SOURCE_CATALOG[sourceId], `${id} -> ${sourceId}`).toBeDefined();
      }
    }
  });

  it("derives the existing Worker registries from canonical feed definitions", () => {
    const feedIds = Object.values(FEED_CATALOG)
      .filter((feed) => feed.registry === "feed")
      .map((feed) => feed.id)
      .sort();
    const publicationIds = Object.values(FEED_CATALOG)
      .filter((feed) => feed.registry === "publication")
      .map((feed) => feed.id)
      .sort();

    expect(Object.keys(FEED_REGISTRY).sort()).toEqual(feedIds);
    expect(Object.keys(PUBLICATION_SOURCE_REGISTRY).sort()).toEqual(publicationIds);

    expect(FEED_REGISTRY.nationalDebt.upstreams.map((source) => source.seriesId)).toEqual(["HF6W", "HF6X"]);
    expect(FEED_REGISTRY.nationalDebt.upstreams.map((source) => source.url)).toEqual(
      sourceLinksForFeed("nationalDebt").map((source) => source.url)
    );
  });

  it("derives app metadata and editorial detail from the same feed definitions", () => {
    const appIds = Object.values(FEED_CATALOG)
      .filter((feed) => Boolean(feed.editorial))
      .map((feed) => feed.id)
      .sort();

    expect(Object.keys(DATA_SOURCES).sort()).toEqual(appIds);
    expect(Object.keys(DATA_SOURCE_DETAILS).sort()).toEqual(appIds);

    expect(DATA_SOURCES.gdpTracker).toMatchObject({
      name: FEED_CATALOG.gdpTracker.displayName,
      frequency: FEED_CATALOG.gdpTracker.frequency,
      geographicCoverage: FEED_CATALOG.gdpTracker.geography.label,
    });
    expect(DATA_SOURCE_DETAILS.gdpTracker).toEqual(FEED_CATALOG.gdpTracker.editorial);
  });

  it("resolves reader source links from upstream identities rather than UI-owned URL maps", () => {
    expect(sourceLinksForFeed("electionPolling")).toEqual([
      {
        sourceId: "yougov-voting-intention",
        publisher: "YouGov",
        label: "YouGov Westminster voting-intention primary tables",
        url: "https://yougov.com/en-gb/articles",
      },
      {
        sourceId: "more-in-common-voting-intention",
        publisher: "More in Common",
        label: "More in Common voting-intention tracker archive",
        url: "https://www.moreincommon.org.uk/polling-tables/?_polling_tables_type=voting-intention",
      },
      {
        sourceId: "british-polling-council-rules",
        publisher: "British Polling Council",
        label: "British Polling Council disclosure rules",
        url: "https://www.britishpollingcouncil.org/objects-and-rules/",
      },
    ]);
  });
});
