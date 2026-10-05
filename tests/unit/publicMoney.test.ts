import { describe, expect, it } from "vitest";
import { buildDossier, contractCoverageLine, dossierHref, filteredAwardCoverage, frameworkValueLabel, parsePublicMoneyUrlState, serializePublicAwardsCsv, serializePublicMoneyUrlState, sumContractExclusions, type PublicAward } from "@/app/lib/publicMoney";

const award = (key: string, amount: number, supplier = "Example Ltd"): PublicAward => ({
  rank: 1, key, ocid: `ocds-h6vhtk-${key}`, releaseId: "123456-2026", awardId: key, title: `Award ${key}`, buyer: "Department A", suppliers: [supplier], supplierNations: ["Other/Unknown"],
  awardDate: "2026-08-01T00:00:00.000Z", publishedAt: "2026-08-02T00:00:00.000Z", amount, currency: "GBP", valueBasis: "award-value", procurementMethod: "open", procurementMethodDetails: null, mainProcurementCategory: "services", framework: false,
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
    expect(filteredAwardCoverage(awards, [awards[1]])).toEqual({
      visibleCount: 1,
      listedCount: 2,
      sourceDenominator: 2,
      shareOfSourceWindow: 0.5,
    });
  });

  it("reports a filtered top-award sample against the full comparable source universe", () => {
    const listedAwards = Array.from({ length: 100 }, (_, index) => award(`ocds-h6vhtk-${index}`, 1000 - index));

    expect(filteredAwardCoverage(listedAwards, [listedAwards[0]], 881)).toEqual({
      visibleCount: 1,
      listedCount: 100,
      sourceDenominator: 881,
      shareOfSourceWindow: 1 / 881,
    });
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
    expect(csv).toContain("100,disclosed award value,GBP,open,false");
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
    expect(supplier.caveats.join(" ")).toMatch(/multi-supplier notices are not allocated/i);
    expect(supplier.caveats.join(" ")).toMatch(/not a complete release history/i);
  });

  it("uses publisher identifiers to separate same-name entities and join renamed supplier records", () => {
    const awards = [
      { ...award("ocds-h6vhtk-a1", 100, "Old Supplier Name"), supplierIds: ["org-001"], buyerId: "buyer-10" },
      { ...award("ocds-h6vhtk-b2", 250, "Other Legal Entity"), supplierIds: ["org-002"], buyerId: "buyer-20" },
      { ...award("ocds-h6vhtk-c3", 500, "New Supplier Name"), supplierIds: ["org-001"], buyerId: "buyer-10" },
    ];

    const supplier = buildDossier(awards, "org-001", "supplier", "publisher-id")!;
    const sameNameDifferentId = buildDossier([
      { ...awards[0], suppliers: ["Shared Name"], supplierIds: ["org-001"] },
      { ...awards[1], suppliers: ["Shared Name"], supplierIds: ["org-002"] },
    ], "org-002", "supplier", "publisher-id")!;
    const buyer = buildDossier(awards, "buyer-10", "buyer", "publisher-id")!;

    expect(supplier.identityBasis).toBe("publisher-supplier-id");
    expect(supplier.noticeCount).toBe(2);
    expect(supplier.aliases).toEqual(["New Supplier Name", "Old Supplier Name"]);
    expect(sameNameDifferentId.noticeCount).toBe(1);
    expect(buyer).toMatchObject({ identityBasis: "publisher-buyer-id", entityId: "buyer-10", noticeCount: 2 });
    expect(supplier.caveats.join(" ")).toMatch(/not attributed supplier revenue/i);
  });

  it("round-trips filters and an identifier-based dossier in the URL", () => {
    const state = {
      query: "water & transport",
      buyer: "Department of Example",
      nation: "Scotland",
      page: 2,
      dossier: { kind: "supplier" as const, basis: "publisher-id" as const, identity: "GB-FTS-9988" },
    };

    const query = serializePublicMoneyUrlState(state);

    expect(parsePublicMoneyUrlState(query)).toEqual(state);
    expect(parsePublicMoneyUrlState("?dossier=supplier%3Apublisher-id%3AGB-FTS-9988")).toMatchObject({
      dossier: state.dossier,
    });
    expect(parsePublicMoneyUrlState("?dossier=supplier%3Apublisher-id%3Abad%00id").dossier).toBeNull();
  });

  it("exports publisher identifiers and neutralizes spreadsheet formulas", () => {
    const source = {
      ...award("ocds-h6vhtk-a1", 100, "=HYPERLINK(\"https://bad.example\")"),
      buyerId: "buyer-001",
      supplierIds: ["supplier-001"],
    };
    const csv = serializePublicAwardsCsv([source]);

    expect(csv).toContain("Buyer ID");
    expect(csv).toContain("Supplier IDs");
    expect(csv).toContain("buyer-001");
    expect(csv).toContain("supplier-001");
    expect(csv).toContain("'=HYPERLINK");
  });

  it("adds the filtered count, source denominator, window and currency note to exports", () => {
    const csv = serializePublicAwardsCsv(
      [award("ocds-h6vhtk-a1", 100)],
      {
        windowLabel: "1–7 August 2026",
        listedAwardSampleCount: 3,
        sourceWindowAwardCount: 4,
      },
    );

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("Source window,Filtered row count,Published top-ranked sample count,Full source-window award count,Window coverage,Currency basis note");
    expect(csv).toContain("1–7 August 2026,1,3,4,25.0%,GBP only; disclosed award value is not confirmed expenditure");
  });

  it("exports separate listed-sample and complete-window denominators", () => {
    const csv = serializePublicAwardsCsv([award("ocds-h6vhtk-a1", 100)], {
      listedAwardSampleCount: 100,
      sourceWindowAwardCount: 881,
    });

    expect(csv.split("\n")[0]).toContain("Published top-ranked sample count,Full source-window award count,Window coverage");
    expect(csv.split("\n")[1]).toContain(",1,100,881,0.1%,");
  });

  it("exports the signed-contract basis explicitly when that value is used", () => {
    const contractValue = { ...award("ocds-h6vhtk-a1", 100), valueBasis: "contract-value" as const };
    const csv = serializePublicAwardsCsv([contractValue]);

    expect(csv).toContain("100,value in one uniquely linked contract,GBP");
    expect(csv).toContain("GBP only; value in one uniquely linked contract is not confirmed expenditure");
    expect(buildDossier([contractValue], contractValue.key)?.caveats.join(" "))
      .toMatch(/value in one uniquely linked contract is not an invoice/i);
  });
});


