// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  NHS_RTT_LANDING_PAGE,
  approvedNhsUrl,
  discoverNhsRttDataPage,
  discoverNhsRttPublicationLinks,
} from "@/worker/nhs-rtt-source-discovery";

const DATA_PAGE =
  "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/";
const WORKBOOK =
  "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/07/RTT-Overview-Timeseries-Including-Estimates-for-Missing-Trusts-May26-XLS-116K-3jBgba.xlsx";
const PRESS =
  "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/07/May26-RTT-statistical-press-notice-PDF-574K-3jBgba.pdf";

describe("NHS RTT runtime source discovery", () => {
  it("selects the newest annual RTT page from the permanent landing page", () => {
    const html = `
      <a href="/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2025-26/">2025-26 RTT waiting times data</a>
      <a href="/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/">2026-27 RTT waiting times data</a>
      <a href="https://data.england.nhs.uk/dashboard">Referral to Treatment dashboard</a>`;

    expect(discoverNhsRttDataPage(html)).toBe(DATA_PAGE);
  });

  it("accepts an absolute current annual link and normalizes its fragment", () => {
    const html = `<a href="${DATA_PAGE}#latest">2026-27 RTT waiting times data</a>`;
    expect(discoverNhsRttDataPage(html, NHS_RTT_LANDING_PAGE)).toBe(DATA_PAGE);
  });

  it("ignores legacy historical paths when a current approved page exists", () => {
    const html = `
      <a href="https://www.england.nhs.uk/statistics/rtt-data-2014-15/">2014-15 RTT waiting times data</a>
      <a href="${DATA_PAGE}">2026-27 RTT waiting times data</a>`;

    expect(discoverNhsRttDataPage(html, NHS_RTT_LANDING_PAGE)).toBe(DATA_PAGE);
  });

  it("selects the latest named workbook and press notice regardless of link order", () => {
    const html = `
      <a href="/statistics/wp-content/uploads/sites/2/2026/06/RTT-Overview-Timeseries-Including-Estimates-for-Missing-Trusts-Apr26.xlsx">RTT Overview Timeseries Including Estimates for Missing Trusts Apr26 (XLS)</a>
      <a href="${WORKBOOK}">RTT Overview Timeseries Including Estimates for Missing Trusts May26 (XLS)</a>
      <a href="${PRESS}">May26 RTT statistical press notice (PDF)</a>
      <a href="/statistics/wp-content/uploads/sites/2/2026/06/Apr26-RTT-statistical-press-notice.pdf">Apr26 RTT statistical press notice (PDF)</a>`;

    expect(discoverNhsRttPublicationLinks(html, DATA_PAGE)).toEqual({
      timeseriesUrl: WORKBOOK,
      pressNoticeUrl: PRESS,
    });
  });

  it("fails closed when required links are missing or ambiguous in date", () => {
    expect(() => discoverNhsRttDataPage("<p>No annual data link</p>")).toThrow(
      /did not expose a current annual data page/i
    );
    expect(() =>
      discoverNhsRttPublicationLinks(
        `<a href="/statistics/wp-content/uploads/sites/2/file.xlsx">RTT Overview Timeseries Including Estimates for Missing Trusts</a>
         <a href="/statistics/wp-content/uploads/sites/2/notice.pdf">RTT statistical press notice</a>`,
        DATA_PAGE
      )
    ).toThrow(/sortable month and year/i);
  });

  it("rejects lookalike external hosts and unexpected NHS paths", () => {
    expect(() =>
      discoverNhsRttDataPage(
        `<a href="https://example.org/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2027-28/">2027-28 RTT waiting times data</a>`
      )
    ).toThrow(/not hosted by NHS England/i);

    expect(() =>
      approvedNhsUrl(
        "https://www.england.nhs.uk/unrelated/file.pdf",
        DATA_PAGE,
        /^\/statistics\/wp-content\/uploads\/sites\/2\//,
        "NHS RTT asset"
      )
    ).toThrow(/expected NHS RTT path/i);
  });
});
