// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  FREE_TIER_BUDGET,
  RUN_PREFIX,
  createRun,
  finaliseRun,
} from "@/worker/queued-publication-entry";
import { PUBLICATION_CURRENT_KEY } from "@/worker/publication-entry";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "@/worker/feed-registry";

function kvEnv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    env: {
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
    },
  };
}

function currentSnapshot() {
  const fetchedAt = "2026-07-17T10:00:00.000Z";
  const sources = Object.fromEntries(
    REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
      section,
      { status: "ok", cacheState: "fresh", fetchedAt },
    ])
  );

  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: "2026-07-17T12:00:00.000Z",
      fetchedAt: "2026-07-17T12:00:00.000Z",
      publicationMode: "queue-free-tier",
      freeTierBudget: FREE_TIER_BUDGET,
      sources,
    },
    ...Object.fromEntries(
      REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [section, { value: section }])
    ),
  };
}

describe("partial publication finalisation", () => {
  it("advances fresh successful evidence after the retry deadline without pretending the run succeeded", async () => {
    const startedAt = new Date("2026-07-18T03:17:00.000Z");
    const current = currentSnapshot();
    current.meta.sources.nhsStats.fetchedAt = "2026-04-01T00:00:00.000Z";

    const freshGdp = {
      headline: { monthlyGrowth: 0.2, period: "June 2026" },
    };
    const gdpFragment = {
      section: "gdpTracker",
      data: freshGdp,
      source: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: "2026-07-18T03:20:00.000Z",
        source: "ONS GDP monthly estimate",
      },
      fetchedAt: "2026-07-18T03:20:00.000Z",
    };

    const { env, store } = kvEnv({
      [PUBLICATION_CURRENT_KEY]: current,
      "v12:publication:section:gdpTracker": gdpFragment,
    });
    const { run } = await createRun(env, startedAt);

    for (const jobId of run.expectedJobIds) {
      store.set(`${RUN_PREFIX}${run.runId}:terminal:${jobId}`, {
        runId: run.runId,
        jobId,
        status: jobId === "external:nhsStats" ? "failure" : "success",
      });
    }

    const result = await finaliseRun(run.runId, env, {
      now: new Date("2026-07-18T03:43:00.000Z"),
    });

    expect(result.run.status).toBe("incomplete");
    expect(result.run.failedJobIds).toEqual(["external:nhsStats"]);
    expect(result.publicationResult?.status.status).toBe("degraded");
    expect(result.publicationResult?.publication.gdpTracker).toEqual(freshGdp);
    expect(result.publicationResult?.publication).not.toHaveProperty("nhsStats");
    expect(result.publicationResult?.publication.meta.missingRequiredSections).toContain(
      "nhsStats"
    );
    expect(store.get(PUBLICATION_CURRENT_KEY)).toEqual(
      result.publicationResult?.publication
    );
  });
});
