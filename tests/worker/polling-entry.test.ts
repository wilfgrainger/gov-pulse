// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  enforceCurrentPolling,
  ingestAuthorized,
  normalizeElectionIngest,
  sectionDescriptors,
} from "@/worker/polling-entry";
import { normalizePrimaryPollPayload } from "@/worker/election-polls";
import { parseOddscheckerRows } from "@/worker/live-betting-collector";
import { latestNhsLinks } from "@/worker/live-nhs-collector";
import {
  latestYouGovArticleUrl,
  pdfStrings,
  sampleSizeFromPdfText,
} from "@/worker/live-polling-collector";
import { parseNhsRttPressNotice } from "@/worker/nhs-press-notice";

function rawPoll() {
  return {
    id: "yougov-2026-07-05-06-mrp-headline",
    pollster: "YouGov",
    commissioner: "YouGov",
    title: "Westminster voting intention from constituency vote projected by YouGov MRP",
    questionText: "Westminster voting intention from constituency vote projected by YouGov's MRP model",
    publicationDate: "2026-07-06",
    fieldworkStart: "2026-07-05",
    fieldworkEnd: "2026-07-06",
    sampleSize: 2285,
    geography: "Great Britain",
    population: "GB adults",
    mode: "Online panel; headline voting intention modelled using MRP",
    headlineMethod: "Headline voting intention from constituency vote projected by YouGov's MRP model",
    parties: {
      conservative: 20,
      labour: 20,
      liberalDemocrats: 13,
      reformUK: 24,
      green: 13,
      snp: 3,
      plaidCymru: 1,
      yourParty: 1,
      restoreBritain: 3,
      other: 2,
    },
    sourceUrl: "https://ygo-assets-websites-editorial-emea.yougov.net/documents/VotingIntention_MRP_Results_260706_w.pdf",
    methodologyUrl: "https://yougov.co.uk/about/panel-methodology",
    bpcMember: true,
    uncertainty: "Published estimates have an approximate 9-in-10 interval of plus or minus four points.",
  };
}

function currentData() {
  return normalizePrimaryPollPayload(
    { polls: [rawPoll()] },
    new Date("2026-07-14T12:00:00.000Z")
  );
}

