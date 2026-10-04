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
      valueBasisLabel: "disclosed award value",
      caveats: ["Disclosed award values are not confirmed expenditure."],
    });

    expect(metadata.observationWindow).toEqual({
      start: { period: "2026-06-01", observedAt: "2026-06-01" },
      end: { period: "2026-06-07", observedAt: "2026-06-07" },
    });
    expect(metadata.sourceCitation).toContain("https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages");
    expect(metadata.sourceCitation).toContain("Plot shows 2 of 2 filtered supplier groups (81 in the full publication)");
    expect(metadata.series).toEqual([
      { key: "name:Supplier A", label: "Supplier A · exact-name match · £90 scenario value · 3 awards · England" },
      { key: "name:Supplier B", label: "Supplier B · exact-name match · £30 scenario value · 2 awards · Scotland" },
    ]);
    expect(metadata.caveats).toEqual(expect.arrayContaining([
      "Disclosed award values are not confirmed expenditure.",
      "Values use disclosed award value. Multi-supplier amounts are split equally for a comparison scenario; they are not attributed supplier revenue or confirmed expenditure.",
    ]));
  });
});
