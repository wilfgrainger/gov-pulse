// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  acceptedRecoveryArtifact,
  fetchPublicationSeedSnapshot,
} from "@/worker/publication-recovery";
import { fetchSeedSnapshot } from "@/worker/public-data-entry";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

const NOW = new Date("2026-10-07T07:30:00.000Z");

function acceptedArtifact(options: { fetchedAt?: string } = {}) {
  const fetchedAt = options.fetchedAt ?? "2026-10-07T07:00:00.000Z";
  return {
    nationalDebt: {
      value: 93.8,
    },
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: fetchedAt,
      sources: {
        nationalDebt: {
          status: "ok",
          cacheState: "fresh",
          fetchedAt,
        },
      },
      publicProjection: {
        state: "published",
        publishedSections: ["nationalDebt"],
      },
    },
  };
}

describe("publication recovery adapter", () => {
  it("accepts a current reader artifact without re-deriving evidence", () => {
    const artifact = acceptedArtifact();

    expect(acceptedRecoveryArtifact(artifact, NOW)).toEqual(artifact);
  });

  it("rejects an internal snapshot that has not crossed the public projection boundary", () => {
    const artifact = acceptedArtifact();
    delete (artifact.meta as Record<string, unknown>).publicProjection;

    expect(acceptedRecoveryArtifact(artifact, NOW)).toBeNull();
  });

  it("rejects private readiness or source-error state even when the section is otherwise current", () => {
    const artifact = acceptedArtifact() as ReturnType<typeof acceptedArtifact> & {
      meta: ReturnType<typeof acceptedArtifact>["meta"] & {
        publicationState?: string;
      };
    };
    artifact.meta.publicationState = "degraded";
    (artifact.meta.sources.nationalDebt as Record<string, unknown>).error =
      "private upstream diagnostic";

    expect(acceptedRecoveryArtifact(artifact, NOW)).toBeNull();
  });

  it("rejects a previously accepted artifact after its source-owned currentness window expires", () => {
    const artifact = acceptedArtifact({
      fetchedAt: "2026-07-01T07:00:00.000Z",
    });

    expect(acceptedRecoveryArtifact(artifact, NOW)).toBeNull();
  });

  it("uses the same recovery acceptance path for publication and request-time fallback", async () => {
    const artifact = acceptedArtifact();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(artifact), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const env = {
      STATIC_SNAPSHOT_SEED_URL:
        "https://public-data-org.pages.dev/data/metrics-snapshot.json",
    };

    expect(
      await fetchPublicationSeedSnapshot(env, fetchImpl, NOW),
    ).toEqual(artifact);
    expect(await fetchSeedSnapshot(env, fetchImpl, NOW)).toEqual(artifact);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