const specialties = [
  "General Surgery Service 381,497 62.7%",
  "Urology Service 378,077 64.7%",
  "Trauma and Orthopaedic Service 827,960 60.1%",
  "Ear Nose and Throat Service 594,331 58.9%",
  "Ophthalmology Service 624,531 74.1%",
  "Oral Surgery Service 321,311 55.4%",
  "Neurosurgical Service 56,612 61.9%",
  "Plastic Surgery Service 102,390 58.1%",
].join(" ");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("primary polling production wrapper", () => {
  it("marks election polling ingest-only", () => {
    expect(sectionDescriptors.electionPolling.ingestOnly).toBe(true);
    expect(sectionDescriptors.electionPolling.source).toBe("Verified primary pollster publications");
  });

  it("authenticates before election payload validation", () => {
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: { "X-Refresh-Secret": "correct" },
    });

    expect(ingestAuthorized(request, { REFRESH_SECRET: "correct" })).toBe(true);
    expect(ingestAuthorized(request, { REFRESH_SECRET: "wrong" })).toBe(false);
    expect(ingestAuthorized(request, {})).toBe(false);
  });

  it("rewrites an election ingest with normalized evidence and source publication time", async () => {
    const request = new Request("https://worker.example/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "42",
        "X-Refresh-Secret": "secret",
      },
      body: JSON.stringify({ section: "electionPolling", data: { polls: [rawPoll()] } }),
    });

    const normalized = await normalizeElectionIngest(request);
    const payload = await normalized?.json();

    expect(normalized).not.toBeNull();
    expect(normalized?.headers.has("content-length")).toBe(false);
    expect(payload).toMatchObject({
      section: "electionPolling",
      fetchedAt: "2026-07-06T12:00:00.000Z",
      sourceLabel: "Verified primary pollster publications",
      backend: "scheduled-election-poll-ingest",
      data: {
        available: true,
        latestPublicationDate: "2026-07-06",
        aggregation: { method: "none" },
      },
    });
  });

  it("blocks the obsolete Worker refresh path", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/refresh?section=electionPolling", {
        method: "POST",
      }),
      {},
      { waitUntil: vi.fn() }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Section 'electionPolling' is ingest-only",
    });
  });

  it("exposes primary-only registry provenance", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/registry"),
      {},
      { waitUntil: vi.fn() }
    );
    const payload = await response.json();
    const feed = payload.feeds.electionPolling;

    expect(feed).toMatchObject({
      retrieval: "scheduled-publication-check",
      operationalStatus: "active",
      publicationCadence: "as published",
    });
    expect(feed.upstreams.map((source: { publisher: string }) => source.publisher)).toEqual([
      "YouGov",
      "British Polling Council",
    ]);
    expect(JSON.stringify(feed)).not.toContain("Wikipedia");
  });

  it("passes a current primary payload and rejects expired or legacy polling data", async () => {
    const request = new Request("https://worker.example/metrics?section=electionPolling");
    const current = new Response(
      JSON.stringify({ section: "electionPolling", data: currentData() }),
      { headers: { "Content-Type": "application/json" } }
    );

    await expect(enforceCurrentPolling(request, current)).resolves.toBe(current);

    const legacy = new Response(
      JSON.stringify({
        section: "electionPolling",
        data: { pollingData: [{ party: "LAB", pct: 20 }], recentPolls: [] },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
    const rejected = await enforceCurrentPolling(request, legacy);
    expect(rejected.status).toBe(503);
    await expect(rejected.json()).resolves.toMatchObject({
      details: "No current verified primary poll publication is available",
    });
  });

  it("fails closed when the section response claims JSON but is malformed", async () => {
    const response = await enforceCurrentPolling(
      new Request("https://worker.example/metrics?section=electionPolling"),
      new Response("not-json", {
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unable to fetch section 'electionPolling'",
      details: "Invalid JSON response from upstream",
    });
  });

  it("removes expired polling from the combined dataset", async () => {
    const response = new Response(
      JSON.stringify({
        electionPolling: { pollingData: [{ party: "REF", pct: 28 }] },
        meta: {
          sources: {
            electionPolling: { status: "ok", cacheState: "fresh" },
          },
        },
      }),
      { headers: { "Content-Type": "application/json", "Content-Length": "10" } }
    );

    const result = await enforceCurrentPolling(
      new Request("https://worker.example/all"),
      response
    );
    const payload = await result.json();

    expect(payload).not.toHaveProperty("electionPolling");
    expect(payload.meta.sources.electionPolling).toMatchObject({
      status: "error",
      cacheState: "expired",
    });
    expect(result.headers.has("content-length")).toBe(false);
  });

  it("fails closed when the combined response claims JSON but is malformed", async () => {
    const response = await enforceCurrentPolling(
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

describe("live publisher parsers", () => {
  it("reads server-rendered Oddschecker rows without a browser", () => {
    expect(
      parseOddscheckerRows(`
        <tr data-bname="Candidate B" data-best-dig="4.0"></tr>
        <tr data-bname="Candidate A" data-best-dig="2.5"></tr>
      `)
    ).toEqual([
      { name: "Candidate A", decimalOdds: 2.5 },
      { name: "Candidate B", decimalOdds: 4 },
    ]);
  });

  it("selects the newest YouGov voting-intention article and sample", () => {
    const article = latestYouGovArticleUrl(`
      <a href="/en-gb/articles/55200-voting-intention-old">Old</a>
      <a href="/en-gb/articles/55251-voting-intention-26-27-july-2026">New</a>
    `);
    expect(article).toContain("/55251-voting-intention-26-27-july-2026");
    expect(sampleSizeFromPdfText("Sample Size: 2328 GB Adults")).toBe(2328);
  });

  it("reassembles fragmented PDF TJ text arrays before reading the sample", () => {
    const text = pdfStrings(
      "[(S)-5(a)-7(m)16(p)-6(l)5(e)-7( )5(S)-5(i)5(z)-8(e)-7(:)6( )5(2)-7(3)-7(2)-7(8)-7( )5(G)-3(B)-4( )5(A)49(d)-6(u)-6(l)5(t)6(s)] TJ"
    );

    expect(text).toBe("Sample Size: 2328 GB Adults");
    expect(sampleSizeFromPdfText(text)).toBe(2328);
  });

  it("discovers and parses one complete NHS England RTT release", () => {
    const links = latestNhsLinks(`
      <a href="/timeseries.xlsx">RTT Overview Timeseries Including Estimates for Missing Trusts May26</a>
      <a href="/notice.pdf">May26 RTT statistical press notice</a>
    `);
    expect(links.timeseriesUrl).toContain("timeseries.xlsx");
    expect(links.pressNoticeUrl).toContain("notice.pdf");

    const result = parseNhsRttPressNotice(`
      Thursday 9 July 2026 Statistical Press Notice
      NHS referral to treatment (RTT) waiting times data May 2026.
      Missing data for May 2026 Sheffield Teaching Hospitals NHS Foundation Trust (RHQ)
      and Torbay and South Devon NHS Foundation Trust (RA9) did not submit any RTT data.
      The number of RTT pathways where a patient was waiting to start treatment at the end of
      May 2026 was 7.3 million. The number of unique patients is estimated to be around 6.2 million.
      Among these, in 104,734 cases the patient was waiting more than 52 weeks, in 6,740 cases
      they were waiting more than 65 weeks, in 1,144 cases they were waiting more than 78 weeks,
      and in 177 cases they were waiting more than 104 weeks. In 65.6% of cases the patient had
      been waiting up to 18 weeks. During May 2026, 1,725,997 new RTT pathways were started.
      During May 2026, 293,707 pathways were completed as a result of admitted treatment and
      1,133,648 were completed in other ways (non-admitted). The median waiting time was 12.4 weeks.
      The 92nd percentile waiting time was 38.6 weeks. Incomplete pathways) at the end of May 2026
      decreased by 1.1% (77,566) compared to the end of May 2025. ${specialties}
    `);
    expect(result.headline).toMatchObject({
      period: "May 2026",
      waitingPathwaysEstimate: 7_300_000,
      over52Weeks: 104_734,
      yearChangePathways: -77_566,
    });
    expect(result.specialties).toHaveLength(8);
    expect(result.missingTrusts).toHaveLength(2);
  });

  it("repairs the split glyph spacing emitted by the current NHS PDF", () => {
    const result = parseNhsRttPressNotice(`
      Thursday 9 July 2026 Statistical Press Notice
      NHS referral to treatment (RTT) waiting times data May 2026.
      Missing d ata for May 2026 Sheffield Teaching Hospitals NHS Foundation Trust (RHQ)
      and Torbay and South Devon NHS Foundation Trust (RA9) did not submit any RTT data.
      The number of RTT pathways where a patient was waiting to start treatment at the end of
      May 2026 was 7. 3 million. The number of unique patients is estimated to be around 6. 2 million.
      Among these, in 104,734 cases the patient was waiting more than 52 weeks, in 6,740 cases
      they were waiting more than 65 weeks, in 1,144 cases they were waiting more than 78 weeks,
      and in 177 cases they were waiting more than 104 weeks. In 65. 6 % of cases the patient had
      been waiting up to 18 weeks. During May 2026 , 1,725,997 new R TT pathway s were started.
      During May 2026 , 293,707 pathways were completed as a result of admitted treatment and
      1,133,648 were completed in other ways (non - admitted). The median waiting time was 1 2.4 weeks.
      The 92nd percentile waiting time was 38. 6 weeks. The number of pathways where the patient was
      waiting to start treatment (inco m plete pathways) at the end of May 2026 decreased b y 1. 1 %
      ( 77,566 ) compared to the end of May 2025. ${specialties}
    `);

    expect(result.headline).toMatchObject({
      publicationDate: "2026-07-09",
      waitingPathwaysEstimate: 7_300_000,
      within18WeeksPercent: 65.6,
      medianWaitWeeks: 12.4,
      yearChangePercent: -1.1,
      newPathways: 1_725_997,
    });
    expect(result.missingTrusts).toHaveLength(2);
  });
});
