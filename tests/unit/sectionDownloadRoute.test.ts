import { describe, expect, it, vi } from "vitest";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

const { readServerMetricsSnapshot } = vi.hoisted(() => ({ readServerMetricsSnapshot: vi.fn() }));
vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot }));

import { GET } from "@/app/data/sections/[file]/route";

const now = new Date();
const observedAt = new Date(now.getTime() - 86400000).toISOString();
const snapshot = {
  meta: {
    registryVersion: FEED_REGISTRY_VERSION,
    generatedAt: now.toISOString(),
    sources: {
      gdpTracker: { status: "ok", cacheState: "fresh", fetchedAt: now.toISOString(), provenance: { section: "gdpTracker" } },
      nhsStats: { status: "stale", cacheState: "stale", fetchedAt: now.toISOString(), provenance: { section: "nhsStats" } },
    },
  },
  gdpTracker: {
    headline: { period: "August 2026", releaseDate: observedAt, monthlyGrowth: 0.2 },
    __observation: { status: "current", observedAt, maxAgeDays: 70 },
  },
  nhsStats: { headline: { waitingPathwaysEstimate: 7340000 } },
};

const request = (file: string) => GET(new Request(`https://public-data.org/data/sections/${file}`), { params: Promise.resolve({ file }) });

describe("same-origin section downloads", () => {
  it("serves JSON and CSV from the filtered snapshot", async () => {
    readServerMetricsSnapshot.mockResolvedValue(snapshot);
    const json = await request("gdpTracker.json");
    expect(json.status).toBe(200);
    expect(json.headers.get("content-type")).toContain("application/json");
    expect(await json.json()).toMatchObject({ section: "gdpTracker", source: snapshot.meta.sources.gdpTracker });
    const csv = await request("gdpTracker.csv");
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(await csv.text()).toContain("$.data.headline.monthlyGrowth,0.2");
  });

  it("does not serve stale or missing sections", async () => {
    readServerMetricsSnapshot.mockResolvedValue(snapshot);
    expect((await request("nhsStats.json")).status).toBe(503);
    readServerMetricsSnapshot.mockResolvedValue(null);
    expect((await request("gdpTracker.csv")).status).toBe(503);
  });

  it("rejects unknown names and extensions without reading a snapshot", async () => {
    readServerMetricsSnapshot.mockClear();
    expect((await request("__proto__.json")).status).toBe(404);
    expect((await request("gdpTracker.xml")).status).toBe(404);
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
  });
});

// Exercise the enabled-publication behavior independently of the production pause.
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { enabled: boolean }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, enabled: true }])), ons: { enabled: true } } } };
});
