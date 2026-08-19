import { describe, expect, it } from "vitest";
import {
  comparisonSummary,
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
  comparableCountryCount: number,
  countries: ComparisonObservation[] = []
): ComparisonMeasure {
  return {
    id,
    label: id,
    definition: "fixture",
    unit: "USD per resident",
    rankDirection: "highest-first",
    observationYear: 2024,
    comparableCountryCount,
    countries,
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

  it("derives the memorable comparison from the actual countries above the UK", () => {
    const countries = [
      observation("USA", 80_000, 1),
      observation("ITA", 70_000, 2),
      observation("GBR", 63_300, 3),
      observation("FRA", 55_000, 4),
      observation("DEU", 50_000, 5),
    ];
    const debt = measure("governmentDebt", 5, countries);
    expect(comparisonSummary(debt, countries[2])).toBe(
      "Only United States and Italy are higher"
    );
  });

  it("uses an honest position summary when too many countries are above to list cleanly", () => {
    const countries = [
      observation("USA", 500, 1),
      observation("DEU", 450, 2),
      observation("FRA", 400, 3),
      observation("ITA", 350, 4),
      observation("GBR", 300, 5),
      observation("ESP", 250, 6),
      observation("NLD", 200, 7),
      observation("POL", 150, 8),
      observation("CHE", 100, 9),
      observation("TUR", 50, 10),
    ];
    const oda = measure("officialDevelopmentAssistance", 10, countries);
    expect(comparisonSummary(oda, countries[4])).toBe("Middle of 10 comparable donors");
  });

  it("never ranks or interprets a null country observation", () => {
    const missing = observation("CHN", null, null);
    const oda = measure("officialDevelopmentAssistance", 10, [missing]);
    expect(rankLabel(oda, missing)).toBe("Not ranked");
    expect(comparisonSummary(oda, missing)).toBe("Comparison unavailable");
  });
});
