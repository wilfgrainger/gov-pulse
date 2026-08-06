// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import publicWorker, {
  currentPublicSnapshot,
  isCompleteSnapshot,
  preparedMetadataIsCurrent,
} from "@/worker/public-data-entry";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "@/worker/feed-registry";
import { PUBLICATION_CURRENT_KEY } from "@/worker/publication-entry";
import {
  PUBLIC_SNAPSHOT_KEY,
  buildPublicSnapshotArtifact,
} from "@/worker/public-snapshot";

interface PublicSnapshotPayload {
  meta: {
    registryVersion: string;
    sources: Record<
      string,
      {
        backend?: unknown;
        provenance: { retrieval: string };
      }
    >;
    backend?: unknown;
    generator?: unknown;
    publicationMode?: unknown;
    freeTierBudget?: unknown;
  };
}

function snapshot(now = new Date()) {
  const fetchedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const sources = Object.fromEntries(
    REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
      section,
      {
        status: "ok",
        cacheState: "fresh",
        fetchedAt,
        backend: "cloudflare-worker",
        provenance: { retrieval: "cloudflare-worker-live" },
      },
    ])
  );

  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: fetchedAt,
      fetchedAt,
      backend: "cloudflare-worker-kv",
      generator: "cloudflare-free-publication-worker",
      publicationMode: "queue-free-tier",
      freeTierBudget: { queueOperationsPerDayMax: 84 },
      sources,
    },
    ...Object.fromEntries(
      REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
        section,
        { value: section },
      ])
    ),
  };
}

function environment(current: unknown = snapshot(), now = new Date()) {
  const values = new Map<string, unknown>([[PUBLICATION_CURRENT_KEY, current]]);
  const artifact = current ? buildPublicSnapshotArtifact(current, now) : null;
  return {
    METRICS_CACHE: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      getWithMetadata: vi.fn(async (key: string) =>
        key === PUBLIC_SNAPSHOT_KEY && artifact
          ? { value: artifact.body, metadata: artifact.metadata }
          : { value: null, metadata: null }
      ),
    },
  };
}

describe("Cloudflare public data route", () => {
  it("serves a precomputed sanitised snapshot from KV", async () => {
    const env = environment();
    const response = await publicWorker.fetch(
      new Request("https://public-data.org/data/metrics-snapshot.json"),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Publication-Delivery")).toBe(
      "cloudflare-kv"
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(env.METRICS_CACHE.get).not.toHaveBeenCalled();

    const payload = (await response.json()) as PublicSnapshotPayload;
    expect(payload.meta.registryVersion).toBe(FEED_REGISTRY_VERSION);
    expect(payload.meta).not.toHaveProperty("backend");
    expect(payload.meta).not.toHaveProperty("generator");
    expect(payload.meta).not.toHaveProperty("publicationMode");
    expect(payload.meta).not.toHaveProperty("freeTierBudget");
    expect(payload.meta.sources.sentimentPulse).not.toHaveProperty("backend");
    expect(
      payload.meta.sources.sentimentPulse.provenance.retrieval
    ).toBe("scheduled-publication-check");
  });

  it("supports HEAD and conditional cache validation", async () => {
    const env = environment();
    const first = await publicWorker.fetch(
      new Request("https://public-data.org/data/metrics-snapshot.json"),
      env
    );
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();
    expect(etag).toMatch(/^W\/\"sha256-[0-9a-f]{64}\"$/);

    const conditional = await publicWorker.fetch(
      new Request("https://public-data.org/data/metrics-snapshot.json", {
        headers: { "If-None-Match": etag! },
      }),
      env
    );
    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe("");

    const head = await publicWorker.fetch(
      new Request("https://public-data.org/data/metrics-snapshot.json", {
        method: "HEAD",
      }),
      env
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("reports ready or bootstrapping without blocking deployment", async () => {
    const ready = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      environment()
    );
    expect(await ready.json()).toEqual({ status: "ready", ready: true });

    const bootstrapping = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      environment(null)
    );
    expect(bootstrapping.status).toBe(200);
    expect(await bootstrapping.json()).toEqual({
      status: "bootstrapping",
      ready: false,
    });
  });

  it("keeps bootstrapping until prepared publication metadata is available", async () => {
    const env = environment();
    env.METRICS_CACHE.getWithMetadata.mockResolvedValue({
      value: null,
      metadata: null,
    });

    const response = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      env
    );

    expect(await response.json()).toEqual({
      status: "bootstrapping",
      ready: false,
    });
  });

  it("does not report an expired registry contract as ready", async () => {
    const now = new Date("2026-08-02T08:30:00.000Z");
    const currentArtifact = buildPublicSnapshotArtifact(snapshot(now), now);
    const previousRegistryMetadata = {
      ...currentArtifact.metadata,
      registryVersion: "2026-07-15.2",
    };

    expect(preparedMetadataIsCurrent(currentArtifact.metadata, now)).toBe(true);
    expect(preparedMetadataIsCurrent(previousRegistryMetadata, now)).toBe(false);

    const previousSnapshot = snapshot(now);
    previousSnapshot.meta.registryVersion = "2026-07-15.2";
    expect(isCompleteSnapshot(previousSnapshot)).toBe(false);

    const env = environment(snapshot(now), now);
    env.METRICS_CACHE.getWithMetadata.mockResolvedValue({
      value: currentArtifact.body,
      metadata: previousRegistryMetadata,
    });
    const health = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      env
    );
    expect(await health.json()).toEqual({
      status: "bootstrapping",
      ready: false,
    });
  });

  it("does not report a malformed prepared body as ready", async () => {
    const now = new Date("2026-08-02T08:30:00.000Z");
    const currentArtifact = buildPublicSnapshotArtifact(snapshot(now), now);
    const env = environment(null, now);
    env.METRICS_CACHE.getWithMetadata.mockResolvedValue({
      value: "not-json",
      metadata: currentArtifact.metadata,
    });

    const health = await publicWorker.fetch(
      new Request("https://public-data.org/data/health.json"),
      env
    );

    expect(await health.json()).toEqual({
      status: "bootstrapping",
      ready: false,
    });
  });

  it("uses the Pages snapshot only as a complete bootstrap fallback", async () => {
    const now = new Date();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(snapshot(now)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await currentPublicSnapshot(environment(null), {
      now,
      fetchImpl,
    });

    expect(result?.delivery).toBe("pages-fallback");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not expose collection, editorial or section-download paths", async () => {
    for (const path of [
      "/data/internal/metrics",
      "/data/sections/gdpTracker.json",
    ]) {
      const response = await publicWorker.fetch(
        new Request(`https://public-data.org${path}`),
        environment()
      );
      expect(response.status).toBe(404);
    }
  });
});
