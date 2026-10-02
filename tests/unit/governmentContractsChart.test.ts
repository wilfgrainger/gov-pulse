import { describe, expect, it } from "vitest";
import { buildSupplierConcentrationMetadata } from "@/app/lib/governmentContractsChart";

describe("supplier concentration export metadata", () => {
  it("carries the plotted supplier values, filtered range, source and display cap", () => {
    const metadata = buildSupplierConcentrationMetadata({
      title: "Suppliers ranked by disclosed value",
      suppliers: [
        { name: "Supplier A", awardCount: 3, disclosedValue: 90, nation: "England" },
        { name: "Supplier B", awardCount: 2, disclosedValue: 30, nation: "Scotland" },
      ],
      filteredSupplierCount: 2,
      fullSupplierCount: 81,
      updateWindow: { updatedFrom: "2026-06-01T00:00:00Z", updatedTo: "2026-06-07T23:59:59Z" },
      sourceUrl: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
      sourceLabel: "Cabinet Office Find a Tender OCDS API",
      caveats: ["Disclosed award values are not confirmed expenditure."],
    });

    expect(metadata.observationWindow).toEqual({
      start: { period: "2026-06-01", observedAt: "2026-06-01" },
      end: { period: "2026-06-07", observedAt: "2026-06-07" },
    });
    expect(metadata.sourceCitation).toContain("https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages");
    expect(metadata.sourceCitation).toContain("Plot shows 2 of 2 filtered suppliers (81 in the full publication)");
    expect(metadata.series).toEqual([
      { key: "Supplier A", label: "Supplier A · £90 · 3 awards · England" },
      { key: "Supplier B", label: "Supplier B · £30 · 2 awards · Scotland" },
    ]);
    expect(metadata.caveats).toEqual(expect.arrayContaining([
      "Disclosed award values are not confirmed expenditure.",
      "Multi-supplier award values are allocated equally for the supplier ranking.",
    ]));
  });
});
