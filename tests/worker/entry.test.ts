// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SECTION_BUILDERS } from "@/worker/section-builders";

const debtCsv = `Title,PS: Net Debt (excluding public sector banks): £bn: CPNSA
2025 MAY,2810
2025 JUN,2820
2025 JUL,2830
2025 AUG,2840
2025 SEP,2850
2025 OCT,2860
2025 NOV,2870
2025 DEC,2880
2026 JAN,2890
2026 FEB,2900
2026 MAR,2920
2026 APR,2940.8
2026 MAY,2984.3
`;
const debtGdpCsv = `Title,PS: Net Debt (excluding public sector banks) as a % of GDP: NSA
2025 MAY,93
2025 JUN,93.1
2025 JUL,93.2
2025 AUG,93.3
2025 SEP,93.4
2025 OCT,93.5
2025 NOV,93.6
2025 DEC,93.7
2026 JAN,93.8
2026 FEB,93.9
2026 MAR,94
2026 APR,94.1
2026 MAY,95.1
`;
const debtSeriesHtml = `<main><p>Release date: 19 June 2026</p></main>`;
const migrationDatasetHtml = `<a href="/file?uri=%2Fpeoplepopulationandcommunity%2Fpopulationandmigration%2Finternationalmigration%2Fdatasets%2Flongterminternationalimmigrationemigrationandnetmigrationflowsprovisional%2Fyearendingdecember2025%2Fmay2026publicationspreadsheet.xlsx">Latest</a>`;
const migrationBulletinHtml = `<h1>Long-term international migration, provisional: year ending December 2025</h1><p>Release date: 21 May 2026</p><p>At 171,000, long-term international net migration for year ending (YE) December 2025 has nearly halved from YE December 2024 (updated to 331,000).</p><p>The provisional estimate for total long-term immigration YE December 2025 is 813,000.</p><p>The provisional estimate for total long-term emigration in the most recent period is 642,000.</p><h3>Long-term immigration, emigration and net migration</h3><div data-url="/visualisations/test/fig02/index.html"></div>`;
const migrationHistoryCsv = `date,Net migration,Immigration,Emigration,Net_estimate,Immigration_estimate,Emigration_estimate
YE Dec 24,,,,331000,950000,619000
YE Dec 25,,,,171000,813000,642000`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("national debt section builder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        text: async () =>
          url.includes("format=csv")
            ? url.includes("hf6x")
              ? debtGdpCsv
              : debtCsv
            : debtSeriesHtml,
      }))
    );
  });

  it("builds the verified official HF6W/HF6X payload with provenance", async () => {
    const record = await SECTION_BUILDERS.nationalDebt(new Date("2026-07-14T00:00:00Z"));

    expect(record.data).toMatchObject({
      baseDebt: 2_984_300_000_000,
      baseDate: Date.UTC(2026, 5, 0),
      debtToGdp: 95.1,
      observationPeriod: "2026 MAY",
      publicationDate: "2026-06-19",
      series: { debt: "HF6W", debtToGdp: "HF6X" },
    });
    expect(record.data).not.toHaveProperty("debtPerSecond");
    expect(record.data.__provenance.registryVersion).toBeTruthy();
    expect(
      record.data.__provenance.upstreams.map(
        (source: { seriesId: string }) => source.seriesId
      )
    ).toEqual(["HF6W", "HF6X"]);
  });
});

describe("migration section builder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        text: async () =>
          url.includes("/datasets/")
            ? migrationDatasetHtml
            : url.endsWith("data.csv")
              ? migrationHistoryCsv
              : migrationBulletinHtml,
      }))
    );
  });

  it("builds the latest discovered ONS bulletin with official provenance", async () => {
    const record = await SECTION_BUILDERS.migrationStats(new Date("2026-07-14T00:00:00Z"));

    expect(record.data).toMatchObject({
      headline: {
        period: "YE December 2025",
        netMigration: 171_000,
        immigration: 813_000,
        emigration: 642_000,
      },
      source: { edition: "yearendingdecember2025" },
    });
    expect(record.data).not.toHaveProperty("visaTypes");
    expect(record.data).not.toHaveProperty("topNationalities");
    expect(record.data.__provenance.upstreams).toHaveLength(2);
    expect(
      record.data.__provenance.upstreams.every(
        (source: { publisher: string }) =>
          source.publisher === "Office for National Statistics"
      )
    ).toBe(true);
  });
});
