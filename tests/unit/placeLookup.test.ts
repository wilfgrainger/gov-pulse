import { describe, expect, it } from "vitest";
import { lookupPlace, looksLikePostcode, publishedGeographies } from "@/app/lib/placeLookup";

describe("placeLookup", () => {
  it("lists only geographies already present on measure definitions", () => {
    const geographies = publishedGeographies();
    expect(geographies.length).toBeGreaterThan(0);
    expect(geographies.some((geography) => geography.code === "UK")).toBe(true);
    expect(geographies.every((geography) => geography.label && geography.code)).toBe(true);
  });

  it("matches United Kingdom and aliases without inventing local series", () => {
    const result = lookupPlace("UK");
    expect(result.status).toBe("matched");
    if (result.status !== "matched") return;
    expect(result.matches[0]?.geography.label).toBe("United Kingdom");
    expect(result.matches[0]?.measures.length).toBeGreaterThan(0);
    expect(result.matches[0]?.measures.every((measure) => measure.geographyCode === "UK")).toBe(true);
  });

  it("matches England exactly", () => {
    const result = lookupPlace("England");
    expect(result.status).toBe("matched");
    if (result.status !== "matched") return;
    expect(result.matches.some((match) => match.geography.code === "ENG")).toBe(true);
  });

  it("never classifies a nation from a postcode", () => {
    expect(looksLikePostcode("SY1 1AA")).toBe(true);
    expect(looksLikePostcode("TD15")).toBe(true);
    expect(looksLikePostcode("JE1 1AA")).toBe(true);

    for (const query of ["SY1 1AA", "TD15", "JE1 1AA", "SW1A 1AA"]) {
      const result = lookupPlace(query);
      expect(result.status).toBe("postcode-unclassified");
      if (result.status === "postcode-unclassified") {
        expect(result.reason).toMatch(/not a country boundary/i);
      }
    }
  });

  it("fails closed when the place is not a published geography", () => {
    const result = lookupPlace("Shropshire");
    expect(result.status).toBe("no-match");
  });

  it("treats an empty query as empty", () => {
    expect(lookupPlace("   ").status).toBe("empty-query");
  });
});