describe("contract dossier coverage helpers", () => {
  it("sums exclusions fail-closed when a field is missing", () => {
    expect(
      sumContractExclusions({
        excludedMissingValue: 1,
        excludedAmbiguousContractValue: 2,
        excludedNonGbp: 3,
        excludedMissingBuyer: 4,
        excludedMissingSupplier: 5,
        excludedMalformed: 6,
      }),
    ).toBe(21);
    expect(
      sumContractExclusions({
        excludedMissingValue: 1,
        excludedAmbiguousContractValue: 2,
        excludedNonGbp: 3,
        excludedMissingBuyer: 4,
        excludedMissingSupplier: 5,
      }),
    ).toBeNull();
  });

  it("builds a coverage line only when both sides are known", () => {
    expect(contractCoverageLine(881, 34)).toBe(
      "881 of 915 awards · 34 excluded for missing or non-comparable values",
    );
    expect(contractCoverageLine(881, null)).toBeNull();
  });

  it("builds dossier hrefs and framework labels", () => {
    expect(dossierHref({ kind: "buyer", basis: "publisher-id", identity: "GB-NHS-QOQ" })).toBe(
      "/money?dossier=buyer%3Apublisher-id%3AGB-NHS-QOQ",
    );
    expect(frameworkValueLabel(true)).toMatch(/framework maximum/i);
    expect(frameworkValueLabel(false)).toMatch(/single award/i);
  });
});
