// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  isCurrentNhsRttPayload,
  normalizeNhsRttPayload,
} from "@/worker/nhs-rtt";

const latestHistory = {
  medianWaitWeeks: 12.4,
  percentile92WaitWeeks: 38.6,
  within18WeeksPercent: 65.6,
  over52Weeks: 104_734,
  over65Weeks: 6_740,
  over78Weeks: 1_144,
  over104Weeks: 177,
  waitingPathwaysEstimate: 7_278_384,
  uniquePatientsEstimate: 6_157_633,
  admittedCompleted: 293_707,
  nonAdmittedCompleted: 1_133_648,
  newPathways: 1_725_997,
};

const annualDelta = {
  medianWaitWeeks: -1.2,
  percentile92WaitWeeks: -3.9,
  within18WeeksPercent: 4.7,
  over52Weeks: -92_105,
  over65Weeks: -4_733,
  over78Weeks: -93,
  over104Weeks: 17,
  waitingPathwaysEstimate: -77_566,
  uniquePatientsEstimate: -65_724,
  admittedCompleted: -19_093,
  nonAdmittedCompleted: -54_247,
  newPathways: -31_220,
};

function history() {
  return Array.from({ length: 13 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 4 + index, 1));
    const isLatest = index === 12;
    return {
      period: date.toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      observedAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      ...Object.fromEntries(
        Object.entries(latestHistory).map(([field, latest]) => [
          field,
          isLatest ? latest : latest - annualDelta[field as keyof typeof annualDelta],
        ])
      ),
    };
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  const { headline: rawHeadline, ...rootOverrides } = overrides;
  const headlineOverrides =
    (rawHeadline as Record<string, unknown> | undefined) ?? {};

  return {
    headline: {
      period: "May 2026",
      observedAt: Date.UTC(2026, 5, 0),
      publicationDate: "2026-07-09",
      waitingPathwaysEstimate: 7_300_000,
      waitingPathwaysDisplay: "7.3 million",
      uniquePatientsEstimate: 6_200_000,
      within18WeeksPercent: 65.6,
      standardPercent: 92,
      medianWaitWeeks: 12.4,
      percentile92WaitWeeks: 38.6,
      over52Weeks: 104_734,
      over65Weeks: 6_740,
      over78Weeks: 1_144,
      over104Weeks: 177,
      yearChangePercent: -1.1,
      yearChangePathways: -77_566,
      newPathways: 1_725_997,
      admittedCompleted: 293_707,
      nonAdmittedCompleted: 1_133_648,
      ...headlineOverrides,
    },
    specialties: [
      ["Trauma and Orthopaedic Service", 827_960, 60.1],
      ["Ophthalmology Service", 624_531, 74.1],
      ["Ear Nose and Throat Service", 594_331, 58.9],
      ["Gynaecology Service", 571_683, 60.9],
      ["General Surgery Service", 482_306, 66.2],
      ["Gastroenterology Service", 459_207, 61.2],
      ["Cardiology Service", 403_511, 64.8],
      ["Dermatology Service", 390_004, 69.7],
    ].map(([name, incompletePathways, within18WeeksPercent]) => ({
      name,
      incompletePathways,
      within18WeeksPercent,
    })),
    missingTrusts: [
      { name: "Sheffield Teaching Hospitals NHS Foundation Trust", code: "RHQ" },
      { name: "Torbay and South Devon NHS Foundation Trust", code: "RA9" },
    ],
    history: history(),
    annualDelta,
    methodology: {
      geography: "England",
      measure: "Incomplete consultant-led referral-to-treatment pathways",
      waitingListUnit: "pathways",
      peopleCaveat: "Some patients are on more than one pathway.",
      estimatesCaveat: "National headline figures include estimates for missing trusts.",
      revisionNote: "NHS England publishes periodic revisions.",
    },
    source: {
      publisher: "NHS England",
      landingUrl:
        "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
      dataPageUrl:
        "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/",
      pressNoticeUrl:
        "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/07/May26-RTT-statistical-press-notice-PDF-574K-3jBgba.pdf",
      timeseriesUrl:
        "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/07/RTT-Overview-Timeseries-May26.xlsx",
    },
    ...rootOverrides,
  };
}

