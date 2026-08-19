import { describe, expect, it } from "vitest";
import {
  COMPARISON_COUNTRIES,
  COMPARISON_MEASURES,
  buildComparisonMeasure,
  rankComparisonObservations,
  validateInternationalComparisonPublication,
} from "@/worker/international-comparison";

const source = {
  publisher: "Test publisher",
  url: "https://example.test/source",
  publicationDate: "2026-08-01",
  series: "TEST",
};

describe("international comparison evidence contract", () => {
  it("uses the approved fixed 13-country comparison universe", () => {
    expect(COMPARISON_COUNTRIES).toEqual([
      { id: "GBR", name: "United Kingdom" },
      { id: "USA", name: "United States" },
      { id: "CHN", name: "China" },
      { id: "RUS", name: "Russia" },
      { id: "UKR", name: "Ukraine" },
      { id: "DEU", name: "Germany" },
      { id: "FRA", name: "France" },
      { id: "ITA", name: "Italy" },
      { id: "ESP", name: "Spain" },
      { id: "IRL", name: "Ireland" },
      { id: "NLD", name: "Netherlands" },
      { id: "CHE", name: "Switzerland" },
      { id: "POL", name: "Poland" },
    ]);
    expect(COMPARISON_COUNTRIES.map(({ id }) => id)).not.toContain("TUR");
  });

  it("contains exactly the seven approved measures", () => {
    expect(COMPARISON_MEASURES.map((measure) => measure.id)).toEqual([
      "governmentDebt",
      "officialDevelopmentAssistance",
      "defenceSpending",
      "publicSocialExpenditure",
      "healthcareSpending",
      "taxRevenue",
      "debtInterest",
    ]);
    expect(COMPARISON_MEASURES.every((measure) => measure.unit === "USD per resident")).toBe(true);
  });

  it("ranks highest values first with competition ties and excludes null observations", () => {
    const ranked = rankComparisonObservations([
      { country: "GBR", value: 100 },
      { country: "USA", value: 120 },
      { country: "DEU", value: 100 },
      { country: "CHN", value: null, exclusionReason: "not-covered" },
    ]);

    expect(ranked.find((item) => item.country === "USA")?.rank).toBe(1);
    expect(ranked.find((item) => item.country === "GBR")?.rank).toBe(2);
    expect(ranked.find((item) => item.country === "DEU")?.rank).toBe(2);
    expect(ranked.find((item) => item.country === "CHN")?.rank).toBeNull();
    expect(ranked.filter((item) => item.rank !== null)).toHaveLength(3);
  });

  it("builds the denominator from genuinely comparable observations only", () => {
    const measure = buildComparisonMeasure({
      id: "officialDevelopmentAssistance",
      definition: "Official development assistance supplied per resident.",
      observationYear: 2025,
      observations: [
        {
          country: "GBR",
          value: 248,
          observationYear: 2025,
          valueType: "estimate",
          source,
        },
        {
          country: "USA",
          value: 150,
          observationYear: 2025,
          valueType: "estimate",
          source,
        },
        {
          country: "CHN",
          value: null,
          rank: null,
          observationYear: 2025,
          valueType: "historical",
          source: null,
          exclusionReason: "not-covered-by-comparable-donor-series",
        },
      ],
    });

    expect(measure.comparableCountryCount).toBe(2);
    expect(measure.countries.find((item) => item.country === "CHN")).toMatchObject({
      value: null,
      rank: null,
      exclusionReason: "not-covered-by-comparable-donor-series",
    });
  });

  it("rejects sourced values without country-level year and value classification", () => {
    expect(() =>
      buildComparisonMeasure({
        id: "governmentDebt",
        definition: "Gross general-government debt per resident.",
        observationYear: 2024,
        observations: [
          {
            country: "GBR",
            value: 63_300,
            observationYear: 2024,
            source,
          } as never,
        ],
      })
    ).toThrow(/valueType/i);
  });

  it("validates a publication without permitting a synthetic overall score", () => {
    const observations = COMPARISON_COUNTRIES.map(({ id }) => ({
      country: id,
      value: id === "GBR" ? 100 : null,
      observationYear: 2024,
      valueType: "historical" as const,
      source: id === "GBR" ? source : null,
      ...(id === "GBR" ? {} : { exclusionReason: "fixture-missing" }),
    }));
    const measures = Object.fromEntries(
      COMPARISON_MEASURES.map(({ id, definition }) => [
        id,
        buildComparisonMeasure({ id, definition, observationYear: 2024, observations }),
      ])
    );
    const publication = {
      meta: {
        schemaVersion: 1,
        generatedAt: "2026-08-18T22:00:00.000Z",
        comparisonSetId: "uk-context-13-v2",
        countries: COMPARISON_COUNTRIES.map(({ id }) => id),
      },
      measures,
    };

    expect(validateInternationalComparisonPublication(publication)).toBe(publication);
    expect(publication).not.toHaveProperty("overallScore");
    expect(publication.meta).not.toHaveProperty("overallScore");
  });
});
