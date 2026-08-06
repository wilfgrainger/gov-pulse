// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  BOE_BANK_RATE_URL,
  SERIES_DEFINITIONS,
  buildEconomicIndicators,
  isEconomicIndicatorsPayload,
  parseBankRateHtml,
  parseOnsMonthlyCsv,
  parseOnsPublicationPage,
  rollingThreeMonthPeriod,
} from "@/worker/economic-indicators";

const CPI_CSV = `Title,CPI annual rate
"2026 MAR","2.6"
"2026 APR","2.8"
"2026 MAY","3.4"`;

const UNEMPLOYMENT_CSV = `Title,Unemployment rate
"2026 JAN","5.1"
"2026 FEB","5.0"
"2026 MAR","4.9"`;

const CPI_PAGE = `
  <main>
    <p>Release date: 17 June 2026</p>
    <p>Next release: 22 July 2026</p>
  </main>`;

const UNEMPLOYMENT_PAGE = `
  <main>
    <p>Release date: 18 June 2026</p>
    <p>Next release: 16 July 2026</p>
  </main>`;

const BANK_RATE_PAGE = `
  <table><tbody>
    <tr><td>07 Aug 25</td><td>4.00</td></tr>
    <tr><td>18 Dec 25</td><td>3.75</td></tr>
  </tbody></table>`;

function fetchFixture(input: RequestInfo | URL) {
  const url = String(input);
  if (url.includes("generator") && url.includes("d7g7")) {
    return Promise.resolve(new Response(CPI_CSV, { status: 200 }));
  }
  if (url === SERIES_DEFINITIONS.inflation.sourceUrl) {
    return Promise.resolve(new Response(CPI_PAGE, { status: 200 }));
  }
  if (url.includes("generator") && url.includes("mgsx")) {
    return Promise.resolve(new Response(UNEMPLOYMENT_CSV, { status: 200 }));
  }
  if (url === SERIES_DEFINITIONS.unemployment.sourceUrl) {
    return Promise.resolve(new Response(UNEMPLOYMENT_PAGE, { status: 200 }));
  }
  if (url === BOE_BANK_RATE_URL) {
    return Promise.resolve(new Response(BANK_RATE_PAGE, { status: 200 }));
  }
  return Promise.resolve(new Response("missing", { status: 404 }));
}

describe("series-level economic indicators", () => {
  it("parses ONS monthly observations without annual or quarterly rows", () => {
    const points = parseOnsMonthlyCsv(`
      "2025","2.4"
      "2026 Q1","0.7"
      "2026 JAN","3.0"
      "2026 FEB","3.2"
    `);

    expect(points).toEqual([
      {
        rawPeriod: "2026 JAN",
        year: 2026,
        month: 0,
        observedAt: "2026-01-31T00:00:00.000Z",
        value: 3,
      },
      {
        rawPeriod: "2026 FEB",
        year: 2026,
        month: 1,
        observedAt: "2026-02-28T00:00:00.000Z",
        value: 3.2,
      },
    ]);
  });

  it("rejects duplicate ONS periods", () => {
    expect(() =>
      parseOnsMonthlyCsv(`"2026 MAY","3.4"\n"2026 MAY","3.5"`)
    ).toThrow(/duplicate period '2026 MAY'/i);
  });

  it("parses ONS release and next-release dates", () => {
    expect(parseOnsPublicationPage(CPI_PAGE)).toEqual({
      publishedAt: "2026-06-17",
      nextRelease: "2026-07-22",
    });
  });

  it("parses Bank Rate as event-dated history", () => {
    expect(parseBankRateHtml(BANK_RATE_PAGE)).toEqual([
      {
        period: "7 August 2025",
        observedAt: "2025-08-07T00:00:00.000Z",
        value: 4,
      },
      {
        period: "18 December 2025",
        observedAt: "2025-12-18T00:00:00.000Z",
        value: 3.75,
      },
    ]);
  });

  it("formats rolling three-month periods across year boundaries", () => {
    expect(
      rollingThreeMonthPeriod({ year: 2026, month: 0 })
    ).toBe("November 2025 to January 2026");
  });

  it("builds three independent official series with separate clocks", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const fetchImpl = vi.fn(fetchFixture);
    const data = await buildEconomicIndicators(fetchImpl, () => now);

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(data.order).toEqual(["inflation", "bankRate", "unemployment"]);
    expect(data.series.inflation).toMatchObject({
      value: 3.4,
      period: "May 2026",
      observedAt: "2026-05-31T00:00:00.000Z",
      publishedAt: "2026-06-17T00:00:00.000Z",
      retrievedAt: now.toISOString(),
      publisher: "Office for National Statistics",
      seriesId: "D7G7",
      datasetId: "MM23",
    });
    expect(data.series.bankRate).toMatchObject({
      value: 3.75,
      period: "18 December 2025",
      observedAt: "2025-12-18T00:00:00.000Z",
      publishedAt: "2025-12-18T00:00:00.000Z",
      publisher: "Bank of England",
      seriesId: "IUDBEDR",
    });
    expect(data.series.unemployment).toMatchObject({
      value: 4.9,
      period: "January 2026 to March 2026",
      observedAt: "2026-03-31T00:00:00.000Z",
      publishedAt: "2026-06-18T00:00:00.000Z",
      seriesId: "MGSX",
      datasetId: "LMS",
    });
    expect(data.methodology.alignment).toMatch(/does not carry values forward/i);
    expect(data).not.toHaveProperty("economicData");
    expect(data).not.toHaveProperty("metricConfig");
    expect(isEconomicIndicatorsPayload(data, now)).toBe(true);
  });

  it("fails closed when any official source is unavailable", async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("mgsx")) {
        return Promise.resolve(new Response("unavailable", { status: 503 }));
      }
      return fetchFixture(input);
    });

    await expect(
      buildEconomicIndicators(fetchImpl, () => new Date("2026-07-14T12:00:00.000Z"))
    ).rejects.toThrow(/official source returned 503/i);
  });

  it("rejects legacy mixed-panel payloads", () => {
    expect(
      isEconomicIndicatorsPayload(
        {
          economicData: [{ date: "Jan 26", inflation: 3, bankRate: 3.75 }],
          metricConfig: { inflation: { current: "3.0%" } },
        },
        new Date("2026-07-14T12:00:00.000Z")
      )
    ).toBe(false);
  });
});
