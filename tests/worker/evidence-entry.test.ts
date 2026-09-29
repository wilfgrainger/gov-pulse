// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function rawPayload() {
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
    history: Array.from({ length: 13 }, (_, index) => ({
      period: index === 12 ? "May 2026" : `Month ${index + 1}`,
      observedAt: index === 12 ? Date.UTC(2026, 5, 0) : Date.UTC(2025, index + 1, 0),
      ...Object.fromEntries(
        Object.entries(latestHistory).map(([field, latest]) => [
          field,
          index === 12 ? latest : latest - annualDelta[field as keyof typeof annualDelta],
        ])
      ),
    })),
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
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// NHS RTT is served in the live queue path by live-nhs-publication-collector.js;
// the doll's /ingest + enforceCurrentNhsRtt HTTP layer was removed in the worker
// flatten. Its fail-closed currentness contract lives in worker/nhs-rtt.js and is
// covered here (and in nhs-rtt.test.ts / nhs-press-notice-current.test.ts).
describe("NHS RTT currentness contract", () => {
  it("normalizes a raw payload and accepts it as current", () => {
    const data = normalizeNhsRttPayload(rawPayload(), new Date("2026-07-14T12:00:00Z"));
    expect(data).toMatchObject({
      available: true,
      headline: { period: "May 2026" },
    });
    expect(isCurrentNhsRttPayload(data, new Date("2026-07-14T12:00:00Z"))).toBe(true);
  });

  it("rejects the legacy mixed dashboard shape", () => {
    const legacy = {
      headline: { waitingList: 7.48, aePerformance: 71.4 },
      waitingTrend: [],
      lifeExpectancyTrend: [],
    };
    expect(isCurrentNhsRttPayload(legacy, new Date("2026-07-14T12:00:00Z"))).toBe(false);
  });

  it("fails closed once the publication is outside its currentness window", () => {
    const data = normalizeNhsRttPayload(rawPayload(), new Date("2026-07-14T12:00:00Z"));
    expect(isCurrentNhsRttPayload(data, new Date("2026-10-01T12:00:00Z"))).toBe(false);
  });
});
