// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import publicWorker, { isCompleteSnapshot } from "@/worker/public-data-entry";
import { publishFromCaches } from "@/worker/queued-publication-entry";
import { mergePublication, PUBLICATION_CURRENT_KEY } from "@/worker/publication-entry";
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
  const missing = "employmentStats";
  const included = REQUIRED_PUBLISHED_SECTION_IDS.filter((section) => section !== missing);
  const sections = Object.fromEntries(included.map((section) => [
    section,
    section === "sentimentPulse"
      ? {
          value: section,
          series: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
            id,
            { id, status: "current", value: 1 },
          ])),
          __measureValidity: Object.fromEntries(["inflation", "bankRate", "unemployment"].map((id) => [
            id,
            { validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() },
          ])),
        }
      : { value: section },
  ]));
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
    ...sections,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("degraded public publication", () => {
  it("keeps measure-catalog exclusions private while retaining their reason for operators", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const publication = mergePublication(degradedSnapshot(now), [], null, now);
    const reason = publication.meta.measureCatalogDiagnostics.find(
      (item: { measureId: string }) => item.measureId === "unemployment",
    );

    expect(reason).toMatchObject({
      measureId: "unemployment",
      reason: "source-section-missing",
      category: "source-missing",
      availability: "unavailable",
    });
    const artifact = buildPublicSnapshotArtifact(publication, now);
    expect(JSON.parse(artifact.body).meta).not.toHaveProperty("measureCatalogDiagnostics");
  });

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
        get: vi.fn(async (key: string) =>
          key === PUBLICATION_CURRENT_KEY ? snapshot : null
        ),
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
    const publicData = await data.json();
    expect(publicData.meta).not.toHaveProperty("publicationState");
    expect(publicData.meta).not.toHaveProperty("missingRequiredSections");
    expect(publicData.meta.publicProjection).toMatchObject({
      state: "published",
    });
    expect(publicData.meta.publicProjection.publishedSections).not.toContain("employmentStats");

    const health = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      env
    );

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      status: "degraded",
      ready: false,
      degraded: true,
      missingRequiredSections: ["employmentStats"],
    });
  });

  it("redacts diagnostics from a legacy prepared artifact before serving it", async () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const legacy = degradedSnapshot(now);
    legacy.meta.publicationDiagnostics = {
      nhsStats: {
        section: "nhsStats",
        code: "upstream_fetch_failure",
        summary: "The official source could not be collected.",
        status: "error",
        cacheState: "missing",
        fetchedAt: null,
      },
    };
    legacy.meta.sources.gdpTracker.error = "private source response detail";
    const env = {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) =>
          key === PUBLICATION_CURRENT_KEY ? legacy : null
        ),
        getWithMetadata: vi.fn(async (key: string) =>
          key === PUBLIC_SNAPSHOT_KEY
            ? {
                value: JSON.stringify(legacy),
                metadata: {
                  registryVersion: FEED_REGISTRY_VERSION,
                  validUntil: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                  generatedAt: now.toISOString(),
                },
              }
            : { value: null, metadata: null }
        ),
      },
    };

    const response = await publicWorker.fetch(
      new Request("https://public-data.org/data/metrics-snapshot.json"),
      env,
    );
    const snapshot = await response.json();

    expect(response.status).toBe(200);
    expect(snapshot.meta).not.toHaveProperty("publicationDiagnostics");
    expect(snapshot.meta.sources.gdpTracker).not.toHaveProperty("error");
  });
  it("publishes fresh successful fragments even when another required feed has expired", async () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const current = degradedSnapshot(now);
    current.meta.sources.migrationStats = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt: "2026-04-01T00:00:00.000Z",
    };
    current.migrationStats = { value: "expired-migration" };

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
    const put = vi.fn(async (key: string, value: string) => {
      try {
        store.set(key, JSON.parse(value));
      } catch {
        store.set(key, value);
      }
    });
    const env = {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put,
      },
    };

    const result = await publishFromCaches(env, { now });
    const published = store.get(PUBLICATION_CURRENT_KEY) as {
      gdpTracker?: unknown;
      migrationStats?: unknown;
      meta: {
        sources: Record<string, unknown>;
        publicationState?: string;
        missingRequiredSections?: string[];
      };
    };

    expect(result.status.status).toBe("degraded");
    expect(result.changed).toBe(true);
    expect(published.gdpTracker).toEqual(gdpFragment.data);
    expect(published).not.toHaveProperty("migrationStats");
    expect(published.meta.sources).not.toHaveProperty("migrationStats");
    expect(published.meta.publicationState).toBe("degraded");
    expect(published.meta.missingRequiredSections).toContain("migrationStats");
    expect(put).toHaveBeenCalledWith(
      PUBLIC_SNAPSHOT_KEY,
      expect.any(String),
      expect.objectContaining({ metadata: expect.any(Object) })
    );
  });
});

// Exercise the published-publication behavior independently of the production pause.
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { state: string }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, state: "published" }])), ons: { state: "published" } } } };
});
