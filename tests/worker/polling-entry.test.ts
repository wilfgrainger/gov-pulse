// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseOddscheckerRows } from "@/worker/live-betting-collector";
import { latestNhsLinks } from "@/worker/live-nhs-collector";
import {
  latestYouGovArticleUrl,
  commissionerFromArticle,
  headlineMethodFromPrimarySource,
  parsePublishedDate,
  parsePartyShares,
  pdfStrings,
  sampleSizeFromPdfText,
} from "@/worker/live-polling-collector";
import { parseNhsRttPressNotice } from "@/worker/nhs-press-notice";

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
    expect(sampleSizeFromPdfText("Sample Size: 2,328 GB Adults")).toBe(2328);
    expect(sampleSizeFromPdfText("Sample size: 2310 adults in GB")).toBe(2310);
  });

  it("requires an explicitly labelled publication date and commissioner", () => {
    expect(parsePublishedDate("Published: 27 July 2026; fieldwork was 26 July")).toBe("2026-07-27");
    expect(parsePublishedDate(
      '<span data-test="published-at" class="published-at">29 September 2026</span>'
    )).toBe("2026-09-29");
    expect(parsePublishedDate(
      '<span data-test="published-at" class="published-at">29 September 2026</span><p>Published: 28 September 2026</p>'
    )).toBe("2026-09-29");
    expect(() => parsePublishedDate("26 July 2026, voting intention results")).toThrow(/publication date/);
    expect(commissionerFromArticle("The latest poll for The Times and Sky News shows Reform at 22%."))
      .toBe("The Times and Sky News");
    expect(commissionerFromArticle("The latest poll for The Times and Sky News continues to show a close race."))
      .toBe("The Times and Sky News");
    expect(() => commissionerFromArticle("The latest YouGov result was published today."))
      .toThrow(/did not disclose the commissioner/);
  });

  it("supports only a primary-source-identified MRP headline method", () => {
    expect(headlineMethodFromPrimarySource(
      "Constituency vote intention from YouGov's MRP model",
      "https://example.test/VotingIntention_MRP_Results.pdf",
      ""
    )).toMatch(/MRP model/);
    expect(() => headlineMethodFromPrimarySource("Voting intention", "https://example.test/results.pdf", ""))
      .toThrow(/did not identify a supported headline method/);
  });

  it("reassembles fragmented PDF TJ text arrays before reading the sample", () => {
    const text = pdfStrings(
      "[(S)-5(a)-7(m)16(p)-6(l)5(e)-7( )5(S)-5(i)5(z)-8(e)-7(:)6( )5(2)-7(3)-7(2)-7(8)-7( )5(G)-3(B)-4( )5(A)49(d)-6(u)-6(l)5(t)6(s)] TJ"
    );

    expect(text).toBe("Sample Size: 2328 GB Adults");
    expect(sampleSizeFromPdfText(text)).toBe(2328);
  });

  it("rejects ambiguous or contradictory poll shares instead of taking the first mention", () => {
    expect(() => parsePartyShares("Conservative: 20% Labour: 20% Labour: 23% Liberal Democrats: 13% Reform UK: 24% Green: 13% Others: 7%"))
      .toThrow(/contradictory Labour/);
    expect(parsePartyShares("Conservative: 20% Labour: 20% Liberal Democrats: 13% Reform UK: 24% Green: 13% Others: 10%"))
      .toMatchObject({ conservative: 20, labour: 20, reformUK: 24 });
  });

  it("requires the exact GB-adult sample-size field in YouGov's primary table", () => {
    expect(() => sampleSizeFromPdfText("Sample Size is discussed below; 2328 GB Adults responded"))
      .toThrow(/did not expose a sample size/);
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
