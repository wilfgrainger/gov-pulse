// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import publicWorker, { isCompleteSnapshot } from "@/worker/public-data-entry";
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
});
