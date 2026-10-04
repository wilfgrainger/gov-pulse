import { describe, expect, it } from "vitest";
import {
  CAVEATS,
  EVIDENCE_POLICY,
  buildGovernmentContractsPayload,
  buildSummary,
  buildSupplierConcentration,
  isCurrentGovernmentContractsPayload,
  normalizeGovernmentContractsPayload,
  ukNationFromCountryName,
  ukNationFromPostcode,
} from "../../contracts/government-contracts.js";
import {
  buildContractsFromShards,
  daySlices,
  previousCompleteDays,
  rankDailyAwards,
} from "../../worker/government-contracts-cloudflare.js";

const NOW = new Date("2026-07-18T12:00:00.000Z");

function canonicalAward(index: number) {
  const ocid = `ocds-h6vhtk-${(index + 1).toString(16).padStart(8, "0")}`;
  const releaseId = `${String(100000 + index)}-2026`;
  const awardId = `award-${index + 1}`;
  return {
    rank: index + 1,
    key: `${ocid}:${awardId}`,
    ocid,
    releaseId,
    awardId,
    title: `Public contract ${index + 1}`,
    buyer: `Public buyer ${(index % 12) + 1}`,
    buyerId: null as string | null,
    suppliers: [`Supplier ${(index % 25) + 1}`],
    supplierIds: [null as string | null],
    supplierNations: ["Other/Unknown"],
    awardDate: `2026-07-${String((index % 17) + 1).padStart(2, "0")}T09:00:00.000Z`,
    publishedAt: `2026-07-${String((index % 17) + 1).padStart(2, "0")}T12:00:00.000Z`,
    amount: 1_000_000_000 - index * 1_000_000,
    currency: "GBP" as const,
    valueBasis: "award-value" as const,
    procurementMethod: index % 10 === 0 ? "direct" : "open",
    procurementMethodDetails: index % 10 === 0 ? "Direct award" : "Open procedure",
    mainProcurementCategory: "services",
    framework: index % 8 === 0,
    noticeUrl: `https://www.find-tender.service.gov.uk/Notice/${releaseId}`,
    procurementUrl: `https://www.find-tender.service.gov.uk/procurement/${ocid}`,
  };
}

function payloadInput(count = 100) {
  const awards = Array.from({ length: count }, (_, index) => canonicalAward(index));
  return {
    available: true,
    generatedAt: NOW.toISOString(),
    window: {
      updatedFrom: "2026-07-11T00:00:00.000Z",
      updatedTo: "2026-07-17T23:59:59.000Z",
      label: "11 Jul 2026 to 17 Jul 2026",
      basis:
        "Find a Tender award-stage releases from the latest complete seven-day UTC window, collected in six-hour slices",
    },
    source: {},
    summary: buildSummary(awards),
    awards,
    dataQuality: {
      pagesFetched: 28,
      requestsMade: 28,
      releasesSeen: count,
      awardsSeen: count,
      validComparableAwards: count,
      excludedMissingValue: 3,
      excludedNonGbp: 2,
      excludedMissingBuyer: 1,
      excludedMissingSupplier: 1,
      excludedMalformed: 1,
      duplicatesRemoved: 0,
    },
    caveats: [...CAVEATS],
    evidencePolicy: { ...EVIDENCE_POLICY },
  };
}

const SAMPLE_POSTCODES = ["EH1 1AA", "CF10 1AA", "BT1 1AA", "SW1A 1AA"];

function rawRelease(index: number) {
  const award = canonicalAward(index);
  const day = `2026-07-${String(11 + (index % 7)).padStart(2, "0")}`;
  const supplierId = `supplier-party-${index + 1}`;
  const postcode = SAMPLE_POSTCODES[index % SAMPLE_POSTCODES.length];
  return {
    ocid: award.ocid,
    id: award.releaseId,
    date: `${day}T12:00:00.000Z`,
    buyer: { id: `buyer-party-${index + 1}`, name: award.buyer },
    parties: [
      {
        id: supplierId,
        name: award.suppliers[0],
        roles: ["supplier"],
        address: {
          postalCode: postcode,
          countryName: ["Scotland", "Wales", "Northern Ireland", "England"][index % 4],
        },
      },
    ],
    tender: {
      title: award.title,
      procurementMethod: award.procurementMethod,
      procurementMethodDetails: award.procurementMethodDetails,
      mainProcurementCategory: award.mainProcurementCategory,
      techniques: { hasFrameworkAgreement: award.framework },
    },
    awards: [
      {
        id: award.awardId,
        title: award.title,
        date: `${day}T09:00:00.000Z`,
        value: { amount: award.amount, currency: award.currency },
        suppliers: award.suppliers.map((name) => ({ id: supplierId, name })),
      },
    ],
  };
}

