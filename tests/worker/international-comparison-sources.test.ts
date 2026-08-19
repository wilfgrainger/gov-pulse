// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  SIPRI_MILEX_2025_WORKBOOK_URL,
  SOURCE_QUERIES,
  calculatePerResidentFromPercentGdp,
  calculatePerResidentFromTotal,
  parseImfSeries,
  parseOecdCsvSeries,
  parseSipriCurrentUsdCells,
  parseSipriTop40Text,
  parseWorldBankSeries,
} from "@/worker/international-comparison-sources";

describe("international comparison source transforms", () => {
  it("pins current primary sources for debt, interest, ODA, social spending and defence", () => {
    expect(SOURCE_QUERIES.imfGdpPerCapita2026).toContain("NGDPDPC");
    expect(SOURCE_QUERIES.imfGdpPerCapita2026).toContain("periods=2026");
    expect(SOURCE_QUERIES.imfDebtPctGdp2026).toContain("GGXWDG_NGDP");
    expect(SOURCE_QUERIES.imfDebtPctGdp2026).toContain("periods=2026");
    expect(SOURCE_QUERIES.imfInterestPctGdp2024).toContain("/ie/");
    expect(SOURCE_QUERIES.imfInterestPctGdp2024).not.toContain("ie@FPP");
    expect(SOURCE_QUERIES.oecdOda2025).toContain("DSD_DAC1@DF_DAC1,1.7");
    expect(SOURCE_QUERIES.oecdOda2025).toContain("11010..1160.USD.V");
    expect(SOURCE_QUERIES.oecdOda2025).toContain("endPeriod=2025");
    expect(SOURCE_QUERIES.oecdSocx2023).toContain(".A..PT_B1GQ.ES10._T._T.?");
    expect(SOURCE_QUERIES.oecdSocx2023).toContain("endPeriod=2023");
    expect(SIPRI_MILEX_2025_WORKBOOK_URL).toMatch(/SIPRI-Milex-data-1949-2025.*\.xlsx/i);
  });

  it("parses IMF DataMapper values for fixed-country annual series", () => {
    const payload = { values: { GGXWDG_NGDP: { GBR: { 2026: 103.6 }, USA: { 2026: 120.1 } } } };
    expect(parseImfSeries(payload, "GGXWDG_NGDP", 2026)).toEqual(
      new Map([["GBR", 103.6], ["USA", 120.1]])
    );
  });

  it("parses World Bank JSON and preserves null observations instead of coercing them to zero", () => {
    const payload = [{ page: 1 }, [
      { countryiso3code: "GBR", date: "2024", value: 5860.25 },
      { countryiso3code: "CHN", date: "2024", value: null },
    ]];
    const series = parseWorldBankSeries(payload, 2024);
    expect(series.get("GBR")).toBe(5860.25);
    expect(series.get("CHN")).toBeNull();
  });

  it("parses OECD SDMX values and unit multipliers", () => {
    const csv = [
      "REF_AREA,TIME_PERIOD,UNIT_MULT,OBS_VALUE",
      "GBR,2025,6,17200",
      "USA,2025,6,29000",
      "CHN,2025,6,..",
    ].join("\n");
    const series = parseOecdCsvSeries(csv, 2025);
    expect(series.get("GBR")).toBe(17_200_000_000);
    expect(series.get("USA")).toBe(29_000_000_000);
    expect(series.get("CHN")).toBeNull();
  });

  it("maps SIPRI 2025 published top-40 rows to the named countries", () => {
    const text = [
      "1 1 United States 954 997 3.4 37 3.2",
      "2 2 China [336] 314 7.0 13 1.7",
      "3 3 Russia [190] 149 27 7.3 6.3",
      "4 4 Germany 114 88.5 29 4.4 3.5",
      "5 5 United Kingdom 89.0 81.8 8.8 3.4 2.4",
      "6 6 Ukraine [84.1] 64.7 30 3.3 31",
      "18 18 Türkiye 30.0 25.0 20 1.2 1.9",
      "19 19 Netherlands 28.9 25.2 15 1.1 2.2",
      "37 37 Switzerland 7.6 8.1 -6.2 0.3 0.7",
    ].join(" ");
    const series = parseSipriTop40Text(text);
    expect(series.get("USA")).toBe(954_000_000_000);
    expect(series.get("GBR")).toBe(89_000_000_000);
    expect(series.get("CHE")).toBe(7_600_000_000);
  });

  it("reads the 2025 current-US-dollar column from SIPRI workbook cells in USD millions", () => {
    const cells = new Map([
      ["D4", "2024"],
      ["E4", "2025"],
      ["B10", "United Kingdom"],
      ["D10", "81800"],
      ["E10", "89000"],
      ["B11", "United States"],
      ["E11", "954000"],
      ["B12", "China"],
      ["E12", "336000"],
    ]);
    const series = parseSipriCurrentUsdCells(cells, 2025);
    expect(series.get("GBR")).toBe(89_000_000_000);
    expect(series.get("USA")).toBe(954_000_000_000);
    expect(series.get("CHN")).toBe(336_000_000_000);
  });

  it("derives per-resident amounts only from compatible same-year inputs", () => {
    expect(calculatePerResidentFromPercentGdp(23.0, 48_000)).toBeCloseTo(11_040, 1);
    expect(calculatePerResidentFromTotal(17_200_000_000, 69_350_000)).toBeCloseTo(248.02, 1);
    expect(() => calculatePerResidentFromTotal(10, 0)).toThrow(/population/i);
  });
});
