// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  enforceCurrentNhsRtt,
  normalizeNhsIngest,
  sectionDescriptors,
} from "@/worker/evidence-entry";
import { normalizeNhsRttPayload } from "@/worker/nhs-rtt";

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

function currentData() {
  return normalizeNhsRttPayload(rawPayload(), new Date("2026-07-14T12:00:00Z"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("NHS RTT production wrapper", () => {
  it("marks NHS statistics ingest-only", () => {
    expect(sectionDescriptors.nhsStats.ingestOnly).toBe(true);
    expect(sectionDescriptors.nhsStats.source).toBe(
      "NHS England RTT statistical press notice"
    );
  });

  it("rewrites an authenticated NHS ingest using the source publication date", async () => {
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "100",
        "X-Refresh-Secret": "secret",
      },
      body: JSON.stringify({ section: "nhsStats", data: rawPayload() }),
    });

    const normalized = await normalizeNhsIngest(request);
    const body = await normalized?.json();

    expect(normalized).not.toBeNull();
    expect(normalized?.headers.has("content-length")).toBe(false);
    expect(body).toMatchObject({
      section: "nhsStats",
      fetchedAt: "2026-07-09T12:00:00.000Z",
      sourceLabel: "NHS England RTT statistical press notice",
      backend: "scheduled-nhs-ingest",
      data: {
        available: true,
        headline: { period: "May 2026" },
      },
    });
  });

  it("blocks the obsolete direct refresh path", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/refresh?section=nhsStats", {
        method: "POST",
      }),
      {},
      { waitUntil: vi.fn() }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Section 'nhsStats' is ingest-only",
    });
  });

  it("passes a current RTT payload and rejects the legacy mixed dashboard", async () => {
    const request = new Request("https://worker.example/metrics?section=nhsStats");
    const current = new Response(
      JSON.stringify({ section: "nhsStats", data: currentData() }),
      { headers: { "Content-Type": "application/json" } }
    );
    await expect(enforceCurrentNhsRtt(request, current)).resolves.toBe(current);

    const legacy = new Response(
      JSON.stringify({
        section: "nhsStats",
        data: {
          headline: { waitingList: 7.48, aePerformance: 71.4 },
          waitingTrend: [],
          lifeExpectancyTrend: [],
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
    const rejected = await enforceCurrentNhsRtt(request, legacy);
    expect(rejected.status).toBe(503);
    await expect(rejected.json()).resolves.toMatchObject({
      details: "No current verified NHS England RTT publication is available",
    });
  });

  it("fails closed when the NHS section response is malformed JSON", async () => {
    const response = await enforceCurrentNhsRtt(
      new Request("https://worker.example/metrics?section=nhsStats"),
      new Response("not-json", {
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unable to fetch section 'nhsStats'",
      details: "Invalid JSON response from upstream",
    });
  });

  it("removes invalid NHS data from the combined dataset", async () => {
    const response = new Response(
      JSON.stringify({
        nhsStats: { headline: { waitingList: 7.48 } },
        meta: {
          sources: {
            nhsStats: { status: "ok", cacheState: "fresh" },
          },
        },
      }),
      { headers: { "Content-Type": "application/json", "Content-Length": "10" } }
    );

    const result = await enforceCurrentNhsRtt(
      new Request("https://worker.example/all"),
      response
    );
    const body = await result.json();

    expect(body).not.toHaveProperty("nhsStats");
    expect(body.meta.sources.nhsStats).toMatchObject({
      status: "error",
      cacheState: "expired",
    });
    expect(result.headers.has("content-length")).toBe(false);
  });

  it("fails closed when the combined response is malformed JSON", async () => {
    const response = await enforceCurrentNhsRtt(
      new Request("https://worker.example/all"),
      new Response("not-json", {
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unable to fetch combined metrics",
      details: "Invalid JSON response from upstream",
    });
  });
});
