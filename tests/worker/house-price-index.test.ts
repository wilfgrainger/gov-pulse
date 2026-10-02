// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  BULLETIN_BASE_URL,
  BULLETIN_LATEST_URL,
  buildHousePriceIndex,
  discoverHousePriceIndexChartUrl,
  discoverLatestEdition,
  parseHpiBulletin,
  parseHpiHistoryCsv,
} from "@/worker/house-price-index";

const bulletinHtml = `
<html><head>
<link rel="canonical" href="/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026" />
</head><body>
<h1>Private rent and house prices, UK: September 2026</h1>
<p>Release date: 16 September 2026</p>
<ul>
<li>Average UK monthly private rent increased by 3.8%, to £1,400, in the 12 months to August 2026 (provisional estimate); this annual growth rate is up from 3.7% in the 12 months to July 2026.</li>
<li>Average UK house prices increased by 1.4%, to £273,000, in the 12 months to July 2026 (provisional estimate); this annual growth rate is down from 1.5% in the 12 months to June 2026.</li>
</ul>
<h4><span role="text">Download this chart <span class="visuallyhidden">Figure 1: UK house price inflation slowed again while rent inflation increased since last month</span></span></h4>
<a class="btn btn--primary" title="Download as csv" href="/generator?uri=/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026/9b5e7b70&amp;format=csv">.csv</a>
<h4><span role="text">Download this chart <span class="visuallyhidden">Figure 2: Annual house price inflation is highest in the North East</span></span></h4>
<a class="btn btn--primary" title="Download as csv" href="/generator?uri=/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026/551301e0&format=csv">.csv</a>
</body></html>`;

const historyCsv = `"Figure 1: UK house price inflation slowed again while rent inflation increased since last month",""
"Private rent and house price annual inflation, UK, January 2016 to August 2026",""
"",""
"Notes",""
"Unit","%"
"",""
"Date","PIPR","UK HPI"
"Mar 2026","3.4","0.3"
"Apr 2026","3.5","4.1"
"May 2026","3.3","3"
"Jun 2026","3.3","1.5"
"Jul 2026","3.7","1.4"
"Aug 2026","3.8",""`;

describe("latest ONS house price index connector", () => {
  it("discovers the latest edition from the canonical link when /latest does not redirect", () => {
    expect(discoverLatestEdition(bulletinHtml)).toBe("september2026");
  });

  it("falls back to the visible bulletin title when the canonical link is unavailable", () => {
    expect(
      discoverLatestEdition(
        "<h1>Private rent and house prices, UK: September 2026</h1>"
      )
    ).toBe("september2026");
  });

  it("discovers the Figure 1 chart CSV link, not Figure 2's", () => {
    expect(
      discoverHousePriceIndexChartUrl(
        bulletinHtml,
        `${BULLETIN_BASE_URL}/september2026`
      )
    ).toBe(
      "https://www.ons.gov.uk/generator?uri=/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026/9b5e7b70&format=csv"
    );
  });

  it("handles an HTML-entity-escaped &amp;format=csv query string the same as a bare &format=csv", () => {
    const escapedOnly = bulletinHtml.replace(
      "9b5e7b70&amp;format=csv",
      "9b5e7b70&amp;format=csv"
    );
    expect(
      discoverHousePriceIndexChartUrl(
        escapedOnly,
        `${BULLETIN_BASE_URL}/september2026`
      )
    ).toContain("format=csv");
  });

  it("extracts the house-price annual change, not the private-rent figure quoted immediately before it", () => {
    const result = parseHpiBulletin(bulletinHtml, "september2026");

    expect(result.headline).toEqual({
      privateRentPeriod: "Aug 2026",
      privateRentObservedAt: Date.UTC(2026, 7, 31),
      avgMonthlyPrivateRentGbp: 1400,
      privateRentAnnualChangePercent: 3.8,
      previousPrivateRentPeriod: "Jul 2026",
      previousPrivateRentAnnualChangePercent: 3.7,
      period: "Jul 2026",
      observedAt: Date.UTC(2026, 6, 31),
      releaseDate: "2026-09-16",
      avgPriceGbp: 273000,
      changePercent: 1.4,
      previousPeriod: "Jun 2026",
      previousChangePercent: 1.5,
    });
  });

  it("fails closed when the house-price headline sentence is missing", () => {
    const withoutHeadline = bulletinHtml.replace(
      /Average UK house prices increased by 1\.4%, to £273,000, in the 12 months to July 2026 \(provisional estimate\); this annual growth rate is down from 1\.5% in the 12 months to June 2026\./,
      ""
    );
    expect(() => parseHpiBulletin(withoutHeadline, "september2026")).toThrow(
      "house price headline"
    );
  });

  it("keeps separate private-rent and house-price observations, including an explicit HPI gap", () => {
    const history = parseHpiHistoryCsv(historyCsv);
    expect(history).toHaveLength(6);
    expect(history.map((point) => point.period)).toEqual([
      "Mar 2026",
      "Apr 2026",
      "May 2026",
      "Jun 2026",
      "Jul 2026",
      "Aug 2026",
    ]);
    expect(history.at(-1)).toEqual({
      period: "Aug 2026",
      observedAt: Date.UTC(2026, 7, 31),
      privateRentAnnualChangePercent: 3.8,
      hpiChangePercent: null,
    });
  });

  it("rejects a history CSV with a duplicate period", () => {
    const duplicated = `${historyCsv}\n"Jul 2026","3.7","1.4"`;
    expect(() => parseHpiHistoryCsv(duplicated)).toThrow("duplicate period");
  });

  it("discovers the latest bulletin and builds one attributable ONS payload", async () => {
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      url: BULLETIN_LATEST_URL,
      text: async () =>
        url.includes("/generator?uri=") ? historyCsv : bulletinHtml,
    })) as unknown as typeof fetch;

    const result = await buildHousePriceIndex(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.headline.changePercent).toBe(1.4);
    expect(result.headline.avgPriceGbp).toBe(273000);
    expect(result.headline.avgMonthlyPrivateRentGbp).toBe(1400);
    expect(result.history.at(-1)).toMatchObject({
      period: "Aug 2026",
      privateRentAnnualChangePercent: 3.8,
      hpiChangePercent: null,
    });
    expect(result.source.edition).toBe("september2026");
    expect(result.source.bulletinUrl).toContain("september2026");
    expect(result.history).toHaveLength(6);
    expect(result).not.toHaveProperty("visaTypes");
  });

  it("fails closed when the bulletin and history do not reconcile", async () => {
    const mismatchedCsv = historyCsv.replace(
      '"Jul 2026","3.7","1.4"',
      '"Jul 2026","3.7","1.2"'
    );
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      url: BULLETIN_LATEST_URL,
      text: async () =>
        url.includes("/generator?uri=") ? mismatchedCsv : bulletinHtml,
    })) as unknown as typeof fetch;

    await expect(buildHousePriceIndex(fetchImpl)).rejects.toThrow(
      "does not reconcile"
    );
  });

  it("fails closed when the private-rent headline and PIPR history do not reconcile", async () => {
    const mismatchedCsv = historyCsv.replace('"Aug 2026","3.8",""', '"Aug 2026","3.6",""');
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      url: BULLETIN_LATEST_URL,
      text: async () => url.includes("/generator?uri=") ? mismatchedCsv : bulletinHtml,
    })) as unknown as typeof fetch;

    await expect(buildHousePriceIndex(fetchImpl)).rejects.toThrow("private-rent history does not reconcile");
  });
});
