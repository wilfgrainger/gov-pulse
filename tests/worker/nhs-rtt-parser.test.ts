// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  discoverRttDataPageUrl,
  discoverRttPressNoticeUrl,
  discoverRttTimeseriesUrl,
  parseNhsRttPressNotice,
} from "../../scripts/nhs-rtt-parser.mjs";

const landingUrl =
  "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/";
const dataPageUrl =
  "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/";
const pressNoticeUrl =
  "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/07/May26-RTT-statistical-press-notice-PDF-574K-3jBgba.pdf";

const pressNotice = `
NHS referral to treatment (RTT) waiting times data May 2026
Thursday 9 July 2026

The number of RTT pathways where a patient was waiting to start treatment at the end of May 2026 was 7.3 million. The number of unique patients is estimated to be around 6.2 million.

In 104,734 cases the patient was waiting more than 52 weeks, in 6,740 cases they were waiting more than 65 weeks, in 1,144 cases they were waiting more than 78 weeks, and in 177 cases they were waiting more than 104 weeks.

In 65.6% of cases the patient had been waiting up to 18 weeks. The median waiting time was 12.4 weeks. The 92nd percentile waiting time was 38.6 weeks.

The total number of patients waiting to start consultant-led elective treatment (incomplete pathways) at the end of May 2026 decreased by 1.1% (77,566) compared to the end of May 2025.

During May 2026, 1,725,997 new RTT pathways were started. 293,707 pathways were completed as a result of admitted treatment and 1,133,648 were completed in other ways (non-admitted).

General Surgery Service 482,306 66.2%
Urology Service 388,104 63.3%
Trauma and Orthopaedic Service 827,960 60.1%
Ear Nose and Throat Service 594,331 58.9%
Ophthalmology Service 624,531 74.1%
Oral Surgery Service 320,431 68.4%
Gastroenterology Service 459,207 61.2%
Cardiology Service 403,511 64.8%
Dermatology Service 390,004 69.7%
Gynaecology Service 571,683 60.9%

Missing data for May 2026 Sheffield Teaching Hospitals NHS Foundation Trust (RHQ) and Torbay and South Devon NHS Foundation Trust (RA9) did not submit any RTT data.
`;

describe("NHS RTT source discovery", () => {
  it("selects the newest annual data page regardless of link order", () => {
    const html = `
      <a href="/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2025-26/">
        2025-26 RTT waiting times data
      </a>
      <a href="/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/">
        2026-27 RTT waiting times data
      </a>`;

    expect(discoverRttDataPageUrl(html, landingUrl)).toBe(dataPageUrl);
  });

  it("selects the newest press notice regardless of chronological link order", () => {
    const aprilUrl =
      "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/06/Apr26-RTT-statistical-press-notice.pdf";
    const html = `
      <a href="${aprilUrl}">April 2026 RTT statistical press notice (PDF)</a>
      <a href="${pressNoticeUrl}">May 2026 RTT statistical press notice (PDF)</a>`;

    expect(discoverRttPressNoticeUrl(html, dataPageUrl)).toBe(pressNoticeUrl);
  });

  it("can rank a press notice when only the PDF filename carries the month", () => {
    const aprilUrl =
      "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/06/Apr26-RTT-statistical-press-notice.pdf";
    const html = `
      <a href="${pressNoticeUrl}">RTT statistical press notice (PDF)</a>
      <a href="${aprilUrl}">RTT statistical press notice (PDF)</a>`;

    expect(discoverRttPressNoticeUrl(html, dataPageUrl)).toBe(pressNoticeUrl);
  });

  it("selects the newest official overview time-series workbook", () => {
    const html = `
      <a href="/files/RTT-Overview-Timeseries-Apr26-XLS.xlsx">RTT Overview Timeseries Including Estimates for Missing Trusts Apr26</a>
      <a href="/files/RTT-Overview-Timeseries-May26-XLS.xlsx">RTT Overview Timeseries Including Estimates for Missing Trusts May26</a>`;

    expect(discoverRttTimeseriesUrl(html, dataPageUrl)).toBe(
      "https://www.england.nhs.uk/files/RTT-Overview-Timeseries-May26-XLS.xlsx"
    );
  });

  it("fails closed when the rolling pages do not expose the required links", () => {
    expect(() => discoverRttDataPageUrl("<p>No data</p>", landingUrl)).toThrow(
      /did not expose a current annual data page/i
    );
    expect(() => discoverRttPressNoticeUrl("<p>No PDF</p>", dataPageUrl)).toThrow(
      /did not expose a latest statistical press notice PDF/i
    );
  });
});

