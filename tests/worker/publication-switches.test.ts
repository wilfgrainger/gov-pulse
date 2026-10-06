// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "@/worker/public-data-entry";
import offlineSeed from "@/worker/offline-pages-entry";
import { PUBLICATION_CONFIG } from "@/contracts/publication-policy";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

const contractsStateByDefault = PUBLICATION_CONFIG.publications.governmentContracts.state;

beforeEach(() => { PUBLICATION_CONFIG.publications.governmentContracts.state = "held"; });
afterEach(() => {
  PUBLICATION_CONFIG.publications.governmentContracts.state = contractsStateByDefault;
  vi.unstubAllGlobals();
});

describe("disabled public deliveries", () => {
  it("restores GDP alone while keeping other stored data and catalog values private", async () => {
    const now = new Date().toISOString();
    const snapshot = { gdpTracker: { value: 0.5 }, taxRevenue: { value: 998877 }, meta: { registryVersion: FEED_REGISTRY_VERSION, generatedAt: now,
      sources: { gdpTracker: { status: "ok", cacheState: "fresh", fetchedAt: now }, taxRevenue: { status: "ok", cacheState: "fresh", fetchedAt: now } },
      measureCatalog: { measures: { growth: { sourceId: "gdpTracker", value: 0.5 }, receipts: { sourceId: "taxRevenue", value: 998877 } } },
    } };
    PUBLICATION_CONFIG.publications.gdpTracker.state = "published";
    try {
      const getWithMetadata = vi.fn(async () => ({ value: JSON.stringify(snapshot), metadata: { registryVersion: FEED_REGISTRY_VERSION, generatedAt: now, validUntil: new Date(Date.now() + 3600000).toISOString() } }));
      const response = await worker.fetch(new Request("https://public-data.org/data/metrics-snapshot.json"), { METRICS_CACHE: { getWithMetadata } });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.gdpTracker).toEqual({ value: 0.5 });
      expect(body.taxRevenue).toBeUndefined();
      expect(Object.keys(body.meta.sources)).toEqual(["gdpTracker"]);
      expect(JSON.stringify(body)).not.toContain("998877");
    } finally { PUBLICATION_CONFIG.publications.gdpTracker.state = "held"; }
  });

  it("closes old fallback assets and data paths without serving the former static seed", async () => {
    const response = offlineSeed.fetch(new Request("https://public-data-org.pages.dev/data/sections/gdpTracker.json"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "publication_disabled" });
    const page = offlineSeed.fetch(new Request("https://public-data-org.pages.dev/section/gdp/"));
    expect(await page.text()).toContain("Data publications are temporarily offline");
  });
  it.each([
    "/data/international-comparison.json",
    "/data/contracts/history.json?ocid=ocds-h6vhtk-123abc",
  ])("blocks %s before reading storage or an upstream", async (path) => {
    const get = vi.fn(async () => null);
    const getWithMetadata = vi.fn(async () => ({ value: null, metadata: null }));
    const upstream = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request(`https://public-data.org${path}`), { METRICS_CACHE: { get, getWithMetadata } });
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ code: "publication_disabled" });
    expect(get).not.toHaveBeenCalled();
    expect(getWithMetadata).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
  });

  it("opens the edition archive read API while keeping disabled sources private", async () => {
    const get = vi.fn(async () => null);
    const getWithMetadata = vi.fn(async () => ({ value: null, metadata: null }));
    const list = await worker.fetch(new Request("https://public-data.org/data/editions.json"), { METRICS_CACHE: { get, getWithMetadata } });
    expect(list.status).not.toBe(503);
    expect(await list.json()).not.toMatchObject({ code: "publication_disabled" });
    const detail = await worker.fetch(new Request("https://public-data.org/data/edition.json?edition=example"), { METRICS_CACHE: { get, getWithMetadata } });
    expect(detail.status).not.toBe(503);
    expect(await detail.json()).not.toMatchObject({ code: "publication_disabled" });
  });

  it("serves the metrics snapshot only for the published nationalDebt publication", async () => {
    const now = new Date().toISOString();
    const snapshot = {
      nationalDebt: { debtToGdp: 93.8, observationPeriod: "2026 AUG" },
      taxRevenue: { value: 998877 },
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        generatedAt: now,
        sources: {
          nationalDebt: { status: "ok", cacheState: "fresh", fetchedAt: now },
          taxRevenue: { status: "ok", cacheState: "fresh", fetchedAt: now },
        },
      },
    };
    const getWithMetadata = vi.fn(async () => ({
      value: JSON.stringify(snapshot),
      metadata: {
        registryVersion: FEED_REGISTRY_VERSION,
        generatedAt: now,
        validUntil: new Date(Date.now() + 3600000).toISOString(),
      },
    }));
    const response = await worker.fetch(
      new Request("https://public-data.org/data/metrics-snapshot.json"),
      { METRICS_CACHE: { getWithMetadata } }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nationalDebt).toEqual({ debtToGdp: 93.8, observationPeriod: "2026 AUG" });
    expect(body.taxRevenue).toBeUndefined();
    expect(Object.keys(body.meta.sources)).toEqual(["nationalDebt"]);
    expect(JSON.stringify(body)).not.toContain("998877");
  });

  it("leaves health off the deliberate pause once any publication is published", async () => {
    const response = await worker.fetch(new Request("https://public-data.org/data/health.json"), {});
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "unhealthy", ready: false });
  });
});
