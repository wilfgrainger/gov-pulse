import { describe, expect, it } from "vitest";
import {
  validateAcceptedArtifact,
} from "../../scripts/fetch-cloudflare-publication-candidate.mjs";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../../worker/feed-registry.js";

const NOW = new Date("2026-08-02T09:00:00.000Z");
const FETCHED_AT = "2026-08-02T08:00:00.000Z";

function acceptedArtifact() {
  const sections = Object.fromEntries(
    REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
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
              { validUntil: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() },
            ])),
          }
        : { value: section },
    ])
  );
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: FETCHED_AT,
      sources: Object.fromEntries(
        REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
          section,
          {
            status: "ok",
            cacheState: "fresh",
            fetchedAt: FETCHED_AT,
          },
        ])
      ),
    },
    ...sections,
  };
}

describe("Cloudflare Pages accepted-artifact recovery", () => {
  it("accepts a pre-sanitized current publication artifact", () => {
    const candidate = validateAcceptedArtifact(acceptedArtifact(), NOW);

    expect(Object.keys(candidate.meta.sources).sort()).toEqual(
      [...REQUIRED_PUBLISHED_SECTION_IDS].sort()
    );
  });

  it("uses canonical currentness to withhold an expired section without inventing a replacement", () => {
    const candidate = acceptedArtifact();
    candidate.meta.sources.sentimentPulse.fetchedAt =
      "2026-07-31T20:59:59.000Z";
    for (const measure of Object.values(candidate.sentimentPulse.__measureValidity)) {
      measure.validUntil = "2026-08-01T00:00:00.000Z";
    }

    const current = validateAcceptedArtifact(candidate, NOW);
    expect(current).not.toHaveProperty("sentimentPulse");
    expect(current.meta.sources).not.toHaveProperty("sentimentPulse");
  });

  it("rejects deployment-only or private metadata instead of sanitizing it during recovery", () => {
    const candidate = acceptedArtifact();
    candidate.meta.publicationMode = "queue-free-tier";
    candidate.meta.sources.gdpTracker.backend = "private-worker";

    expect(() => validateAcceptedArtifact(candidate, NOW)).toThrow(
      /private publication metadata/i
    );
  });

  it("rejects private source diagnostics", () => {
    const candidate = acceptedArtifact();
    candidate.meta.sources.gdpTracker.error = "private upstream response";

    expect(() => validateAcceptedArtifact(candidate, NOW)).toThrow(
      /private publication metadata/i
    );
  });
});