describe("NHS RTT press notice parser", () => {
  it("parses one coherent May 2026 RTT publication", () => {
    const result = parseNhsRttPressNotice(pressNotice, {
      landingUrl,
      dataPageUrl,
      pressNoticeUrl,
    });

    expect(result).toMatchObject({
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
      missingTrusts: [
        { name: "Sheffield Teaching Hospitals NHS Foundation Trust", code: "RHQ" },
        { name: "Torbay and South Devon NHS Foundation Trust", code: "RA9" },
      ],
      source: { pressNoticeUrl },
    });
    expect(result.specialties).toHaveLength(8);
    expect(result.specialties[0]).toEqual({
      name: "Trauma and Orthopaedic Service",
      incompletePathways: 827_960,
      within18WeeksPercent: 60.1,
    });
  });

  it("supports zero, one or more missing-trust disclosures", () => {
    const withoutMissing = parseNhsRttPressNotice(
      pressNotice.replace(/Missing data for May 2026[^.]+\./, ""),
      { landingUrl, dataPageUrl, pressNoticeUrl }
    );
    expect(withoutMissing.missingTrusts).toEqual([]);

    const oneMissing = parseNhsRttPressNotice(
      pressNotice.replace(
        /Missing data for May 2026[^.]+\./,
        "Missing data for May 2026 Example NHS Trust (AAA) did not submit any RTT data."
      ),
      { landingUrl, dataPageUrl, pressNoticeUrl }
    );
    expect(oneMissing.missingTrusts).toEqual([
      { name: "Example NHS Trust", code: "AAA" },
    ]);

    const threeMissing = parseNhsRttPressNotice(
      pressNotice.replace(
        /Missing data for May 2026[^.]+\./,
        "Missing data for May 2026 First NHS Trust (AAA), Second NHS Trust (BBB) and Third NHS Trust (CCC) did not submit any RTT data."
      ),
      { landingUrl, dataPageUrl, pressNoticeUrl }
    );
    expect(threeMissing.missingTrusts).toEqual([
      { name: "First NHS Trust", code: "AAA" },
      { name: "Second NHS Trust", code: "BBB" },
      { name: "Third NHS Trust", code: "CCC" },
    ]);
  });

  it("preserves an increase as a positive year-on-year change", () => {
    const result = parseNhsRttPressNotice(
      pressNotice.replace("decreased by 1.1% (77,566)", "increased by 0.8% (55,000)"),
      { landingUrl, dataPageUrl, pressNoticeUrl }
    );

    expect(result.headline.yearChangePercent).toBe(0.8);
    expect(result.headline.yearChangePathways).toBe(55_000);
  });

  it("fails closed when core evidence or enough treatment functions are absent", () => {
    expect(() =>
      parseNhsRttPressNotice(
        pressNotice.replace(
          "In 65.6% of cases the patient had been waiting up to 18 weeks.",
          ""
        ),
        { landingUrl, dataPageUrl, pressNoticeUrl }
      )
    ).toThrow(/within-18-weeks percentage/i);

    expect(() =>
      parseNhsRttPressNotice(
        pressNotice
          .replace(/General Surgery Service[^\n]+\n/g, "")
          .replace(/Urology Service[^\n]+\n/g, "")
          .replace(/Oral Surgery Service[^\n]+\n/g, ""),
        { landingUrl, dataPageUrl, pressNoticeUrl }
      )
    ).toThrow(/treatment-function rows/i);
  });
});
