// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  BULLETIN_BASE_URL,
  DATASET_URL,
  buildMigrationStats,
  discoverLatestEdition,
  discoverMigrationHistoryUrl,
  fetchOfficialText,
  parseMigrationBulletin,
  parseMigrationHistoryCsv,
} from "@/worker/migration";

const datasetHtml = `
<html><body>
<a href="/file?uri=%2Fpeoplepopulationandcommunity%2Fpopulationandmigration%2Finternationalmigration%2Fdatasets%2Flongterminternationalimmigrationemigrationandnetmigrationflowsprovisional%2Fyearendingdecember2025%2Fmay2026publicationspreadsheet.xlsx">Year ending December 2025</a>
<a href="/file?uri=%2Fpeoplepopulationandcommunity%2Fpopulationandmigration%2Finternationalmigration%2Fdatasets%2Flongterminternationalimmigrationemigrationandnetmigrationflowsprovisional%2Fyearendingjune2025%2Fnovember2025publicationspreadsheet.xlsx">Year ending June 2025</a>
</body></html>`;

const bulletinHtml = `
<html><body>
<h1>Long-term international migration, provisional: year ending December 2025</h1>
<p>Release date: 21 May 2026</p>
<p>At 171,000, long-term international net migration for year ending (YE) December 2025 has nearly halved from YE December 2024 (updated to 331,000).</p>
<p>The provisional estimate for total long-term immigration YE December 2025 is 813,000.</p>
<p>The provisional estimate for total long-term emigration in the most recent period is 642,000.</p>
<h3>Long-term immigration, emigration and net migration, year ending June 2012 to year ending December 2025</h3>
<div data-url="/visualisations/dvc-test/fig02/index.html"></div>
</body></html>`;

const historyCsv = `date,Net migration,Immigration,Emigration,Net_estimate,Immigration_estimate,Emigration_estimate
YE Dec 16,250000,900000,650000,,,
YE Dec 17,270000,920000,650000,,,
YE Dec 18,290000,940000,650000,,,
YE Dec 19,310000,960000,650000,,,
YE Dec 20,330000,980000,650000,,,
YE Dec 21,350000,1000000,650000,,,
YE Dec 22,370000,1020000,650000,,,
YE Dec 23,400000,1050000,650000,,,
YE Dec 24,,,,331000,950000,619000
YE Dec 25,,,,171000,813000,642000`;

describe("latest ONS migration bulletin connector", () => {
  it("discovers the latest dataset edition instead of pinning an old period", () => {
    expect(discoverLatestEdition(datasetHtml)).toBe("yearendingdecember2025");
  });

  it("falls back to the visible latest-edition heading when download URLs change", () => {
    expect(
      discoverLatestEdition(`
        <h2>Edition in this dataset</h2>
        <h3>Year ending December 2025 edition of this dataset</h3>
        <a href="/download/current.xlsx">xlsx</a>
        <h3>Year ending June 2025 edition of this dataset</h3>
      `)
    ).toBe("yearendingdecember2025");
  });

  it("discovers Figure 2 after ONS reorders the total-flow subtitle", () => {
    const currentBulletinHtml = `
      <h5>Total long-term net migration, immigration and emigration in the UK,
        year ending (YE) June 2012 to YE December 2025</h5>
      <div data-url="/visualisations/dvc3538/fig02/index.html"></div>
    `;
    expect(
      discoverMigrationHistoryUrl(
        currentBulletinHtml,
        `${BULLETIN_BASE_URL}/yearendingdecember2025`
      )
    ).toBe("https://www.ons.gov.uk/visualisations/dvc3538/fig02/data.csv");
  });

  it("parses and reconciles the latest ONS headline estimates", () => {
    const result = parseMigrationBulletin(bulletinHtml, "yearendingdecember2025");

    expect(result.headline).toEqual({
      period: "YE December 2025",
      observedAt: Date.UTC(2026, 0, 0),
      releaseDate: "2026-05-21",
      netMigration: 171_000,
      immigration: 813_000,
      emigration: 642_000,
      previousPeriod: "YE December 2024",
      previousNetMigration: 331_000,
      changePercent: -48,
      provisional: true,
    });
    expect(result.comparison).toEqual([
      { period: "YE December 2024", netMigration: 331_000 },
      { period: "YE December 2025", netMigration: 171_000 },
    ]);
  });

  it("keeps independently rounded historical components within the ONS tolerance", () => {
    const history = parseMigrationHistoryCsv(
      `date,Net migration,Immigration,Emigration,Net_estimate,Immigration_estimate,Emigration_estimate
YE Dec 19,184000,788000,605000,,,
YE Dec 20,93000,662000,569000,,,`
    );
    expect(history[0]).toMatchObject({
      period: "YE December 2019",
      immigration: 788_000,
      emigration: 605_000,
      netMigration: 184_000,
    });
  });

  it("discovers the latest bulletin and builds one attributable ONS payload", async () => {
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () =>
        url === DATASET_URL
          ? datasetHtml
          : url.endsWith("data.csv")
            ? historyCsv
            : bulletinHtml,
    })) as unknown as typeof fetch;

    const result = await buildMigrationStats(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.headline.netMigration).toBe(171_000);
    expect(result.source.edition).toBe("yearendingdecember2025");
    expect(result.source.bulletinUrl).toContain("yearendingdecember2025");
    expect(result.history).toHaveLength(10);
    expect(result.annualDelta.netMigration).toBe(-160_000);
    expect(result).not.toHaveProperty("visaTypes");
    expect(result).not.toHaveProperty("topNationalities");
  });

  it("fails closed when the ONS headline arithmetic does not reconcile", () => {
    const inconsistent = bulletinHtml.replace("642,000", "600,000");
    expect(() => parseMigrationBulletin(inconsistent, "yearendingdecember2025")).toThrow(
      "ONS migration arithmetic does not reconcile"
    );
  });

  it("fails immediately on permanent ONS errors", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => "",
    })) as unknown as typeof fetch;

    await expect(fetchOfficialText(DATASET_URL, fetchImpl)).rejects.toThrow(
      "ONS returned 404"
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
