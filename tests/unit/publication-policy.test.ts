import { describe, expect, it } from "vitest";
import {
  PRODUCT_CAPABILITIES,
  PUBLICATION_CONFIG,
  anyEvidencePublished,
  filterPublicationSnapshot,
  filterPublicationSummary,
  publicationDecision,
  publicationHeld,
  publicationPublished,
  productCapabilityAvailable,
  publicRouteAvailable,
  publicationRetired,
  publicationState,
  sectionPublication,
} from "@/contracts/publication-policy";
import { FEED_REGISTRY, PUBLICATION_SOURCE_REGISTRY } from "@/worker/feed-registry";

const config = {
  version: 2,
  publications: {
    gdpTracker: {
      state: "published",
      reasonCode: "test-published",
      reason: "Published for the test.",
    },
    taxRevenue: {
      state: "held",
      reasonCode: "test-held",
      reason: "Held for the test.",
    },
    editionArchive: {
      state: "published",
      reasonCode: "test-archive",
      reason: "Archive is published.",
    },
  },
} as const;

const fixture = {
  gdpTracker: { value: 0.5 },
  taxRevenue: { value: 999 },
  unknown: { secret: 321 },
  meta: {
    registryVersion: "test",
    generatedAt: "2026-10-01",
    publicationState: "degraded",
    missingRequiredSections: ["nhsStats"],
    sources: {
      gdpTracker: { status: "ok" },
      taxRevenue: { status: "ok" },
    },
    verifiedSections: ["gdpTracker", "taxRevenue"],
    measureCatalog: {
      schemaVersion: 2,
      editionId: "example",
      measures: {
        "gdp-monthlyGrowth": {
          sourceId: "gdpTracker",
          sourceEditionId: "gdp-edition",
          value: 0.5,
        },
        receipts: {
          sourceId: "taxRevenue",
          sourceEditionId: "tax-edition",
          value: 999,
        },
      },
    },
    editionSummary: {
      id: "example",
      publishedAt: "2026-10-01T08:00:00.000Z",
      sourceEditionIds: ["gdp-edition", "tax-edition"],
      changes: [
        {
          measureId: "gdp-monthlyGrowth",
          nextSourceEditionId: "gdp-edition",
          next: 0.5,
        },
        {
          measureId: "receipts",
          nextSourceEditionId: "tax-edition",
          next: 999,
        },
      ],
    },
  },
};

describe("publication decisions", () => {
  it("publishes nationalDebt and the archive, holds active feeds, retires old products, and fails closed for unknown identifiers", () => {
    expect(anyEvidencePublished()).toBe(true);
    expect(productCapabilityAvailable("home")).toBe(true);
    expect(productCapabilityAvailable("calendar")).toBe(false);
    expect(publicRouteAvailable("/")).toBe(true);
    expect(publicRouteAvailable("/compare/")).toBe(true);
    expect(publicRouteAvailable("/calendar/")).toBe(false);
    expect(publicationPublished("nationalDebt")).toBe(true);
    expect(publicationPublished("editionArchive")).toBe(true);
    expect(publicationHeld("gdpTracker")).toBe(true);
    expect(publicationRetired("pmApproval")).toBe(true);
    expect(publicationState("unexpected")).toBeNull();
    expect(publicationDecision("nationalDebt")).toMatchObject({
      state: "published",
      reasonCode: "published-verified",
    });

    const published = new Set(["nationalDebt", "editionArchive"]);
    for (const id of [
      ...Object.keys(FEED_REGISTRY),
      ...Object.keys(PUBLICATION_SOURCE_REGISTRY),
      "earlyYears",
      "editionArchive",
    ]) {
      expect(PUBLICATION_CONFIG.publications).toHaveProperty(id);
      expect(publicationPublished(id)).toBe(published.has(id));
    }

    expect(sectionPublication("gdp")).toBe("gdpTracker");
    expect(sectionPublication("government-contracts")).toBe("governmentContracts");
    expect(sectionPublication("national-debt")).toBe("nationalDebt");
  });

  it("keeps route capability independent from evidence publication decisions", () => {
    const heldEvidence = {
      version: 2,
      publications: {
        nationalDebt: {
          state: "held",
          reasonCode: "test-held",
          reason: "Held for the test.",
          sections: ["national-debt"],
        },
        editionArchive: {
          state: "published",
          reasonCode: "archive",
          reason: "Archive remains published.",
        },
      },
    } as const;

    expect(anyEvidencePublished(heldEvidence)).toBe(false);
    expect(publicRouteAvailable("/", heldEvidence, PRODUCT_CAPABILITIES)).toBe(true);
    expect(publicRouteAvailable("/section/national-debt/", heldEvidence, PRODUCT_CAPABILITIES)).toBe(false);
    expect(publicRouteAvailable("/editions/", heldEvidence, PRODUCT_CAPABILITIES)).toBe(true);
  });

  it("publishes one source without exposing held sources in data, catalogues or revision summaries", () => {
    const output = filterPublicationSnapshot(fixture, config)!;
    expect(output.gdpTracker).toEqual({ value: 0.5 });
    expect(output.taxRevenue).toBeUndefined();
    expect(output.unknown).toBeUndefined();
    expect(Object.keys(output.meta.sources)).toEqual(["gdpTracker"]);
    expect(output.meta.verifiedSections).toEqual(["gdpTracker"]);
    expect(Object.keys(output.meta.measureCatalog.measures)).toEqual(["gdp-monthlyGrowth"]);
    expect(output.meta.editionSummary.changes).toEqual([
      {
        measureId: "gdp-monthlyGrowth",
        nextSourceEditionId: "gdp-edition",
        next: 0.5,
      },
    ]);
    expect(JSON.stringify(output)).not.toContain("999");
    expect(fixture.taxRevenue.value).toBe(999);
  });

  it("does not leak internal ready/degraded state into the public projection", () => {
    const output = filterPublicationSnapshot(fixture, config)!;
    expect(output.meta).not.toHaveProperty("publicationState");
    expect(output.meta).not.toHaveProperty("missingRequiredSections");
    expect(output.meta.publicProjection).toEqual({
      state: "published",
      publishedSections: ["gdpTracker"],
    });
  });

  it("does not publish data when the stored snapshot has no published sources", () => {
    expect(filterPublicationSnapshot(fixture)).toBeNull();
  });

  it("redacts archived changes for held, retired or unknown measures", () => {
    expect(filterPublicationSummary(fixture.meta.editionSummary, config).sourceEditionIds)
      .toEqual(["gdp-edition"]);
    expect(
      filterPublicationSummary(
        { id: "x", publishedAt: "2026-10-01T08:00:00.000Z", changes: [{ measureId: "unknown", next: 123 }] },
        config,
      ).changes,
    ).toEqual([]);
  });
});
