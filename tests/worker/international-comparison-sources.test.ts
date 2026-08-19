// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  SOURCE_QUERIES,
  calculatePerResidentFromPercentGdp,
  calculatePerResidentFromTotal,
  parseImfSeries,
  parseOdaProfile,
  parseOecdCsvSeries,
  parseSipriTop40Text,
  parseWorldBankSeries,
} from "@/worker/international-comparison-sources";

describe("international comparison source transforms", () => {
  it("pins total 2025 ODA grant equivalents and 2024 public SOCX", () => {
    expect(SOURCE_QUERIES.oecdOda2025).toContain("DSD_DAC1@DF_DAC1,1.7");
    expect(SOURCE_QUERIES.oecdOda2025).toContain(".1010..1160.USD.V._Z");
    expect(SOURCE_QUERIES.oecdOda2025).toContain("startPeriod=2025");
    expect(SOURCE_QUERIES.oecdSocx2024).toContain(".A..PT_B1GQ.ES10._T._T.?");
    expect(SOURCE_QUERIES.oecdSocx2024).toContain("endPeriod=2024");
  });

  it("parses IMF DataMapper values for fixed-country annual series", () => {
    const payload = { values: { GGXWDG_NGDP: { GBR: { 2024: 101.2 }, USA: { 2024: 119.8 } } } };
    expect(parseImfSeries(payload, "GGXWDG_NGDP", 2024)).toEqual(
      new Map([["GBR", 101.2], ["USA", 119.8]])
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

  it("extracts preliminary OECD ODA totals without assigning non-donors a zero", () => {
    const html = `<p>The United Kingdom provided USD 17.2 billion (preliminary data) of ODA in 2025.</p>`;
    expect(parseOdaProfile(html, 2025)).toBe(17_200_000_000);
    expect(() => parseOdaProfile("<p>No comparable ODA amount here.</p>", 2025)).toThrow(/ODA/i);
  });

  it("derives per-resident amounts only from compatible same-year inputs", () => {
    expect(calculatePerResidentFromPercentGdp(22.1, 53_400)).toBeCloseTo(11_801.4, 1);
    expect(calculatePerResidentFromTotal(17_200_000_000, 69_350_000)).toBeCloseTo(248.02, 1);
    expect(() => calculatePerResidentFromTotal(10, 0)).toThrow(/population/i);
  });
});
