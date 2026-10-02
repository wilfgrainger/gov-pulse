import { describe, expect, it } from "vitest";
import { buildDossier, filteredAwardCoverage, serializePublicAwardsCsv, type PublicAward } from "@/app/lib/publicMoney";

const award = (key: string, amount: number, supplier = "Example Ltd"): PublicAward => ({
  rank: 1, key, ocid: `ocds-h6vhtk-${key}`, releaseId: "123456-2026", awardId: key, title: `Award ${key}`, buyer: "Department A", suppliers: [supplier], supplierNations: ["Other/Unknown"],
  awardDate: "2026-08-01T00:00:00.000Z", publishedAt: "2026-08-02T00:00:00.000Z", amount, currency: "GBP", procurementMethod: "open", procurementMethodDetails: null, mainProcurementCategory: "services", framework: false,
  noticeUrl: `https://www.find-tender.service.gov.uk/Notice/123456-2026`, procurementUrl: `https://www.find-tender.service.gov.uk/procurement/${`ocds-h6vhtk-${key}`}`,
});

describe("notice-level public-money dossiers", () => {
  it("keeps matching supplier names as separate notice identities and never consolidates their value", () => {
    const awards = [award("ocds-h6vhtk-a1", 100), award("ocds-h6vhtk-b2", 250)];
    const dossier = buildDossier(awards, awards[0].key)!;
    expect(dossier).toMatchObject({ id: awards[0].key, identityBasis: "single-award-notice", disclosedTotal: 100, noticeCount: 1, filteredDenominator: 2 });
    expect(dossier.caveats.join(" ")).toMatch(/not a verified buyer or supplier legal entity/i);
    expect(buildDossier(awards, "same-supplier-name")).toBeNull();
  });

  it("reports visible coverage against the exact current source window", () => {
    const awards = [award("ocds-h6vhtk-a1", 100), award("ocds-h6vhtk-b2", 250)];
    expect(filteredAwardCoverage(awards, [awards[1]])).toEqual({ visibleCount: 1, sourceDenominator: 2, shareOfSourceWindow: 0.5 });
  });

  it("exports only the supplied filtered notices with exact values and escaped source fields", () => {
    const selected = {
      ...award("ocds-h6vhtk-a1", 100, "Supplier \"Quoted\""),
      buyer: "Department, Alpha",
      title: "Support, \"phase two\"",
      suppliers: ["Supplier \"Quoted\"", "Partner Ltd"],
    };

    const csv = serializePublicAwardsCsv([selected]);

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain('"Support, ""phase two"""');
    expect(csv).toContain('"Department, Alpha"');
    expect(csv).toContain('"Supplier ""Quoted"", Partner Ltd"');
    expect(csv).toContain("100,GBP,open,false");
    expect(csv).toContain(selected.noticeUrl);
    expect(csv).toContain(selected.procurementUrl);
  });

  it("builds explicitly name-matched buyer and supplier record sets without claiming entity identity", () => {
    const awards = [
      award("ocds-h6vhtk-a1", 100),
      { ...award("ocds-h6vhtk-b2", 250), buyer: "Department A" },
      { ...award("ocds-h6vhtk-c3", 500), buyer: "Other Department", suppliers: ["Different Supplier"] },
    ];
    const buyer = buildDossier(awards, "Department A", "buyer")!;
    const supplier = buildDossier(awards, "Example Ltd", "supplier")!;

    expect(buyer).toMatchObject({ identityBasis: "exact-buyer-string", kind: "buyer", disclosedTotal: 350, noticeCount: 2, filteredDenominator: 3 });
    expect(buyer.noticeLinks.map((notice) => notice.releaseId)).toHaveLength(2);
    expect(buyer.caveats.join(" ")).toMatch(/does not prove a shared legal entity/i);
    expect(supplier).toMatchObject({ identityBasis: "exact-supplier-string", disclosedTotal: 350, noticeCount: 2 });
    expect(supplier.caveats.join(" ")).toMatch(/multi-supplier awards are not allocated/i);
    expect(supplier.caveats.join(" ")).toMatch(/not a complete release history/i);
  });
});
