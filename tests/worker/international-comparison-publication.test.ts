// @vitest-environment node

import { describe, expect, it } from "vitest";
import { COMPARISON_COUNTRIES } from "@/worker/international-comparison";
import {
  buildInternationalComparisonPublication,
  comparisonSourceBundle,
} from "@/worker/international-comparison-publication";

const ids = COMPARISON_COUNTRIES.map(({ id }) => id);
const mapAll = (value: number) => new Map(ids.map((id) => [id, value]));
const oecdIds = ["GBR", "USA", "DEU", "FRA", "ITA", "ESP", "TUR", "NLD", "CHE", "POL"];
const mapOecd = (value: number) => new Map(oecdIds.map((id) => [id, value]));

describe("international comparison publication", () => {
  it("builds seven isolated measures with truthful denominators and derivation inputs", () => {
    const bundle = comparisonSourceBundle({
      gdpPerCapita2024: mapAll(50_000),
      gdpPerCapita2022: mapAll(45_000),
      population2024: mapAll(70_000_000),
      debtPctGdp2024: new Map(ids.map((id) => [id, id === "GBR" ? 100 : 50])),
      interestPctGdp2024: new Map(ids.map((id) => [id, id === "GBR" ? 2.84 : 1])),
      odaUsd2024: new Map(oecdIds.map((id) => [id, id === "GBR" ? 18_000_000_000 : 10_000_000_000])),
      defenceUsd2024: new Map(ids.map((id) => [id, id === "GBR" ? 80_000_000_000 : 20_000_000_000])),
      socialPctGdp2022: new Map(oecdIds.map((id) => [id, id === "GBR" ? 22.1 : 15])),
      healthPerCapita2024: new Map(ids.map((id) => [id, id === "GBR" ? 5_860 : 4_000])),
      taxPctGdp2024: new Map(oecdIds.map((id) => [id, id === "GBR" ? 34.4 : 30])),
    });

    const publication = buildInternationalComparisonPublication(
      bundle,
      new Date("2026-08-18T22:00:00.000Z")
    );

    expect(Object.keys(publication.measures)).toHaveLength(7);
    expect(publication.measures.governmentDebt.countries.find((item) => item.country === "GBR")).toMatchObject({
      value: 50_000,
      observationYear: 2024,
      valueType: "historical",
      calculationInputs: { percentGdp: 100, gdpPerResidentUsd: 50_000 },
    });
    expect(publication.measures.officialDevelopmentAssistance.comparableCountryCount).toBe(10);
    expect(publication.measures.officialDevelopmentAssistance.countries.find((item) => item.country === "CHN")).toMatchObject({
      value: null,
      rank: null,
      exclusionReason: "not-covered-by-comparable-donor-series",
    });
    expect(publication.measures.healthcareSpending.countries.find((item) => item.country === "GBR")?.value).toBe(5_860);
    expect(publication.measures.debtInterest.countries.find((item) => item.country === "GBR")?.value).toBeCloseTo(1_420, 4);
  });

  it("marks only the failed metric unavailable when one source family is missing", () => {
    const bundle = comparisonSourceBundle({
      gdpPerCapita2024: mapAll(50_000),
      gdpPerCapita2022: mapAll(45_000),
      population2024: mapAll(70_000_000),
      debtPctGdp2024: mapAll(80),
      interestPctGdp2024: mapAll(2),
      odaUsd2024: mapOecd(10_000_000_000),
      defenceUsd2024: mapAll(20_000_000_000),
      socialPctGdp2022: mapOecd(15),
      healthPerCapita2024: null,
      taxPctGdp2024: mapOecd(30),
    });

    const publication = buildInternationalComparisonPublication(
      bundle,
      new Date("2026-08-18T22:00:00.000Z")
    );

    expect(publication.measures.healthcareSpending.comparableCountryCount).toBe(0);
    expect(publication.measures.healthcareSpending.countries.every((item) => item.value === null)).toBe(true);
    expect(publication.measures.governmentDebt.comparableCountryCount).toBe(13);
    expect(publication.measures.taxRevenue.comparableCountryCount).toBe(10);
  });
});
