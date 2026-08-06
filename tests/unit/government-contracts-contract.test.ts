import { describe, expect, it } from "vitest";
import {
  CAVEATS,
  EVIDENCE_POLICY,
  buildGovernmentContractsPayload,
  buildSummary,
  isCurrentGovernmentContractsPayload,
} from "../../contracts/government-contracts.js";
import {
  completeUtcWindow,
  rankAwards,
  slicedWindow,
} from "../../scripts/prepare-government-contracts-ingest.mjs";

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
    suppliers: [`Supplier ${(index % 25) + 1}`],
    awardDate: `2026-07-${String((index % 17) + 1).padStart(2, "0")}T09:00:00.000Z`,
    publishedAt: `2026-07-${String((index % 17) + 1).padStart(2, "0")}T12:00:00.000Z`,
    amount: 1_000_000_000 - index * 1_000_000,
    currency: "GBP" as const,
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

function rawRelease(index: number) {
  const award = canonicalAward(index);
  return {
    ocid: award.ocid,
    id: award.releaseId,
    date: award.publishedAt,
    buyer: { name: award.buyer },
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
        date: award.awardDate,
        value: { amount: award.amount, currency: award.currency },
        suppliers: award.suppliers.map((name) => ({ name })),
      },
    ],
  };
}

describe("government contracts contract", () => {
  it("publishes exactly 100 ranked comparable GBP awards", () => {
    const payload = buildGovernmentContractsPayload(payloadInput(), NOW);

    expect(payload.awards).toHaveLength(100);
    expect(payload.awards[0].rank).toBe(1);
    expect(payload.awards[99].rank).toBe(100);
    expect(payload.awards[0].amount).toBeGreaterThan(payload.awards[99].amount);
    expect(payload.summary.awardCount).toBe(100);
    expect(payload.summary.explicitDirectAwards).toBe(10);
    expect(isCurrentGovernmentContractsPayload(payload, NOW)).toBe(true);
  });

  it("fails closed when the complete window cannot supply 100 awards", () => {
    expect(() => buildGovernmentContractsPayload(payloadInput(99), NOW)).toThrow(
      /exactly 100 awards/i
    );
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
    const window = completeUtcWindow(NOW);
    const slices = slicedWindow(window);

    expect(window.label).toBe("11 Jul 2026 to 17 Jul 2026");
    expect(slices).toHaveLength(28);
    expect(slices[0]).toEqual({
      apiFrom: "2026-07-11T00:00:00",
      apiTo: "2026-07-11T05:59:59",
    });
    expect(slices[27]).toEqual({
      apiFrom: "2026-07-17T18:00:00",
      apiTo: "2026-07-17T23:59:59",
    });
  });

  it("normalizes raw OCDS releases into the same canonical ranking", () => {
    const payload = rankAwards(
      Array.from({ length: 100 }, (_, index) => rawRelease(index)),
      28,
      NOW,
      28
    );

    expect(payload.awards).toHaveLength(100);
    expect(payload.awards[0].noticeUrl).toMatch(/find-tender\.service\.gov\.uk\/Notice/);
    expect(payload.summary.disclosedValueTotal).toBe(
      buildSummary(payload.awards).disclosedValueTotal
    );
    expect(payload.dataQuality.requestsMade).toBe(28);
    expect(isCurrentGovernmentContractsPayload(payload, NOW)).toBe(true);
  });
});
