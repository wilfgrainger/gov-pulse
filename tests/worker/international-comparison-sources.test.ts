// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  calculatePerResidentFromPercentGdp,
  calculatePerResidentFromTotal,
  parseImfSeries,
  parseOdaProfile,
  parseOecdCsvSeries,
  parseWorldBankSeries,
} from "@/worker/international-comparison-sources";

describe("international comparison source transforms", () => {
  it("parses IMF DataMapper values for fixed-country annual series", () => {
    const payload = {
      values: {
        GGXWDG_NGDP: {
          GBR: { 2024: 101.2 },
          USA: { 2024: 119.8 },
        },
      },
    };

    expect(parseImfSeries(payload, "GGXWDG_NGDP", 2024)).toEqual(
      new Map([
        ["GBR", 101.2],
        ["USA", 119.8],
      ])
    );
  });

  it("parses World Bank JSON and preserves null observations instead of coercing them to zero", () => {
    const payload = [
      { page: 1, pages: 1, total: 2 },
      [
        { countryiso3code: "GBR", date: "2024", value: 5860.25 },
        { countryiso3code: "CHN", date: "2024", value: null },
      ],
    ];

    const series = parseWorldBankSeries(payload, 2024);
    expect(series.get("GBR")).toBe(5860.25);
    expect(series.get("CHN")).toBeNull();
  });

  it("parses OECD SDMX CSV rows by REF_AREA, TIME_PERIOD and OBS_VALUE", () => {
    const csv = [
      "REF_AREA,FREQ,SECTOR,UNIT_MEASURE,TIME_PERIOD,OBS_VALUE",
      "GBR,A,S13,PT_B1GQ,2024,34.4",
      "USA,A,S13,PT_B1GQ,2024,25.6",
      "CHN,A,S13,PT_B1GQ,2024,..",
    ].join("\n");

    const series = parseOecdCsvSeries(csv, 2024);
    expect(series.get("GBR")).toBe(34.4);
    expect(series.get("USA")).toBe(25.6);
    expect(series.get("CHN")).toBeNull();
  });

  it("extracts preliminary OECD ODA totals without assigning non-donors a zero", () => {
    const html = `
      <main>
        <p>The United Kingdom provided USD 17.2 billion (preliminary data) of ODA in 2025.</p>
      </main>
    `;
    expect(parseOdaProfile(html, 2025)).toBe(17_200_000_000);
    expect(() => parseOdaProfile("<p>No comparable ODA amount here.</p>", 2025)).toThrow(
      /ODA/i
    );
  });

  it("derives per-resident amounts only from compatible same-year inputs", () => {
    expect(calculatePerResidentFromPercentGdp(22.1, 53_400)).toBeCloseTo(11_801.4, 1);
    expect(calculatePerResidentFromTotal(17_200_000_000, 69_350_000)).toBeCloseTo(248.02, 1);
    expect(() => calculatePerResidentFromTotal(10, 0)).toThrow(/population/i);
  });
});
