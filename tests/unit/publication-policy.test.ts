import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicationEnabled, anyPublicationEnabled, filterPublicationSnapshot, filterPublicationSummary, sectionPublication, publicationRouteEnabled, productRouteAvailable, PUBLICATION_CONFIG } from "@/contracts/publication-policy";
import * as publicationPolicy from "@/contracts/publication-policy";
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
  it("enables nationalDebt and editionArchive only, and fails closed for unknown identifiers", () => {
    expect(anyPublicationEnabled()).toBe(true);
    expect(publicationEnabled("nationalDebt")).toBe(true);
    expect(publicationEnabled("editionArchive")).toBe(true);
    const enabled = new Set(["nationalDebt", "editionArchive"]);
    for (const id of [...Object.keys(FEED_REGISTRY), ...Object.keys(PUBLICATION_SOURCE_REGISTRY), "earlyYears", "editionArchive"]) {
      expect(PUBLICATION_CONFIG.publications).toHaveProperty(id);
      expect(publicationEnabled(id)).toBe(enabled.has(id));
    }
    expect(publicationEnabled("unexpected", config)).toBe(false);
    expect(sectionPublication("gdp")).toBe("gdpTracker");
    expect(sectionPublication("government-contracts")).toBe("governmentContracts");
    expect(sectionPublication("national-debt")).toBe("nationalDebt");
  });
  it("keeps authored story publication switches separate from their evidence sources", () => {
    expect(publicationRouteEnabled("/stories/household-budgets/" )).toBe(true);
    expect(publicationRouteEnabled("/stories/public-finances/" )).toBe(true);
    const approvedStories = { publications: { storyHouseholdBudgets: { enabled: true }, storyPublicFinances: { enabled: true }, realWages: { enabled: false }, gdpTracker: { enabled: false } } };
    expect(publicationRouteEnabled("/stories/household-budgets/", approvedStories)).toBe(true);
    expect(publicationRouteEnabled("/stories/public-finances/", approvedStories)).toBe(true);
    expect(publicationEnabled("realWages")).toBe(false);
    expect(publicationEnabled("gdpTracker")).toBe(false);
    expect(publicationEnabled("taxRevenue")).toBe(false);
  });
  it("withdraws the static data seed when only authored stories remain enabled", () => {
    const storiesOnly = { publications: {
      storyHouseholdBudgets: { enabled: true },
      storyPublicFinances: { enabled: true },
      nationalDebt: { enabled: false },
      editionArchive: { enabled: false },
    } };
    expect(anyPublicationEnabled(storiesOnly)).toBe(true);
    expect(publicationPolicy.anyEvidenceSourceEnabled?.(storiesOnly)).toBe(false);
    expect(publicationPolicy.anyEvidenceSourceEnabled?.({ publications: { editionArchive: { enabled: true }, nationalDebt: { enabled: false } } })).toBe(false);

    const deployWorkflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(deployWorkflow).toContain("anyEvidenceSourceEnabled");
    expect(deployWorkflow).not.toContain("paused=${!anyPublicationEnabled()}");
  });
  it("keeps registered product routes available while evidence publication remains held", () => {
    const heldConfig = { publications: { electionPolling: { enabled: false, sections: ["election-polls"] }, governmentContracts: { enabled: false, sections: ["government-contracts"] }, editionArchive: { enabled: true } } };
    expect(publicationRouteEnabled("/section/election-polls/", heldConfig)).toBe(false);
    expect(productRouteAvailable("/section/election-polls/", heldConfig)).toBe(true);
    expect(productRouteAvailable("/money/", heldConfig)).toBe(true);
    expect(productRouteAvailable("/calendar/", heldConfig)).toBe(true);
    expect(productRouteAvailable("/measure/debt-ratio/", heldConfig)).toBe(true);
    expect(productRouteAvailable("/section/not-registered/", heldConfig)).toBe(false);
    expect(productRouteAvailable("/sources/not-registered/", heldConfig)).toBe(false);
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
  it("does not publish data when the stored snapshot has no enabled sources", () => {
    expect(filterPublicationSnapshot(fixture)).toBeNull();
  });
  it("redacts archived changes for disabled or unknown measures", () => {
    expect(filterPublicationSummary(fixture.meta.editionSummary, config).sourceEditionIds).toEqual(["gdp-edition"]);
    expect(filterPublicationSummary({ changes: [{ measureId: "unknown", next: 123 }] }, config).changes).toEqual([]);
  });
  it("preserves missingRequiredSections on degraded snapshots for parity with health reporting", () => {
    const degradedFixture = {
      ...fixture,
      meta: {
        ...fixture.meta,
        publicationState: "degraded",
        missingRequiredSections: ["nhsStats"],
      },
    };
    const output = filterPublicationSnapshot(degradedFixture, config)!;
    expect(output.meta.publicationState).toBe("degraded");
    expect(output.meta.missingRequiredSections).toEqual(["nhsStats"]);
  });
});
