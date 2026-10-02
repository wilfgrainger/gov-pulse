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
    expect(markup).toContain("Official private-rent history is not yet verified");
    expect(markup).not.toContain("household rent estimate");
    expect(markup).toContain("Bank Rate history is unavailable or expired");
  });
});
