// @vitest-environment node

import { describe, expect, it } from "vitest";
import { normalizeNhsRttPayload } from "@/worker/nhs-rtt";
import {
  KV_KEY,
  PUBLICATION_SECTION_PREFIX,
  buildKvRecord,
} from "@/scripts/trusted-nhs-rtt-ingest.mjs";

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
          isLatest ? latest : latest - annualDelta[field],
        ])
      ),
    };
  });
}

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
  };
}

const now = new Date("2026-07-14T12:00:00.000Z");

describe("trusted-nhs-rtt-ingest KV record shape", () => {
  it("builds the exact drop-in record the Worker's own collector would write", () => {
    const data = normalizeNhsRttPayload(rawPayload(), now);
    const record = buildKvRecord(data, now);

    expect(KV_KEY).toBe(`${PUBLICATION_SECTION_PREFIX}nhsStats`);
    expect(KV_KEY).toBe("v12:publication:section:nhsStats");

    // Matches worker/live-feed-common.js's sectionRecord() output shape
    // exactly — section/data/fetchedAt/source/sourceLabel/backend — so the
    // Worker's publicationFragments() -> mergePublication() read path
    // consumes this unchanged.
    expect(record).toMatchObject({
      section: "nhsStats",
      data,
      fetchedAt: now.toISOString(),
      sourceLabel: "NHS England RTT press notice and overview time-series workbook",
      backend: "cloudflare-official-publication",
      source: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: now.toISOString(),
        backend: "cloudflare-official-publication",
        source: "NHS England RTT press notice and overview time-series workbook",
      },
    });
    expect(record.source.provenance).toMatchObject({ section: "nhsStats" });
  });

  it("refuses to build a record for evidence outside its currentness window", () => {
    const data = normalizeNhsRttPayload(rawPayload(), now);
    const staleNow = new Date("2026-09-01T00:00:00.000Z");

    expect(() => buildKvRecord(data, staleNow)).toThrow(/currentness window/i);
  });
});
