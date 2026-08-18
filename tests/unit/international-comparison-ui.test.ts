import { describe, expect, it } from "vitest";
import {
  formatUsdPerResident,
  rankLabel,
  type ComparisonMeasure,
  type ComparisonObservation,
} from "@/app/lib/internationalComparison";

const source = {
  publisher: "OECD",
  url: "https://example.test/oecd",
  series: "fixture",
};

function observation(
  country: ComparisonObservation["country"],
  value: number | null,
  rank: number | null
): ComparisonObservation {
  return {
    country,
    value,
    rank,
    observationYear: 2024,
    valueType: "historical",
    source: value === null ? null : source,
    ...(value === null ? { exclusionReason: "not-covered-by-comparable-donor-series" } : {}),
  };
}

function measure(
  id: ComparisonMeasure["id"],
  comparableCountryCount: number
): ComparisonMeasure {
  return {
    id,
    label: id,
    definition: "fixture",
    unit: "USD per resident",
    rankDirection: "highest-first",
    observationYear: 2024,
    comparableCountryCount,
    countries: [],
  };
}

describe("UK in context presentation", () => {
  it("formats amounts as rounded USD per resident without inventing a value", () => {
    expect(formatUsdPerResident(63_299.6)).toMatch(/\$63,300/);
    expect(formatUsdPerResident(null)).toBe("Unavailable");
  });

  it("uses the actual metric denominator and calls ODA countries donors", () => {
    expect(rankLabel(measure("governmentDebt", 13), observation("GBR", 63_300, 3))).toBe(
      "3rd highest of 13 comparable countries"
    );
    expect(
      rankLabel(
        measure("officialDevelopmentAssistance", 10),
        observation("GBR", 248, 5)
      )
    ).toBe("5th highest of 10 comparable donors");
  });

  it("never ranks a null country observation", () => {
    expect(
      rankLabel(
        measure("officialDevelopmentAssistance", 10),
        observation("CHN", null, null)
      )
    ).toBe("Not ranked");
  });
});
