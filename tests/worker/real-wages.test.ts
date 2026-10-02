// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  BULLETIN_BASE_URL,
  BULLETIN_LATEST_URL,
  buildRealWagesStats,
  discoverLatestEdition,
  discoverRealWagesHistoryUrl,
  parseRealWagesBulletin,
  parseRealWagesHistoryCsv,
} from "@/worker/real-wages";

const bulletinHtml = `
<html><head>
<link rel="canonical" href="/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/september2026" />
</head><body>
<h1>Average weekly earnings in Great Britain: September 2026</h1>
<p>Release date: 15 September 2026</p>
<p>The following information is for the period from May to July 2026.</p>
<ul>
<li>Annual growth in employees' average earnings was 3.5% for regular earnings (excluding bonuses) and 3.9% for total earnings (including bonuses).</li>
<li>Annual growth in real terms, adjusted for inflation using the Consumer Prices Index including owner occupiers' housing costs (CPIH), was 0.6% for regular pay and 0.9% for total pay.</li>
<li>Using the Consumer Prices Index excluding owner occupiers' housing costs (CPI) to adjust for inflation, annual growth in real terms was 0.8% for regular pay and 1.1% for total pay.</li>
</ul>
<h3>Figure 3: Real regular earnings growth remained unchanged at 0.6% in May to July 2026</h3>
<a class="btn btn--primary" title="Download as csv" href="/generator?uri=/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/september2026/06d22b85&format=csv">.csv</a>
</body></html>`;

const historyCsv = `"Figure 3: Real regular earnings growth remained unchanged at 0.6% in May to July 2026",""
"Real average weekly earnings three-month annual growth rates",""
"",""
"Notes",""
"Unit","%"
"",""
"Period","Total pay (real)","Regular pay (real)","CPIH"
"Mar to May 2026","1.2","0.3","3.1"
"Apr to Jun 2026","1.2","0.6","2.9"
"May to July 2026","0.9","0.6","3.0"`;

describe("latest ONS real wages bulletin connector", () => {
  it("discovers the latest edition from the canonical link when /latest does not redirect", () => {
    expect(discoverLatestEdition(bulletinHtml)).toBe("september2026");
  });

  it("falls back to the visible bulletin title when the canonical link is unavailable", () => {
    expect(
      discoverLatestEdition(
        "<h1>Average weekly earnings in Great Britain: September 2026</h1>"
      )
    ).toBe("september2026");
  });

  it("discovers the Figure 3 history CSV link after the real-earnings chart heading", () => {
    expect(
      discoverRealWagesHistoryUrl(
        bulletinHtml,
        `${BULLETIN_BASE_URL}/september2026`
      )
    ).toBe(
      "https://www.ons.gov.uk/generator?uri=/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/september2026/06d22b85&format=csv"
    );
  });

  it("extracts the CPIH real-terms growth figure, not the CPI figure quoted nearby", () => {
    const result = parseRealWagesBulletin(bulletinHtml, "september2026");

    expect(result.headline).toEqual({
      period: "May to Jul 2026",
      observedAt: Date.UTC(2026, 6, 31),
      releaseDate: "2026-09-15",
      regularPayRealGrowthPercent: 0.6,
      totalPayRealGrowthPercent: 0.9,
      deflator: "CPIH",
    });
  });

  it("parses signed values, zero growth and Unicode minus without losing their signs", () => {
    const signedBulletin = bulletinHtml.replace(
      "was 0.6% for regular pay and 0.9% for total pay",
      "was −0.6% for regular pay and +0.0% for total pay"
    );
    expect(parseRealWagesBulletin(signedBulletin, "september2026").headline).toMatchObject({
      regularPayRealGrowthPercent: -0.6,
      totalPayRealGrowthPercent: 0,
    });

    const signedHistory = historyCsv.replace(
      '"May to July 2026","0.9","0.6","3.0"',
      '"May to July 2026","−0.9","+0.0","3.0"'
    );
    expect(parseRealWagesHistoryCsv(signedHistory).at(-1)).toMatchObject({
      totalPayRealGrowthPercent: -0.9,
      regularPayRealGrowthPercent: 0,
    });
  });

  it("reconciles signed bulletin and history observations exactly", async () => {
    const signedBulletin = bulletinHtml.replace(
      "was 0.6% for regular pay and 0.9% for total pay",
      "was −0.6% for regular pay and +0.9% for total pay"
    );
    const signedHistory = historyCsv.replace(
      '"May to July 2026","0.9","0.6","3.0"',
      '"May to July 2026","+0.9","−0.6","3.0"'
    );
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      url: BULLETIN_LATEST_URL,
      text: async () => url.includes("/generator?uri=") ? signedHistory : signedBulletin,
    })) as unknown as typeof fetch;
    const result = await buildRealWagesStats(fetchImpl);
    expect(result.headline.regularPayRealGrowthPercent).toBe(-0.6);
    expect(result.headline.totalPayRealGrowthPercent).toBe(0.9);
  });

  it("fails closed when the CPIH real-terms sentence is missing", () => {
    const withoutCpih = bulletinHtml.replace(
      /Annual growth in real terms, adjusted for inflation using the Consumer Prices Index including owner occupiers' housing costs \(CPIH\), was 0\.6% for regular pay and 0\.9% for total pay\./,
      ""
    );
    expect(() => parseRealWagesBulletin(withoutCpih, "september2026")).toThrow(
      "CPIH real-terms annual growth"
    );
  });

  it("parses the real-earnings history CSV and normalizes a fully-spelled end month", () => {
    const history = parseRealWagesHistoryCsv(historyCsv);
    expect(history).toHaveLength(3);
    expect(history.at(-1)).toEqual({
      period: "May to Jul 2026",
      observedAt: Date.UTC(2026, 6, 31),
      totalPayRealGrowthPercent: 0.9,
      regularPayRealGrowthPercent: 0.6,
      cpihAnnualRatePercent: 3,
    });
  });

  it("rejects a history CSV with a duplicate period", () => {
    const duplicated = `${historyCsv}\n"May to July 2026","0.9","0.6","3.0"`;
    expect(() => parseRealWagesHistoryCsv(duplicated)).toThrow(
      "duplicate period"
    );
  });

  it("discovers the latest bulletin and builds one attributable ONS payload", async () => {
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      url: BULLETIN_LATEST_URL,
      text: async () =>
        url.includes("/generator?uri=") ? historyCsv : bulletinHtml,
    })) as unknown as typeof fetch;

    const result = await buildRealWagesStats(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.headline.regularPayRealGrowthPercent).toBe(0.6);
    expect(result.headline.totalPayRealGrowthPercent).toBe(0.9);
    expect(result.headline.deflator).toBe("CPIH");
    expect(result.source.edition).toBe("september2026");
    expect(result.source.bulletinUrl).toContain("september2026");
    expect(result.history).toHaveLength(3);
    expect(result).not.toHaveProperty("visaTypes");
  });

  it("fails closed when the bulletin and history do not reconcile", async () => {
    const mismatchedCsv = historyCsv.replace(
      '"May to July 2026","0.9","0.6","3.0"',
      '"May to July 2026","0.9","0.4","3.0"'
    );
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      url: BULLETIN_LATEST_URL,
      text: async () =>
        url.includes("/generator?uri=") ? mismatchedCsv : bulletinHtml,
    })) as unknown as typeof fetch;

    await expect(buildRealWagesStats(fetchImpl)).rejects.toThrow(
      "does not reconcile"
    );
  });
});
