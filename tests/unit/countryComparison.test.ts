import { describe, expect, it } from "vitest";
import { buildCountryChartMetadata, canShareCountryAxis, selectCountryFigure } from "@/app/lib/countryComparison";
import type { ComparisonMeasure } from "@/app/lib/internationalComparison";

function measure(overrides: Partial<ComparisonMeasure> = {}): ComparisonMeasure {
  return {
    id: "taxRevenue", label: "Tax collected", definition: "Central government revenue as USD per resident", unit: "USD per resident", rankDirection: "highest-first", observationYear: 2024, comparableCountryCount: 3,
    countries: [
      { country: "GBR", value: 100, rank: 1, observationYear: 2024, valueType: "estimate", source: null },
      { country: "USA", value: 100, rank: 1, observationYear: 2024, valueType: "estimate", source: null },
      { country: "DEU", value: 75, rank: 3, observationYear: 2024, valueType: "estimate", source: null },
      { country: "FRA", value: null, rank: null, observationYear: 2024, valueType: "estimate", source: null, exclusionReason: "publisher-reported-no-value" },
    ],
    ...overrides,
  };
}

describe("interactive country comparison", () => {
  it("keeps selected country values, denominator, evidence status, and publisher links in export metadata", () => {
    const data = measure({
      caveat: "Purchasing power adjusted; estimates may be revised.",
      countries: [
        { country: "GBR", value: 100, rank: 1, observationYear: 2024, valueType: "estimate", source: { publisher: "OECD", url: "https://example.org/uk", series: "Revenue" , publicationDate: "2025-01-20" } },
        { country: "DEU", value: 75, rank: 2, observationYear: 2024, valueType: "estimate", source: { publisher: "OECD", url: "https://example.org/de", series: "Revenue", publicationDate: "2025-01-20" } },
        { country: "FRA", value: null, rank: null, observationYear: 2024, valueType: "estimate", source: null, exclusionReason: "Publisher reports no value" },
      ],
    });
    const selected = selectCountryFigure(data, ["GBR", "DEU", "FRA"], ["estimate"]);
    const metadata = buildCountryChartMetadata(data, selected);

    expect(metadata.observationWindow).toEqual({ start: { period: "2024", observedAt: "2024-01-01" }, end: { period: "2024", observedAt: "2024-12-31" } });
    expect(metadata.sourceCitation).toContain("OECD");
    expect(metadata.sourceCitation).toContain("https://example.org/uk");
    expect(metadata.sourceCitation).toContain("Visible denominator: 2 of 3");
    expect(metadata.series).toEqual([
      { key: "GBR", label: "United Kingdom · 100 USD per resident · 2024 · estimate · rank 1" },
      { key: "DEU", label: "Germany · 75 USD per resident · 2024 · estimate · rank 2" },
    ]);
    expect(metadata.caveats).toEqual(expect.arrayContaining(["Purchasing power adjusted; estimates may be revised.", "Publisher reports no value"]));
  });

  it("omits missing countries from the denominator and shares tied ranks", () => {
    const result = selectCountryFigure(measure(), ["GBR", "USA", "DEU", "FRA"], ["estimate"]);
    expect(result.denominator).toBe(3);
    expect(result.sourceCountryCount).toBe(4);
    expect(result.rows.map(({ country, rank }) => [country, rank])).toEqual([["GBR", 1], ["USA", 1], ["DEU", 3]]);
    expect(result.excluded[0].country).toBe("FRA");
    expect(result.excluded[0].reason).toBe("publisher-reported-no-value");
  });

  it("updates the denominator and ranking when country filters change", () => {
    const result = selectCountryFigure(measure(), ["GBR", "DEU"], ["estimate"]);
    expect(result.denominator).toBe(2);
    expect(result.rows.map((row) => [row.country, row.rank])).toEqual([["GBR", 1], ["DEU", 2]]);
  });

  it("withholds rankings when years or evidence statuses differ", () => {
    const data = measure({ countries: [
      { country: "GBR", value: 100, rank: 1, observationYear: 2024, valueType: "estimate", source: null },
      { country: "USA", value: 110, rank: 2, observationYear: 2023, valueType: "historical", source: null },
    ] });
    const result = selectCountryFigure(data, ["GBR", "USA"], ["estimate", "historical"]);
    expect(result.ranked).toBe(false);
    expect(result.rows.every((row) => row.rank === null)).toBe(true);
  });

  it("does not share an axis across different years, units or definitions", () => {
    const base = measure();
    expect(canShareCountryAxis(base, measure({ observationYear: 2023 }))).toBe(false);
    expect(canShareCountryAxis(base, measure({ unit: "GBP per resident" as never }))).toBe(false);
    expect(canShareCountryAxis(base, measure({ definition: "Different accounting basis" }))).toBe(false);
  });
});
