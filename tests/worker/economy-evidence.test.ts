// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  FINANCES_BULLETIN_URL,
  GDP_BULLETIN_URL,
  LABOUR_BULLETIN_URL,
  buildEmploymentStats,
  buildGdpTracker,
  buildTaxRevenue,
  discoverLatestBulletinUrl,
  parseFinancesBulletin,
  parseGdpBulletin,
  parseLabourBulletin,
} from "@/worker/economy-evidence";

const gdpEditionUrl = `${GDP_BULLETIN_URL.replace(/\/latest$/, "")}/may2026`;
const labourEditionUrl = `${LABOUR_BULLETIN_URL.replace(/\/latest$/, "")}/july2026`;
const financesEditionUrl = `${FINANCES_BULLETIN_URL.replace(/\/latest$/, "")}/may2026`;

const gdpHtml = `
<h1>GDP monthly estimate, UK: May 2026</h1>
<p>Release date: 10 July 2026</p>
<p>Monthly real GDP is estimated to have increased by 0.1% in May 2026.</p>
<p>GDP is estimated to have increased by 0.5% in the three months to May 2026.</p>`;

const labourHtml = `
<h1>Labour market overview, UK: July 2026</h1>
<p>Release date: 16 July 2026</p>
<p>The UK employment rate for March to May 2026 was estimated at 75.1%.</p>
<p>The UK unemployment rate for March to May 2026 was estimated at 5.2%.</p>
<p>The UK economic inactivity rate for March to May 2026 was estimated at 21.0%.</p>
<p>The estimated number of vacancies in the UK decreased in the latest quarter. Early estimates for April to June 2026 suggest a decrease of 19,000 (2.6%) to 721,000, compared with January to March 2026.</p>`;

const financesHtml = `
<h1>Public sector finances, UK: May 2026</h1>
<p>Release date: 19 June 2026</p>
<p>Central government receipts were estimated to be £93.7 billion in May 2026, £8.2 billion more than in May 2025.</p>`;

function landing(url: string) {
  return `<a href="${url}">Latest release</a>`;
}

function monthlyCsv(endYear: number, endMonth: number, latest: number, prior: number) {
  const rows = [];
  for (let offset = 12; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(endYear, endMonth - offset, 1));
    const period = `${date.getUTCFullYear()} ${date
      .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
      .toUpperCase()}`;
    const value = offset === 12 ? prior : offset === 0 ? latest : prior;
    rows.push(`${period},${value}`);
  }
  return `Title,Value\n${rows.join("\n")}`;
}

function fetchFor(
  landingUrl: string,
  editionUrl: string,
  bulletin: string,
  series: Record<string, string>
) {
  return vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    url,
    text: async () => {
      if (url === landingUrl) return landing(editionUrl);
      if (url === editionUrl) return bulletin;
      const match = Object.entries(series).find(([id]) => url.toLowerCase().includes(`/${id}/`));
      return match?.[1] ?? "";
    },
  })) as unknown as typeof fetch;
}

