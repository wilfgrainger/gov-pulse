import { describe, expect, it } from "vitest";
import {
  publicCandidate,
  validateCandidate,
} from "../../scripts/fetch-cloudflare-publication-candidate.mjs";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../../worker/feed-registry.js";

const NOW = new Date("2026-08-02T09:00:00.000Z");
const FETCHED_AT = "2026-08-02T08:00:00.000Z";

function completeSnapshot() {
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: FETCHED_AT,
      publicationMode: "queue-free-tier",
      freeTierBudget: { reads: 1 },
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
    ...Object.fromEntries(
      REQUIRED_PUBLISHED_SECTION_IDS.map((section) => [
        section,
        { value: section },
      ])
    ),
  };
}

describe("Cloudflare Pages publication candidate", () => {
  it("accepts only a current complete required publication", () => {
    const candidate = validateCandidate(completeSnapshot(), NOW);

    expect(Object.keys(candidate.meta.sources).sort()).toEqual(
      [...REQUIRED_PUBLISHED_SECTION_IDS].sort()
    );
    expect(
      REQUIRED_PUBLISHED_SECTION_IDS.every((section) =>
        Object.prototype.hasOwnProperty.call(candidate, section)
      )
    ).toBe(true);
  });

  it("rejects a candidate when filtering removes one required section", () => {
    const candidate = completeSnapshot();
    candidate.meta.sources.sentimentPulse.fetchedAt =
      "2026-07-31T20:59:59.000Z";

    expect(() => validateCandidate(candidate, NOW)).toThrow(
      /missing current required evidence: sentimentPulse/i
    );
  });

  it("sanitises deployment-only metadata after the completeness gate", () => {
    const candidate = publicCandidate(completeSnapshot(), NOW);

    expect(candidate.meta).not.toHaveProperty("publicationMode");
    expect(candidate.meta).not.toHaveProperty("freeTierBudget");
    expect(Object.keys(candidate.meta.sources)).toHaveLength(
      REQUIRED_PUBLISHED_SECTION_IDS.length
    );
  });
});
