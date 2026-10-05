import { describe, expect, it } from "vitest";
import { publicationEnabled, anyPublicationEnabled, filterPublicationSnapshot, filterPublicationSummary, sectionPublication, PUBLICATION_CONFIG } from "@/contracts/publication-policy";
import { FEED_REGISTRY, PUBLICATION_SOURCE_REGISTRY } from "@/worker/feed-registry";

const config = { publications: { gdpTracker: { enabled: true }, taxRevenue: { enabled: false }, editionArchive: { enabled: true } } };
const fixture = {
  gdpTracker: { value: 0.5 }, taxRevenue: { value: 999 }, unknown: { secret: 321 },
  meta: { registryVersion: "test", generatedAt: "2026-10-01", sources: { gdpTracker: { status: "ok" }, taxRevenue: { status: "ok" } }, verifiedSections: ["gdpTracker", "taxRevenue"],
    measureCatalog: { schemaVersion: 2, editionId: "example", measures: { "gdp-monthlyGrowth": { sourceId: "gdpTracker", sourceEditionId: "gdp-edition", value: 0.5 }, receipts: { sourceId: "taxRevenue", sourceEditionId: "tax-edition", value: 999 } } },
    editionSummary: { id: "example", sourceEditionIds: ["gdp-edition", "tax-edition"], changes: [{ measureId: "gdp-monthlyGrowth", nextSourceEditionId: "gdp-edition", next: 0.5 }, { measureId: "receipts", nextSourceEditionId: "tax-edition", next: 999 }] },
  },
};

describe("publication switches", () => {
  it("keeps every publication paused and fails closed for unknown identifiers", () => {
    expect(anyPublicationEnabled()).toBe(false);
    for (const id of [...Object.keys(FEED_REGISTRY), ...Object.keys(PUBLICATION_SOURCE_REGISTRY), "earlyYears", "editionArchive"]) {
      expect(PUBLICATION_CONFIG.publications).toHaveProperty(id);
      expect(publicationEnabled(id)).toBe(false);
    }
    expect(publicationEnabled("unexpected", config)).toBe(false);
    expect(sectionPublication("gdp")).toBe("gdpTracker");
    expect(sectionPublication("government-contracts")).toBe("governmentContracts");
  });
  it("restores one source without exposing disabled sources in data, catalogs or revision summaries", () => {
    const output = filterPublicationSnapshot(fixture, config)!;
    expect(output.gdpTracker).toEqual({ value: 0.5 });
    expect(output.taxRevenue).toBeUndefined();
    expect(output.unknown).toBeUndefined();
    expect(Object.keys(output.meta.sources)).toEqual(["gdpTracker"]);
    expect(output.meta.verifiedSections).toEqual(["gdpTracker"]);
    expect(Object.keys(output.meta.measureCatalog.measures)).toEqual(["gdp-monthlyGrowth"]);
    expect(output.meta.editionSummary.changes).toEqual([{ measureId: "gdp-monthlyGrowth", nextSourceEditionId: "gdp-edition", next: 0.5 }]);
    expect(JSON.stringify(output)).not.toContain("999");
    expect(fixture.taxRevenue.value).toBe(999);
  });
  it("does not publish data when all switches are off, even from a populated stored snapshot", () => {
    expect(filterPublicationSnapshot(fixture)).toBeNull();
  });
  it("redacts archived changes for disabled or unknown measures", () => {
    expect(filterPublicationSummary(fixture.meta.editionSummary, config).sourceEditionIds).toEqual(["gdp-edition"]);
    expect(filterPublicationSummary({ changes: [{ measureId: "unknown", next: 123 }] }, config).changes).toEqual([]);
  });
});