describe("official ONS economy bulletin connectors", () => {
  it("discovers the first current edition from a stable landing page", () => {
    expect(discoverLatestBulletinUrl(landing(gdpEditionUrl), GDP_BULLETIN_URL)).toBe(gdpEditionUrl);
  });

  it("builds one current GDP observation without forecasts or comparison tables", async () => {
    const fetchImpl = fetchFor(GDP_BULLETIN_URL, gdpEditionUrl, gdpHtml, {
      ecy2: monthlyCsv(2026, 4, 103.2, 101.9),
      ecyx: monthlyCsv(2026, 4, 0.1, 0),
      ed2r: monthlyCsv(2026, 4, 1.3, 1),
      ed3h: monthlyCsv(2026, 4, 0.5, 0.2),
    });
    const result = await buildGdpTracker(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(result).toMatchObject({
      available: true,
      headline: {
        period: "May 2026",
        observedAt: Date.UTC(2026, 5, 0),
        releaseDate: "2026-07-10",
        monthlyGrowth: 0.1,
        threeMonthGrowth: 0.5,
        annualGrowth: 1.3,
      },
      source: { bulletinUrl: gdpEditionUrl },
    });
    expect(result.history).toHaveLength(13);
    expect(result).not.toHaveProperty("gdpHistory");
    expect(result).not.toHaveProperty("g7Comparison");
    expect(result).not.toHaveProperty("sectorBreakdown");
  });

  it("parses a no-growth GDP month without inventing movement", () => {
    const result = parseGdpBulletin(
      gdpHtml.replace("increased by 0.1%", "shown no growth"),
      gdpEditionUrl
    );
    expect(result.headline.monthlyGrowth).toBe(0);
  });

  it("builds aligned labour-market rates and keeps the vacancies period separate", async () => {
    const fetchImpl = fetchFor(LABOUR_BULLETIN_URL, labourEditionUrl, labourHtml, {
      lf24: monthlyCsv(2026, 4, 75.1, 74.8),
      mgsx: monthlyCsv(2026, 4, 5.2, 4.8),
      lf2s: monthlyCsv(2026, 4, 21, 21.4),
      ap2y: monthlyCsv(2026, 5, 721, 760),
    });
    const result = await buildEmploymentStats(fetchImpl);

    expect(result).toMatchObject({
      available: true,
      headline: {
        period: "March to May 2026",
        observedAt: Date.UTC(2026, 5, 0),
        releaseDate: "2026-07-16",
        employmentRate: 75.1,
        unemploymentRate: 5.2,
        inactivityRate: 21,
        vacancies: 721000,
        vacanciesPeriod: "April to June 2026",
      },
      source: { bulletinUrl: labourEditionUrl },
    });
    expect(result.history.labourForce).toHaveLength(13);
    expect(result.annualDelta).toEqual({
      employmentRatePoints: 0.3,
      unemploymentRatePoints: 0.4,
      inactivityRatePoints: -0.4,
      vacancies: -39000,
    });
    expect(result).not.toHaveProperty("publicVsPrivate");
    expect(result).not.toHaveProperty("employmentTrend");
  });

  it("fails closed when labour-market headline periods do not align", () => {
    expect(() =>
      parseLabourBulletin(
        labourHtml.replace(
          "The UK unemployment rate for March to May 2026",
          "The UK unemployment rate for February to April 2026"
        ),
        labourEditionUrl
      )
    ).toThrow("headline periods do not align");
  });

  it("builds one like-for-like central-government receipts comparison", async () => {
    const fetchImpl = fetchFor(FINANCES_BULLETIN_URL, financesEditionUrl, financesHtml, {
      anbv: monthlyCsv(2026, 4, 93_700, 85_500),
    });
    const result = await buildTaxRevenue(fetchImpl);

    expect(result).toMatchObject({
      available: true,
      headline: {
        period: "May 2026",
        observedAt: Date.UTC(2026, 5, 0),
        releaseDate: "2026-06-19",
        receiptsBillion: 93.7,
        yearChangeBillion: 8.2,
      },
      source: { bulletinUrl: financesEditionUrl },
    });
    expect(result.history).toHaveLength(13);
    expect(result).not.toHaveProperty("taxCategories");
    expect(result).not.toHaveProperty("taxBurdenHistory");
  });

  it("preserves a year-on-year fall in receipts as a negative change", () => {
    const result = parseFinancesBulletin(
      financesHtml.replace("£8.2 billion more", "£2.4 billion less"),
      financesEditionUrl
    );
    expect(result.headline.yearChangeBillion).toBe(-2.4);
  });

  it("fails closed on a permanent ONS error without retrying", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      url: GDP_BULLETIN_URL,
      text: async () => "",
    })) as unknown as typeof fetch;

    await expect(buildGdpTracker(fetchImpl)).rejects.toThrow("ONS returned 404");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
