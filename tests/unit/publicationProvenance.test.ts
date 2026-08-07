// RED contract for the public-safe edition provenance shown on the homepage.
import { describe, expect, it } from "vitest";
import { publicationProvenanceFromSnapshot } from "../../app/lib/publicationProvenance";
import { FEED_REGISTRY_VERSION } from "../../worker/feed-registry";

function snapshot(state: "ready" | "degraded", missingRequiredSections: string[] = []) {
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: "2026-08-07T12:00:00.000Z",
      publicationState: state,
      missingRequiredSections,
      sources: {},
    },
  };
}

describe("publication provenance", () => {
  it("surfaces ready state, registry version and a short application revision", () => {
    expect(
      publicationProvenanceFromSnapshot(
        snapshot("ready"),
        "1f9b21e4d441cdab2b62e17c2140b84b86e95a33"
      )
    ).toEqual({
      publicationState: "ready",
      registryVersion: FEED_REGISTRY_VERSION,
      missingRequiredCount: 0,
      appRevision: "1f9b21e",
    });
  });

  it("counts required evidence withheld from a degraded public edition", () => {
    expect(
      publicationProvenanceFromSnapshot(
        snapshot("degraded", ["nhsStats", "electionPolling"]),
        "abcdef1234567890"
      )
    ).toEqual({
      publicationState: "degraded",
      registryVersion: FEED_REGISTRY_VERSION,
      missingRequiredCount: 2,
      appRevision: "abcdef1",
    });
  });

  it("does not invent publication provenance for an incompatible snapshot", () => {
    expect(
      publicationProvenanceFromSnapshot(
        { meta: { registryVersion: "obsolete", sources: {} } },
        null
      )
    ).toEqual({
      publicationState: "unknown",
      registryVersion: null,
      missingRequiredCount: 0,
      appRevision: null,
    });
  });
});
