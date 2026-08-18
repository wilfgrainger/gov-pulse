// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import publicWorker, { isCompleteSnapshot } from "@/worker/public-data-entry";
import { publishFromCaches } from "@/worker/queued-publication-entry";
import { PUBLICATION_CURRENT_KEY } from "@/worker/publication-entry";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "@/worker/feed-registry";
import {
  PUBLIC_SNAPSHOT_KEY,
  buildPublicSnapshotArtifact,
} from "@/worker/public-snapshot";

function degradedSnapshot(now = new Date("2026-08-07T12:00:00.000Z")) {
  const fetchedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const missing = "nhsStats";
  const included = REQUIRED_PUBLISHED_SECTION_IDS.filter((section) => section !== missing);
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: fetchedAt,
      fetchedAt,
      publicationState: "degraded",
      missingRequiredSections: [missing],
      sources: Object.fromEntries(
        included.map((section) => [
          section,
          { status: "ok", cacheState: "fresh", fetchedAt },
        ])
      ),
    },
    ...Object.fromEntries(included.map((section) => [section, { value: section }])),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("degraded public publication", () => {
  it("accepts an explicitly degraded snapshot only when the missing manifest matches", () => {
    const valid = degradedSnapshot();
    expect(isCompleteSnapshot(valid)).toBe(true);

    const dishonest = structuredClone(valid);
    dishonest.meta.missingRequiredSections = [];
    expect(isCompleteSnapshot(dishonest)).toBe(false);
  });

  it("serves degraded evidence but does not report deployment readiness", async () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const snapshot = degradedSnapshot(now);
    const artifact = buildPublicSnapshotArtifact(snapshot, now);
    const env = {
      METRICS_CACHE: {
        get: vi.fn(async () => null),
        getWithMetadata: vi.fn(async (key: string) =>
          key === PUBLIC_SNAPSHOT_KEY
            ? { value: artifact.body, metadata: artifact.metadata }
            : { value: null, metadata: null }
        ),
      },
    };

    // Degraded evidence is a valid reader response, but it must not satisfy
    // deployment/bootstrap readiness while a required publication is missing.
    const data = await publicWorker.fetch(
      new Request("https://public-data.org/data/metrics-snapshot.json"),
      env
    );
    expect(data.status).toBe(200);
    expect((await data.json()).meta.publicationState).toBe("degraded");

    const health = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      env
    );

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      status: "degraded",
      ready: false,
      degraded: true,
      missingRequiredSections: ["nhsStats"],
    });
  });

  it("publishes fresh successful fragments even when another required feed has expired", async () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const current = degradedSnapshot(now);
    current.meta.sources.nhsStats = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt: "2026-04-01T00:00:00.000Z",
    };
    current.nhsStats = { value: "expired-nhs" };

    const refreshedAt = "2026-08-07T11:30:00.000Z";
    const gdpFragment = {
      section: "gdpTracker",
      data: { value: "fresh-gdp" },
      source: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: refreshedAt,
      },
      fetchedAt: refreshedAt,
    };
    const store = new Map<string, unknown>([
      [PUBLICATION_CURRENT_KEY, current],
      ["v12:publication:section:gdpTracker", gdpFragment],
    ]);
    const env = {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          try {
            store.set(key, JSON.parse(value));
          } catch {
            store.set(key, value);
          }
        }),
      },
    };

    const result = await publishFromCaches(env, { now });
    const published = store.get(PUBLICATION_CURRENT_KEY) as Record<string, any>;

    expect(result.status.status).toBe("degraded");
    expect(result.changed).toBe(true);
    expect(published.gdpTracker).toEqual(gdpFragment.data);
    expect(published).not.toHaveProperty("nhsStats");
    expect(published.meta.sources).not.toHaveProperty("nhsStats");
    expect(published.meta.publicationState).toBe("degraded");
    expect(published.meta.missingRequiredSections).toContain("nhsStats");
    expect(store.get(PUBLIC_SNAPSHOT_KEY)).toEqual(expect.any(String));
  });
});
