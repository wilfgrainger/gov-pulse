import { describe, expect, it } from "vitest";
import { buildCountryChartMetadata, canShareCountryAxis, countryComparisonPreset, defaultCountryComparisonMeasureId, parseCountryComparisonUrlState, selectCountryFigure, serializeCountryComparisonUrlState } from "@/app/lib/countryComparison";
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

  it("round-trips a selected measure, peer set, and evidence filters through a URL", () => {
    const state = { measureId: "taxRevenue", countries: ["GBR", "USA", "DEU"] as const, valueTypes: ["historical", "estimate"] as const, year: 2024 };
    const serialized = serializeCountryComparisonUrlState(state);
    expect(parseCountryComparisonUrlState(`?${serialized}`, [2024])).toEqual({
      measureId: "taxRevenue",
      countries: ["GBR", "USA", "DEU"],
      valueTypes: ["historical", "estimate"],
      year: 2024,
    });
  });

  it("ignores invalid URL selections and offers named, source-supported peer presets", () => {
    const malformed = parseCountryComparisonUrlState("?measure=not-a-measure&countries=XXX&types=forecast");
    expect(malformed.measureId).toBe("governmentDebt");
    expect(malformed.year).toBe("latest");
    expect(malformed.countries).toContain("GBR");
    expect(malformed.valueTypes).toEqual(["historical", "estimate", "projection"]);
    expect(countryComparisonPreset("europe")).toEqual(["GBR", "DEU", "FRA", "ITA", "ESP", "IRL", "NLD", "CHE", "POL"]);
    expect(countryComparisonPreset("major-powers")).toEqual(["GBR", "USA", "CHN", "RUS", "DEU", "FRA"]);
  });

  it("chooses the most populated source-backed measure as the default and keeps explicit measure state in URLs", () => {
    const debt = measure({ id: "governmentDebt", comparableCountryCount: 0, countries: [] });
    const defence = measure({ id: "defenceSpending", comparableCountryCount: 13 });
    const measures = { governmentDebt: debt, defenceSpending: defence } as Record<string, ComparisonMeasure>;

    const defaultMeasure = defaultCountryComparisonMeasureId(measures);
    expect(defaultMeasure).toBe("defenceSpending");
    expect(parseCountryComparisonUrlState("?measure=invalid", [], defaultMeasure).measureId).toBe("defenceSpending");
    expect(serializeCountryComparisonUrlState({ measureId: "defenceSpending", countries: ["GBR"], valueTypes: ["historical"], year: "latest" })).toContain("measure=defenceSpending");
  });

  it("preserves an intentional empty country or evidence-status selection in shared URLs", () => {
    const state = { measureId: "governmentDebt" as const, countries: [], valueTypes: [], year: "latest" as const };
    const serialized = serializeCountryComparisonUrlState(state);
    expect(serialized).toContain("countries=");
    expect(serialized).toContain("types=");
    expect(parseCountryComparisonUrlState(`?${serialized}`)).toEqual(state);
  });

  it("selects a source-backed common year and cites each calculation input", () => {
    const data = measure({ countryHistory: [
      { country: "GBR", value: 50, rank: 1, observationYear: 2023, valueType: "historical", source: { publisher: "SIPRI", url: "https://sipri.org/data.xlsx", series: "Military expenditure", additionalSources: [{ publisher: "World Bank", url: "https://api.worldbank.org/population", series: "Population" }] } },
      { country: "USA", value: 40, rank: 2, observationYear: 2023, valueType: "historical", source: { publisher: "SIPRI", url: "https://sipri.org/data.xlsx", series: "Military expenditure", additionalSources: [{ publisher: "World Bank", url: "https://api.worldbank.org/population", series: "Population" }] } },
      { country: "DEU", value: null, rank: null, observationYear: 2023, valueType: "historical", source: null, exclusionReason: "publisher-reported-no-value" },
      { country: "FRA", value: 30, rank: 3, observationYear: 2023, valueType: "historical", source: { publisher: "SIPRI", url: "https://sipri.org/data.xlsx", series: "Military expenditure" } },
    ] });
    const selected = selectCountryFigure(data, ["GBR", "USA", "DEU", "FRA"], ["historical"], 2023);
    const metadata = buildCountryChartMetadata(data, selected);

    expect(selected).toMatchObject({ denominator: 3, sourceCountryCount: 4, commonYear: 2023, ranked: true });
    expect(metadata.sourceCitation).toContain("https://api.worldbank.org/population");
    expect(serializeCountryComparisonUrlState({ measureId: "taxRevenue", countries: ["GBR"], valueTypes: ["historical"], year: 2023 })).toContain("year=2023");
    expect(parseCountryComparisonUrlState("?year=2030", [2023]).year).toBe("latest");
  });
});