const now = new Date("2026-07-14T12:00:00.000Z");

describe("NHS RTT evidence contract", () => {
  it("normalizes one complete current NHS England publication", () => {
    const result = normalizeNhsRttPayload(payload(), now);

    expect(result).toMatchObject({
      available: true,
      expiresAt: "2026-08-23T00:00:00.000Z",
      headline: {
        period: "May 2026",
        observedAt: Date.UTC(2026, 5, 0),
        publicationDate: "2026-07-09",
        waitingPathwaysEstimate: 7_300_000,
        uniquePatientsEstimate: 6_200_000,
        within18WeeksPercent: 65.6,
        yearChangePercent: -1.1,
        yearChangePathways: -77_566,
      },
      evidencePolicy: {
        sourceClass: "official-primary",
        headlineIncludesMissingTrustEstimates: true,
        specialtiesIncludeMissingTrustEstimates: false,
      },
      __observation: {
        status: "current",
        period: "May 2026",
        observedAt: "2026-05-31T00:00:00.000Z",
        maxAgeDays: 45,
      },
    });
    expect(result.specialties[0].name).toBe("Trauma and Orthopaedic Service");
    expect(isCurrentNhsRttPayload(result, now)).toBe(true);
  });

  it("expires evidence from the source publication date", () => {
    const result = normalizeNhsRttPayload(payload(), now);

    expect(isCurrentNhsRttPayload(result, new Date("2026-08-23T00:00:00Z"))).toBe(true);
    expect(isCurrentNhsRttPayload(result, new Date("2026-08-24T00:00:00Z"))).toBe(false);
    expect(() =>
      normalizeNhsRttPayload(payload(), new Date("2026-08-24T00:00:00Z"))
    ).toThrow(/older than 45 days/i);
  });

  it("rejects values that JavaScript would otherwise coerce", () => {
    expect(() =>
      normalizeNhsRttPayload(
        payload({ headline: { waitingPathwaysEstimate: "7300000" } }),
        now
      )
    ).toThrow(/waiting-pathway estimate must be an integer/i);

    expect(() =>
      normalizeNhsRttPayload(
        payload({ headline: { yearChangePathways: "-77566" } }),
        now
      )
    ).toThrow(/year change pathways must be an integer/i);
  });

  it("rejects an observation date that does not match the stated period", () => {
    expect(() =>
      normalizeNhsRttPayload(
        payload({ headline: { observedAt: Date.UTC(2026, 3, 30) } }),
        now
      )
    ).toThrow(/does not match the stated monthly period/i);
  });

  it("rejects non-monotonic long-wait thresholds", () => {
    expect(() =>
      normalizeNhsRttPayload(
        payload({ headline: { over78Weeks: 7_000 } }),
        now
      )
    ).toThrow(/thresholds are not monotonic/i);
  });

  it("rejects year-on-year values with opposite directions", () => {
    expect(() =>
      normalizeNhsRttPayload(
        payload({ headline: { yearChangePercent: -1.1, yearChangePathways: 77_566 } }),
        now
      )
    ).toThrow(/different directions/i);
  });

  it("rejects duplicate specialties and missing-trust codes", () => {
    const base = payload();
    expect(() =>
      normalizeNhsRttPayload(
        {
          ...base,
          specialties: [base.specialties[0], base.specialties[0], ...base.specialties.slice(2)],
        },
        now
      )
    ).toThrow(/duplicate NHS RTT specialty/i);

    expect(() =>
      normalizeNhsRttPayload(
        {
          ...base,
          missingTrusts: [base.missingTrusts[0], { ...base.missingTrusts[1], code: "RHQ" }],
        },
        now
      )
    ).toThrow(/duplicate missing trust code/i);
  });

  it("rejects non-NHS or insecure evidence URLs", () => {
    expect(() =>
      normalizeNhsRttPayload(
        payload({
          source: {
            ...payload().source,
            pressNoticeUrl: "https://example.com/nhs.pdf",
          },
        }),
        now
      )
    ).toThrow(/approved NHS England HTTPS URL/i);
  });
});
