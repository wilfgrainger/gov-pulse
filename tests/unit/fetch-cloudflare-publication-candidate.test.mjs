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
    ...sections,
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
    for (const measure of Object.values(candidate.sentimentPulse.__measureValidity)) {
      measure.validUntil = "2026-08-01T00:00:00.000Z";
    }

    expect(() => validateCandidate(candidate, NOW)).toThrow(
      /missing current required evidence: sentimentPulse/i
    );
  });

  it("sanitises deployment-only metadata after the completeness gate", () => {
    const candidate = publicCandidate(completeSnapshot(), NOW);

    expect(candidate.meta).not.toHaveProperty("publicationMode");
    expect(candidate.meta).not.toHaveProperty("freeTierBudget");
    expect(Object.keys(candidate.meta.sources)).toEqual(["nationalDebt"]);
  });

  it("applies the public publication switches after validating the complete candidate", () => {
    const fullSnapshot = completeSnapshot();
    fullSnapshot.meta.measureCatalog = {
      schemaVersion: 2,
      editionId: "complete-edition",
      measures: {
        debt: { sourceId: "nationalDebt", sourceEditionId: "debt-source-edition" },
        gdp: { sourceId: "gdpTracker", sourceEditionId: "gdp-source-edition" },
      },
    };
    fullSnapshot.meta.editionSummary = {
      id: "complete-edition",
      publishedAt: FETCHED_AT,
      previousEditionId: "previous-edition",
      sourceEditionIds: ["debt-source-edition", "gdp-source-edition"],
      changes: [
        { measureId: "debt", nextSourceEditionId: "debt-source-edition" },
        { measureId: "gdp", nextSourceEditionId: "gdp-source-edition" },
      ],
    };

    const candidate = publicCandidate(fullSnapshot, NOW);

    expect(Object.keys(candidate.meta.sources)).toEqual(["nationalDebt"]);
    expect(candidate).toHaveProperty("nationalDebt");
    expect(candidate).not.toHaveProperty("gdpTracker");
    expect(JSON.stringify(candidate)).not.toContain("gdpTracker");
    expect(Object.keys(candidate.meta.measureCatalog.measures)).toEqual(["debt"]);
    expect(candidate.meta.editionSummary.changes).toEqual([
      { measureId: "debt", nextSourceEditionId: "debt-source-edition" },
    ]);
    expect(candidate.meta.editionSummary.sourceEditionIds).toEqual([
      "debt-source-edition",
    ]);
  });
});
