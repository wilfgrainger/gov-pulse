import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CostOfLivingLens from "@/app/components/CostOfLivingLens";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

function measure(id: string, label: string, comparisonKey: string, value: number) {
  return { id, label, evidenceClass: "official-statistics", comparisonKey, cadence: "monthly", unit: "%", basis: `${label} source definition`, geography: { code: "UK", label: "United Kingdom" }, sourceId: "ons", sourceUrl: "https://www.ons.gov.uk/prices", sourceEditionId: "ons-2026-08", observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "August 2026" }, publishedAt: "2026-09-20T07:00:00.000Z", fetchedAt: "2026-09-20T08:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", availability: "current", value, revisionId: "ons-2026-08", points: [{ period: "August 2026", observedAt: "2026-08-31", value, valueStatus: "observed", revisionId: "ons-2026-08" }], caveats: [] };
}

describe("cost-of-living lens", () => {
  it("keeps available series in separate panels and says rent is unavailable when no source is verified", () => {
    const snapshot = { meta: { registryVersion: "test", sources: {}, measureCatalog: { schemaVersion: 2, editionId: "catalog", generatedAt: "2026-09-20T08:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", measures: { inflation: measure("inflation", "CPI inflation", "cpi", 3), regularPayRealGrowth: measure("regularPayRealGrowth", "Real regular pay growth", "real-pay", 1.5) } } } } as unknown as MetricsSnapshot;
    const markup = renderToStaticMarkup(<CostOfLivingLens snapshot={snapshot}/>);
    expect(markup).toContain("CPI inflation: published observations");
    expect(markup).toContain("Real regular pay growth: published observations");
    expect(markup).toContain("Verified private-rent evidence unavailable");
    expect(markup).not.toContain("household rent estimate");
    expect(markup).toContain("Bank Rate history is unavailable or expired");
  });

  it("shows current ONS rent level and its separate annual-change history with provenance", () => {
    const source = "https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026";
    const rentChange = {
      ...measure("privateRentAnnualChange", "Private rent: annual change", "pipr-change", 3.8),
      observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "Aug 2026" },
      sourceUrl: source,
      sourceEditionId: "september2026",
      points: [
        { period: "Jun 2026", observedAt: "2026-06-30", value: 3.3, valueStatus: "estimate", revisionId: "september2026" },
        { period: "Jul 2026", observedAt: "2026-07-31", value: 3.7, valueStatus: "estimate", revisionId: "september2026" },
        { period: "Aug 2026", observedAt: "2026-08-31", value: 3.8, valueStatus: "estimate", revisionId: "september2026" },
      ],
      caveats: ["Provisional and subject to revision; not a household-specific rent."],
    };
    const rentAverage = {
      ...measure("privateRentAverage", "Average monthly private rent", "pipr-average", 1400),
      unit: "GBP/month",
      basis: "ONS headline average monthly rent for UK privately rented properties",
      sourceUrl: source,
      sourceEditionId: "september2026",
      observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "Aug 2026" },
      points: [],
      caveats: ["Aggregate UK measure; not a household-specific rent."],
    };
    const housePriceChange = {
      ...measure("housePriceChange", "House prices: annual change", "house-price-change", 1.4),
      observationPeriod: { start: "2026-07-01", end: "2026-07-31", label: "Jul 2026" },
      sourceUrl: source,
      points: [{ period: "Jul 2026", observedAt: "2026-07-31", value: 1.4, valueStatus: "estimate", revisionId: "september2026" }],
    };
    const housePriceAverage = {
      ...measure("housePriceAverage", "Average UK house price", "house-price-average", 273000),
      unit: "GBP",
      basis: "ONS average UK house price for the observation month stated in the UK House Price Index bulletin",
      sourceUrl: source,
      observationPeriod: { start: "2026-07-01", end: "2026-07-31", label: "Jul 2026" },
      points: [{ period: "Jul 2026", observedAt: "2026-07-31", value: 273000, valueStatus: "estimate", revisionId: "september2026" }],
    };
    const cpi = {
      ...measure("inflation", "CPI inflation", "cpi", 3),
      points: [{ period: "Aug 2026", observedAt: "2026-08-31", value: 3, valueStatus: "estimate", revisionId: "cpi-aug-2026" }],
    };
    const snapshot = { meta: { registryVersion: "test", sources: {}, measureCatalog: { schemaVersion: 2, editionId: "catalog", generatedAt: "2026-09-20T08:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", measures: { inflation: cpi, regularPayRealGrowth: measure("regularPayRealGrowth", "Real regular pay growth", "real-pay", 1.5), privateRentAnnualChange: rentChange, privateRentAverage: rentAverage, housePriceChange, housePriceAverage } } } } as unknown as MetricsSnapshot;

    const markup = renderToStaticMarkup(<CostOfLivingLens snapshot={snapshot}/>);

    expect(markup).toContain("Average monthly UK private rent");
    expect(markup).toContain("£1,400");
    expect(markup).toContain("Private rent: annual change in published observations");
    expect(markup).toContain("ONS PIPR");
    expect(markup).toContain("Prices and private rents: matched annual changes");
    expect(markup).toContain("August 2026");
    expect(markup).toContain("House prices: published observations");
    expect(markup).toContain("Average UK house price");
    expect(markup).toContain("£273,000");
    expect(markup).toContain("not a household-specific rent");
    expect(markup).toContain(source);
    expect(markup).not.toContain("collector remains blocked");
  });
});
