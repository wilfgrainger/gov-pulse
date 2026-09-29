// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SECTION_BUILDERS,
  buildCurrentEconomicIndicators,
} from "@/worker/section-builders";
import {
  BOE_BANK_RATE_URL,
  SERIES_DEFINITIONS,
} from "@/worker/economic-indicators";

const CPI_CSV = `"2026 APR","2.8"\n"2026 MAY","3.4"`;
const UNEMPLOYMENT_CSV = `"2026 FEB","5.0"\n"2026 MAR","4.9"`;
const CPI_PAGE = `<p>Release date: 17 June 2026</p><p>Next release: 22 July 2026</p>`;
const UNEMPLOYMENT_PAGE = `<p>Release date: 18 June 2026</p><p>Next release: 16 July 2026</p>`;
const BANK_RATE_PAGE = `<table><tbody><tr><td>18 Dec 25</td><td>3.75</td></tr></tbody></table>`;

function fetchFixture(input: RequestInfo | URL) {
  const url = String(input);
  if (url.includes("generator") && url.includes("d7g7")) {
    return Promise.resolve(new Response(CPI_CSV));
  }
  if (url === SERIES_DEFINITIONS.inflation.sourceUrl) {
    return Promise.resolve(new Response(CPI_PAGE));
  }
  if (url.includes("generator") && url.includes("mgsx")) {
    return Promise.resolve(new Response(UNEMPLOYMENT_CSV));
  }
  if (url === SERIES_DEFINITIONS.unemployment.sourceUrl) {
    return Promise.resolve(new Response(UNEMPLOYMENT_PAGE));
  }
  if (url === BOE_BANK_RATE_URL) {
    return Promise.resolve(new Response(BANK_RATE_PAGE));
  }
  return Promise.resolve(new Response("missing", { status: 404 }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
  vi.stubGlobal("fetch", vi.fn(fetchFixture));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sentiment pulse section builder", () => {
  it("builds a strict section record with a real three-series period summary", async () => {
    const record = await SECTION_BUILDERS.sentimentPulse(
      new Date("2026-07-14T12:00:00.000Z")
    );

    expect(record).toMatchObject({
      section: "sentimentPulse",
      backend: "verified-data-service-series-contract",
      data: {
        available: true,
        series: {
          inflation: { seriesId: "D7G7" },
          bankRate: { seriesId: "IUDBEDR" },
          unemployment: { seriesId: "MGSX" },
        },
        __observation: {
          status: "current",
          period:
            "Inflation May 2026 · Bank Rate 18 December 2025 · Unemployment February 2026 to April 2026",
          observedAt: "2026-05-31T00:00:00.000Z",
          checkedAt: "2026-07-14T12:00:00.000Z",
          maxAgeDays: 75,
        },
      },
    });
    expect(record.data.__provenance.section).toBe("sentimentPulse");
    expect(record.source).toMatchObject({ status: "ok", cacheState: "fresh" });
  });

  it("enforces publication currentness inside the shared refresh builder", async () => {
    await expect(
      buildCurrentEconomicIndicators(fetchFixture, () =>
        new Date("2026-09-05T12:00:00.000Z")
      )
    ).rejects.toThrow(/outside their currentness contract/i);
  });

  it("builds a truthful generic observation period from every series", async () => {
    const data = await buildCurrentEconomicIndicators(fetchFixture, () =>
      new Date("2026-07-14T12:00:00.000Z")
    );

    expect(data).toMatchObject({
      available: true,
      order: ["inflation", "bankRate", "unemployment"],
    });
  });
});