describe("government contracts contract", () => {
  it("publishes the largest 100 ranked comparable GBP awards", () => {
    const payload = buildGovernmentContractsPayload(payloadInput(), NOW);

    expect(payload.awards).toHaveLength(100);
    expect(payload.awards[0].rank).toBe(1);
    expect(payload.awards[99].rank).toBe(100);
    expect(payload.awards[0].amount).toBeGreaterThan(payload.awards[99].amount);
    expect(payload.summary.awardCount).toBe(100);
    expect(payload.summary.explicitDirectAwards).toBe(10);
    expect(isCurrentGovernmentContractsPayload(payload, NOW)).toBe(true);
  });

  it("publishes a complete window when it contains fewer than 100 comparable awards", () => {
    const payload = buildGovernmentContractsPayload(payloadInput(7), NOW);

    expect(payload.awards).toHaveLength(7);
    expect(payload.summary.awardCount).toBe(7);
    expect(payload.dataQuality.validComparableAwards).toBe(7);
    expect(isCurrentGovernmentContractsPayload(payload, NOW)).toBe(true);
  });

  it("rejects rankings that combine award and signed-contract value bases", () => {
    const input = payloadInput(2);
    const awardValueSummary = input.summary;
    input.awards[1].valueBasis = "contract-value";
    input.summary = awardValueSummary;

    expect(() => buildGovernmentContractsPayload(input, NOW)).toThrow(/cannot mix value bases/i);
  });

  it("publishes a contract-value basis through the currentness contract", () => {
    const input = payloadInput(1);
    input.awards[0].valueBasis = "contract-value";
    input.summary = buildSummary(input.awards);

    const payload = buildGovernmentContractsPayload(input, NOW);

    expect(payload.summary.valueBasis).toBe("contract-value");
    expect(payload.awards[0].valueBasis).toBe("contract-value");
    expect(isCurrentGovernmentContractsPayload(payload, NOW)).toBe(true);
  });

  it("accepts every named supplier on a valid multi-supplier award", () => {
    const input = payloadInput(1);
    input.awards[0].suppliers = Array.from({ length: 101 }, (_, index) => `Supplier ${index + 1}`);
    input.awards[0].supplierIds = input.awards[0].suppliers.map(() => null);
    input.awards[0].supplierNations = input.awards[0].suppliers.map(() => "Other/Unknown");
    input.summary = buildSummary(input.awards);

    const payload = buildGovernmentContractsPayload(input, NOW);

    expect(payload.awards[0].suppliers).toHaveLength(101);
    expect(payload.summary.distinctSuppliers).toBe(101);
  });

  it("preserves publisher entity IDs and separates supplier name collisions", () => {
    const input = payloadInput(3);
    input.awards[0].buyer = "Shared Buyer";
    input.awards[1].buyer = "Shared Buyer";
    input.awards[0].buyerId = "buyer-001";
    input.awards[1].buyerId = "buyer-002";
    input.awards[0].suppliers = ["Shared Supplier"];
    input.awards[1].suppliers = ["Shared Supplier"];
    input.awards[2].suppliers = ["Renamed Supplier"];
    input.awards[0].supplierIds = ["supplier-001"];
    input.awards[1].supplierIds = ["supplier-002"];
    input.awards[2].supplierIds = ["supplier-001"];
    input.summary = buildSummary(input.awards);

    const payload = buildGovernmentContractsPayload(input, NOW);
    const sameName = payload.awards.filter((award: { suppliers: string[] }) => award.suppliers.some((name) => name.includes("Supplier")));

    expect(payload.awards[0].buyerId).toBe("buyer-001");
    expect(payload.awards[0].supplierIds).toEqual(["supplier-001"]);
    expect(payload.summary.distinctBuyers).toBe(3);
    expect(payload.summary.distinctSuppliers).toBe(2);
    expect(payload.supplierConcentration.map((entry: { entityId: string | null }) => entry.entityId).sort()).toEqual(["supplier-001", "supplier-002"]);
    expect(sameName.length).toBe(3);
  });

  it("continues to read current editions with the retired count field", () => {
    const legacy = buildGovernmentContractsPayload(payloadInput(), NOW);
    legacy.evidencePolicy = {
      ...legacy.evidencePolicy,
      requiredAwardCount: 100,
    } as typeof legacy.evidencePolicy;
    delete (legacy.evidencePolicy as { displayedAwardLimit?: number }).displayedAwardLimit;

    expect(() => normalizeGovernmentContractsPayload(legacy, NOW)).not.toThrow();
    expect(isCurrentGovernmentContractsPayload(legacy, NOW)).toBe(true);
  });

  it("continues to read current pre-basis editions as award-value records", () => {
    const legacy = buildGovernmentContractsPayload(payloadInput(), NOW);
    for (const award of legacy.awards) delete (award as { valueBasis?: string }).valueBasis;
    delete (legacy.summary as { valueBasis?: string }).valueBasis;
    delete (legacy.dataQuality as { excludedAmbiguousContractValue?: number }).excludedAmbiguousContractValue;
    legacy.caveats = [
      "Values are the amounts disclosed in Find a Tender award releases, not invoices or confirmed lifetime public expenditure.",
      "Framework and multi-supplier awards can state maximum or estimated values that may never be fully spent.",
      "The ranking covers comparable GBP awards updated in the stated window; missing, redacted and non-GBP values are excluded.",
      "A large award is not evidence of waste, fraud or poor value. The source notice and procurement context must be examined.",
      "Find a Tender is the central digital platform, but publication coverage and notice quality still depend on contracting authorities.",
    ];
    legacy.evidencePolicy = {
      ...legacy.evidencePolicy,
      rankingMeasure: "disclosed award value excluding VAT where supplied",
    };

    expect(() => normalizeGovernmentContractsPayload(legacy, NOW)).not.toThrow();
    expect(isCurrentGovernmentContractsPayload(legacy, NOW)).toBe(true);
  });

  it("continues to read the immediately preceding six-caveat edition", () => {
    const legacy = buildGovernmentContractsPayload(payloadInput(), NOW);
    legacy.caveats = [
      "Values are the amounts disclosed in Find a Tender award releases, not invoices or confirmed lifetime public expenditure.",
      "Framework and multi-supplier awards can state maximum or estimated values that may never be fully spent.",
      "The ranking covers comparable GBP awards updated in the stated window; missing, redacted and non-GBP values are excluded.",
      "A large award is not evidence of waste, fraud or poor value. The source notice and procurement context must be examined.",
      "Supplier value concentration is an equal-share scenario across named suppliers, not publisher attribution or supplier revenue.",
      "Find a Tender is the central digital platform, but publication coverage and notice quality still depend on contracting authorities.",
    ];

    expect(() => normalizeGovernmentContractsPayload(legacy, NOW)).not.toThrow();
    expect(isCurrentGovernmentContractsPayload(legacy, NOW)).toBe(true);
  });

  it("rejects tampered values and provenance", () => {
    const valueTamper = buildGovernmentContractsPayload(payloadInput(), NOW);
    valueTamper.awards[0].amount += 1;
    expect(isCurrentGovernmentContractsPayload(valueTamper, NOW)).toBe(false);

    const sourceTamper = buildGovernmentContractsPayload(payloadInput(), NOW);
    sourceTamper.source.publisher = "Unknown publisher";
    expect(isCurrentGovernmentContractsPayload(sourceTamper, NOW)).toBe(false);
  });

  it("preserves the no-waste and no-actual-spend evidence boundary", () => {
    const payload = buildGovernmentContractsPayload(payloadInput(), NOW);

    expect(payload.evidencePolicy.actualSpendClaim).toBe(false);
    expect(payload.evidencePolicy.wasteClaim).toBe(false);
    expect(payload.evidencePolicy.fraudClaim).toBe(false);
    expect(payload.evidencePolicy.savingClaim).toBe(false);
    expect(payload.caveats.join(" ")).toMatch(/not invoices|not evidence of waste/i);
  });

  it("splits the complete seven-day window into six-hour slices", () => {
    const days = previousCompleteDays(NOW, 7);
    const slices = days.flatMap((day) => daySlices(day));

    expect(days).toEqual([
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
    expect(slices).toHaveLength(28);
    expect(slices[0]).toEqual({
      updatedFrom: "2026-07-11T00:00:00",
      updatedTo: "2026-07-11T05:59:59",
    });
    expect(slices[27]).toEqual({
      updatedFrom: "2026-07-17T18:00:00",
      updatedTo: "2026-07-17T23:59:59",
    });
  });

  it("normalizes raw OCDS releases into the same canonical ranking", () => {
    const days = previousCompleteDays(NOW, 7);
    const shards = days.map((day, index) =>
      rankDailyAwards(
        index === 0 ? Array.from({ length: 100 }, (_, row) => rawRelease(row)) : [],
        day,
        NOW,
        { pagesFetched: 4, requestsMade: 4 },
      ),
    );
    const payload = buildContractsFromShards(shards, NOW)!;

    expect(payload.awards).toHaveLength(100);
    expect(payload.awards[0].noticeUrl).toMatch(/find-tender\.service\.gov\.uk\/Notice/);
    expect(payload.awards[0].buyerId).toBe("buyer-party-1");
    expect(payload.awards[0].supplierIds).toEqual(["supplier-party-1"]);
    expect(payload.summary.disclosedValueTotal).toBe(
      buildSummary(payload.awards).disclosedValueTotal
    );
    expect(payload.dataQuality.requestsMade).toBe(28);
    expect(isCurrentGovernmentContractsPayload(payload, NOW)).toBe(true);

    // Each supplier is classified only from the exact country name on its
    // cross-referenced OCDS party record.
    const nationsSeen = new Set(
      payload.awards.flatMap((award: { supplierNations: string[] }) => award.supplierNations)
    );
    expect(nationsSeen).toEqual(
      new Set(["Scotland", "Wales", "Northern Ireland", "England"])
    );
  });

  it("maps only exact publisher country names to UK nations", () => {
    expect(ukNationFromCountryName("Scotland")).toBe("Scotland");
    expect(ukNationFromCountryName(" Wales ")).toBe("Wales");
    expect(ukNationFromCountryName("Northern Ireland")).toBe("Northern Ireland");
    expect(ukNationFromCountryName("England")).toBe("England");
    expect(ukNationFromCountryName("United Kingdom")).toBeNull();
    expect(ukNationFromCountryName("Jersey")).toBeNull();
    expect(ukNationFromPostcode("SY1 1AA")).toBe("Other/Unknown");
    expect(ukNationFromPostcode("TD1 1AA")).toBe("Other/Unknown");
    expect(ukNationFromPostcode("JE1 1AA")).toBe("Other/Unknown");
  });

  it("defaults to Other/Unknown when there is no address-level nation evidence", () => {
    expect(ukNationFromPostcode("")).toBe("Other/Unknown");
    expect(ukNationFromPostcode(null)).toBe("Other/Unknown");
    expect(ukNationFromPostcode(undefined)).toBe("Other/Unknown");
    expect(ukNationFromPostcode("not a postcode")).toBe("Other/Unknown");
    expect(ukNationFromPostcode("12345")).toBe("Other/Unknown");
  });

  it("ranks the supplier concentration view by total disclosed value from existing awards only", () => {
    const payload = buildGovernmentContractsPayload(payloadInput(), NOW);
    const concentration = buildSupplierConcentration(payload.awards);

    expect(concentration.length).toBeGreaterThan(0);
    for (let index = 1; index < concentration.length; index += 1) {
      expect(concentration[index - 1].disclosedValue).toBeGreaterThanOrEqual(
        concentration[index].disclosedValue
      );
    }
    const total = concentration.reduce((sum, entry) => sum + entry.disclosedValue, 0);
    expect(Math.round(total)).toBe(Math.round(payload.summary.disclosedValueTotal));
    // The fixture awards all carry "Other/Unknown" supplierNations, so the
    // concentration view must fail closed to the same bucket rather than
    // inferring a nation from the supplier name.
    expect(concentration.every((entry) => entry.nation === "Other/Unknown")).toBe(true);
  });

  it("builds the payload's own supplierConcentration from its awards, deterministically", () => {
    const payload = buildGovernmentContractsPayload(payloadInput(), NOW);
    expect(payload.supplierConcentration).toEqual(buildSupplierConcentration(payload.awards));
  });
});
