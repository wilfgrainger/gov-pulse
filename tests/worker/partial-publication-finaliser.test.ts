// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
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
  const metadata = new Map<string, Record<string, unknown>>();
  const decode = (value: unknown, type?: "json" | "text") => {
    if (value === undefined || value === null) return null;
    if (type === "text") return typeof value === "string" ? value : JSON.stringify(value);
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  };
  return {
    store,
    env: {
      METRICS_CACHE: {
        get: vi.fn(async (key: string, type?: "json" | "text") => decode(store.get(key), type)),
        getWithMetadata: vi.fn(async (key: string, type?: "json" | "text") => ({
          value: decode(store.get(key), type),
          metadata: metadata.get(key) ?? null,
        })),
        put: vi.fn(async (key: string, value: string, options?: { metadata?: Record<string, unknown> }) => {
          store.set(key, value);
          if (options?.metadata) metadata.set(key, options.metadata);
        }),
        delete: vi.fn(async (key: string) => { store.delete(key); metadata.delete(key); }),
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
    current.meta.sources.electionPolling.fetchedAt = "2026-04-01T00:00:00.000Z";

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
        status: jobId === "external:electionPolling" ? "failure" : "success",
      });
    }

    const result = await finaliseRun(run.runId, env, {
      now: new Date("2026-07-18T03:43:00.000Z"),
    });

    expect(result.run.status).toBe("incomplete");
    expect(result.run.failedJobIds).toEqual(["external:electionPolling"]);
    expect(result.publicationResult?.status.status).toBe("degraded");
    expect(result.publicationResult?.publication.gdpTracker).toEqual(freshGdp);
    expect(result.publicationResult?.publication).not.toHaveProperty("electionPolling");
    expect(result.publicationResult?.publication.meta.missingRequiredSections).toContain(
      "electionPolling"
    );
    expect(await env.METRICS_CACHE.get(PUBLICATION_CURRENT_KEY, "json")).toEqual(
      result.publicationResult?.publication
    );
  });

  it("keeps still-valid last-known-good evidence when its refresh job fails", async () => {
    const startedAt = new Date("2026-07-18T03:17:00.000Z");
    const current = currentSnapshot();
    current.electionPolling = {
      value: "electionPolling",
      expiresAt: "2026-08-23T00:00:00.000Z",
    };
    current.meta.sources.electionPolling.fetchedAt = "2026-07-15T00:00:00.000Z";

    const { env, store } = kvEnv({ [PUBLICATION_CURRENT_KEY]: current });
    const { run } = await createRun(env, startedAt);

    for (const jobId of run.expectedJobIds) {
      store.set(`${RUN_PREFIX}${run.runId}:terminal:${jobId}`, {
        runId: run.runId,
        jobId,
        status: jobId === "external:electionPolling" ? "failure" : "success",
      });
    }

    const result = await finaliseRun(run.runId, env, {
      now: new Date("2026-07-18T03:43:00.000Z"),
    });

    expect(result.run.status).toBe("incomplete");
    expect(result.run.failedJobIds).toEqual(["external:electionPolling"]);
    expect(result.publicationResult?.publication.electionPolling).toEqual(current.electionPolling);
    expect(
      result.publicationResult?.publication.meta.missingRequiredSections
    ).not.toContain("electionPolling");
    expect(await env.METRICS_CACHE.get(PUBLICATION_CURRENT_KEY, "json")).toEqual(
      result.publicationResult?.publication
    );
  });

  it("isolates run-scoped fragments so concurrent or separate runs do not cross-contaminate", async () => {
    const startedAt = new Date("2026-07-18T03:17:00.000Z");
    const current = currentSnapshot();

    const run1Gdp = { headline: { monthlyGrowth: 0.8, period: "June 2026" } };
    const run2Gdp = { headline: { monthlyGrowth: 0.1, period: "June 2026" } };

    const { env, store } = kvEnv({
      [PUBLICATION_CURRENT_KEY]: current,
    });
    const { run: run1 } = await createRun(env, startedAt);
    const { run: run2 } = await createRun(env, new Date("2026-07-18T03:18:00.000Z"));

    store.set(`${RUN_PREFIX}${run1.runId}:section:gdpTracker`, {
      section: "gdpTracker",
      data: run1Gdp,
      source: { status: "ok", cacheState: "fresh", fetchedAt: "2026-07-18T03:20:00.000Z" },
      fetchedAt: "2026-07-18T03:20:00.000Z",
    });
    store.set(`${RUN_PREFIX}${run2.runId}:section:gdpTracker`, {
      section: "gdpTracker",
      data: run2Gdp,
      source: { status: "ok", cacheState: "fresh", fetchedAt: "2026-07-18T03:21:00.000Z" },
      fetchedAt: "2026-07-18T03:21:00.000Z",
    });

    for (const jobId of run1.expectedJobIds) {
      store.set(`${RUN_PREFIX}${run1.runId}:terminal:${jobId}`, {
        runId: run1.runId,
        jobId,
        status: "success",
      });
    }

    const result1 = await finaliseRun(run1.runId, env, {
      now: new Date("2026-07-18T03:43:00.000Z"),
    });

    expect(result1.publicationResult?.publication.gdpTracker).toEqual(run1Gdp);
    expect(result1.publicationResult?.publication.gdpTracker).not.toEqual(run2Gdp);
  });
});
