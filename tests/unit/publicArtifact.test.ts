import { describe, expect, it } from "vitest";
import {
  isPublicArtifact,
  validatePublicArtifact,
} from "@/contracts/public-artifact";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

function artifact() {
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      sources: {
        nationalDebt: {
          status: "ok",
          cacheState: "fresh",
          fetchedAt: "2026-10-07T05:00:00.000Z",
        },
      },
      publicProjection: {
        state: "published",
        publishedSections: ["nationalDebt"],
      },
    },
    nationalDebt: {
      debtToGdp: 93.8,
    },
  };
}

describe("canonical public artifact contract", () => {
  it("accepts a non-empty projection whose source manifest and payload agree", () => {
    expect(validatePublicArtifact(artifact(), {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toEqual({ publishedSections: ["nationalDebt"] });
    expect(isPublicArtifact(artifact(), {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toBe(true);
  });

  it("rejects mismatched projection manifests", () => {
    const value = artifact();
    value.meta.publicProjection.publishedSections = ["gdpTracker"];

    expect(() => validatePublicArtifact(value, {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toThrow(/does not match its source manifest/i);
  });

  it("rejects private pipeline state and source errors", () => {
    const privateMeta = artifact();
    privateMeta.meta.publicationState = "degraded";
    expect(isPublicArtifact(privateMeta, {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toBe(false);

    const privateSource = artifact();
    privateSource.meta.sources.nationalDebt.error = "private upstream detail";
    expect(isPublicArtifact(privateSource, {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toBe(false);
  });

  it("rejects projected sections without a matching public payload", () => {
    const value = artifact();
    delete value.nationalDebt;

    expect(() => validatePublicArtifact(value, {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toThrow(/missing a published section/i);
  });

  it("rejects empty and wrong-registry artifacts", () => {
    const empty = artifact();
    empty.meta.sources = {};
    empty.meta.publicProjection.publishedSections = [];
    expect(isPublicArtifact(empty, {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toBe(false);

    const wrongRegistry = artifact();
    wrongRegistry.meta.registryVersion = "legacy";
    expect(isPublicArtifact(wrongRegistry, {
      registryVersion: FEED_REGISTRY_VERSION,
    })).toBe(false);
  });
});
