// @vitest-environment node

import { describe, expect, it } from "vitest";
import { COMPARISON_COUNTRIES } from "@/worker/international-comparison";
import {
  buildInternationalComparisonPublication,
  collectInternationalComparison,
  comparisonSourceBundle,
} from "@/worker/international-comparison-publication";

const ids = COMPARISON_COUNTRIES.map(({ id }) => id);
const mapAll = (value: number) => new Map(ids.map((id) => [id, value]));
const oecdIds = ["GBR", "USA", "DEU", "FRA", "ITA", "ESP", "IRL", "NLD", "CHE", "POL"];
const mapOecd = (value: number) => new Map(oecdIds.map((id) => [id, value]));

describe("international comparison publication", () => {
  it("publishes OECD measures from World Bank denominators without relying on IMF GDP routes", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());
      if (url.hostname === "api.worldbank.org" && url.pathname.includes("NY.GDP.PCAP.CD")) {
        const year = Number(url.searchParams.get("date"));
        const gdpPerResident = year === 2023 ? 48_000 : 50_000;
        return new Response(JSON.stringify([{ lastupdated: "2026-07-13" }, ids.map((countryiso3code) => ({
          countryiso3code,
          date: String(year),
          value: gdpPerResident,
        }))]), { headers: { "Content-Type": "application/json" } });
      }
      if (url.hostname === "www.imf.org" && url.pathname.includes("/ie/")) {
        return new Response(JSON.stringify({ values: { ie: Object.fromEntries(ids.map((country) => [country, { 2024: 2 }])) } }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.hostname === "sdmx.oecd.org") {
        const year = Number(url.searchParams.get("startPeriod"));
        const percentGdp = year === 2023 ? 25 : 30;
        const csv = [
          "REF_AREA,TIME_PERIOD,UNIT_MULT,OBS_VALUE",
          ...oecdIds.map((country) => `${country},${year},0,${percentGdp}`),
        ].join("\n");
        return new Response(csv, { headers: {
          "Content-Type": "text/csv",
          "Last-Modified": "Mon, 06 Oct 2025 00:00:00 GMT",
        } });
      }
      throw new Error(`Unexpected comparison source request: ${url}`);
    };

    const publication = await collectInternationalComparison(
      fetchImpl as typeof fetch,
      new Date("2026-10-04T10:00:00.000Z"),
      { sourceIds: [
        "world-bank-gdp-per-capita-2023",
        "oecd-socx-2023",
        "world-bank-gdp-per-capita-2024",
        "oecd-tax-2024",
        "imf-interest-2024",
      ] },
    );

    const social = publication.measures.publicSocialExpenditure;
    const ukSocial = social.countries.find((item) => item.country === "GBR");
    expect(social.caveat).toContain("World Bank GDP per capita");
    expect(social.comparableCountryCount).toBe(10);
    expect(ukSocial).toMatchObject({
      value: 12_000,
      observationYear: 2023,
      valueType: "historical",
      calculationInputs: { percentGdp: 25, gdpPerResidentUsd: 48_000 },
      source: {
        publisher: "OECD",
        sourceUpdatedAt: "2025-10-06",
        sourceUpdatedAtBasis: "http-last-modified",
        additionalSources: [{
          publisher: "World Bank World Development Indicators",
          series: expect.stringContaining("NY.GDP.PCAP.CD"),
          sourceUpdatedAt: "2026-07-13",
          sourceUpdatedAtBasis: "publisher-metadata",
        }],
      },
    });
    expect(social.countries.find((item) => item.country === "CHN")).toMatchObject({
      value: null,
      exclusionReason: "not-covered-by-oecd-comparable-series",
    });

    const tax = publication.measures.taxRevenue;
    const ukTax = tax.countries.find((item) => item.country === "GBR");
    expect(tax.caveat).toContain("World Bank GDP per capita");
    expect(tax.comparableCountryCount).toBe(10);
    expect(ukTax).toMatchObject({
      value: 15_000,
      observationYear: 2024,
      valueType: "historical",
      calculationInputs: { percentGdp: 30, gdpPerResidentUsd: 50_000 },
      source: {
        publisher: "OECD",
        sourceUpdatedAt: "2025-10-06",
        sourceUpdatedAtBasis: "http-last-modified",
        additionalSources: [{
          publisher: "World Bank World Development Indicators",
          series: expect.stringContaining("NY.GDP.PCAP.CD"),
          sourceUpdatedAt: "2026-07-13",
          sourceUpdatedAtBasis: "publisher-metadata",
        }],
      },
    });
    expect(tax.countries.find((item) => item.country === "CHN")).toMatchObject({
      value: null,
      exclusionReason: "not-covered-by-oecd-comparable-series",
    });
    expect(publication.measures.debtInterest.countries.find((item) => item.country === "GBR")).toMatchObject({
      source: {
        publisher: "International Monetary Fund",
        additionalSources: [{
          publisher: "World Bank World Development Indicators",
          sourceUpdatedAt: "2026-07-13",
          sourceUpdatedAtBasis: "publisher-metadata",
        }],
      },
    });
    expect(publication.meta.sourceFailures).toEqual([]);
    expect(requestedUrls.filter((url) => url.includes("NY.GDP.PCAP.CD"))).toHaveLength(2);
    expect(requestedUrls.some((url) => url.includes("imf.org/external/datamapper/NGDPDPC"))).toBe(false);
  });

  it("builds seven isolated measures with truthful denominators and derivation inputs", () => {
    const bundle = comparisonSourceBundle({
      gdpPerCapita2023: mapAll(48_000),
      gdpPerCapita2024: mapAll(50_000),
      gdpPerCapita2026: mapAll(61_060),
      population2025: mapAll(70_000_000),
      debtPctGdp2026: new Map(ids.map((id) => [id, id === "GBR" ? 103.6 : 50])),
      interestPctGdp2024: new Map(ids.map((id) => [id, id === "GBR" ? 2.84 : 1])),
      odaUsd2025: new Map(oecdIds.map((id) => [id, id === "GBR" ? 17_200_000_000 : 10_000_000_000])),
      defenceUsd2025: new Map(ids.map((id) => [id, id === "GBR" ? 89_000_000_000 : 20_000_000_000])),
      socialPctGdp2023: new Map(oecdIds.map((id) => [id, id === "GBR" ? 23.0 : 15])),
      healthPerCapita2024: new Map(ids.map((id) => [id, id === "GBR" ? 5_860 : 4_000])),
      taxPctGdp2024: new Map(oecdIds.map((id) => [id, id === "GBR" ? 34.4 : 30])),
    });

    const publication = buildInternationalComparisonPublication(
      bundle,
      new Date("2026-08-18T22:00:00.000Z")
    );

    expect(Object.keys(publication.measures)).toHaveLength(7);
    expect(publication.measures.governmentDebt.countries.find((item) => item.country === "GBR")).toMatchObject({
      value: 63_258.16,
      observationYear: 2026,
      valueType: "projection",
      calculationInputs: { percentGdp: 103.6, gdpPerResidentUsd: 61_060 },
    });
    expect(publication.measures.officialDevelopmentAssistance.countries.find((item) => item.country === "GBR")).toMatchObject({
      observationYear: 2025,
      valueType: "estimate",
      calculationInputs: { totalUsd: 17_200_000_000, population: 70_000_000 },
    });
    expect(publication.measures.defenceSpending.countries.find((item) => item.country === "GBR")).toMatchObject({
      observationYear: 2025,
      valueType: "estimate",
      calculationInputs: { totalUsd: 89_000_000_000, population: 70_000_000 },
    });
    expect(publication.measures.publicSocialExpenditure.countries.find((item) => item.country === "GBR")).toMatchObject({
      observationYear: 2023,
      valueType: "historical",
      calculationInputs: { percentGdp: 23.0, gdpPerResidentUsd: 48_000 },
    });
    expect(publication.measures.officialDevelopmentAssistance.comparableCountryCount).toBe(10);
    expect(publication.measures.officialDevelopmentAssistance.countries.find((item) => item.country === "CHN")).toMatchObject({
      value: null,
      rank: null,
      exclusionReason: "not-covered-by-comparable-donor-series",
    });
    expect(publication.measures.healthcareSpending.countries.find((item) => item.country === "GBR")?.value).toBe(5_860);
    expect(publication.measures.healthcareSpending.lifecycle).toMatchObject({
      status: "historical",
      lastSuccessAt: "2026-08-18T22:00:00.000Z",
      retryAfter: null,
    });
    expect(publication.measures.healthcareSpending.lifecycle.sourceEditionId).toMatch(/^healthcareSpending-2024-/);
    expect(publication.measures.healthcareSpending.lifecycle.sourceEditionId).not.toBe(publication.meta.generatedAt);
    expect(publication.measures.debtInterest.countries.find((item) => item.country === "GBR")?.value).toBeCloseTo(1_420, 4);
  });

  it("creates a new source edition when the publisher reports an updated source date", () => {
    const build = (sourceUpdatedAt: string) => buildInternationalComparisonPublication(
      comparisonSourceBundle({
        gdpPerCapita2023: mapAll(48_000),
        socialPctGdp2023: mapOecd(25),
        sourceUpdates: {
          "oecd-socx-2023": { sourceUpdatedAt, sourceUpdatedAtBasis: "http-last-modified" },
          "world-bank-gdp-per-capita-2023": { sourceUpdatedAt: "2026-07-13", sourceUpdatedAtBasis: "publisher-metadata" },
        },
      }),
      new Date("2026-10-04T10:00:00.000Z"),
    );
    const original = build("2025-10-06");
    const revised = build("2025-11-06");

    expect(original.measures.publicSocialExpenditure.lifecycle?.sourceEditionId)
      .not.toBe(revised.measures.publicSocialExpenditure.lifecycle?.sourceEditionId);
  });

  it("marks only the failed metric unavailable when one source family is missing", () => {
    const bundle = comparisonSourceBundle({
      gdpPerCapita2023: mapAll(48_000),
      gdpPerCapita2024: mapAll(50_000),
      gdpPerCapita2026: mapAll(61_000),
      population2025: mapAll(70_000_000),
      debtPctGdp2026: mapAll(80),
      interestPctGdp2024: mapAll(2),
      odaUsd2025: mapOecd(10_000_000_000),
      defenceUsd2025: mapAll(20_000_000_000),
      socialPctGdp2023: mapOecd(15),
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

  it("retains primary source references for unavailable IMF measures", () => {
    const publication = buildInternationalComparisonPublication(comparisonSourceBundle({
      sourceFailures: ["imf-gdp-2026", "imf-debt-2026", "imf-interest-2024"],
    }), new Date("2026-10-04T10:00:00.000Z"));
    const debt = publication.measures.governmentDebt;
    const interest = publication.measures.debtInterest;

    expect(debt.lifecycle?.status).toBe("unavailable");
    expect(debt.countries.every((item) => item.value === null && item.source === null)).toBe(true);
    expect(debt.sourceReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        publisher: "International Monetary Fund",
        url: expect.stringContaining("/GGXWDG_NGDP/"),
        series: expect.stringContaining("gross general government debt"),
      }),
    ]));
    expect(interest.lifecycle?.status).toBe("unavailable");
    expect(interest.countries.every((item) => item.value === null && item.source === null)).toBe(true);
    expect(interest.sourceReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        publisher: "International Monetary Fund",
        url: expect.stringContaining("/ie/"),
        series: expect.stringContaining("interest paid"),
      }),
    ]));
  });

  it("retains source-backed defence history by common year with population provenance", () => {
    const defence2023 = mapAll(65_000_000_000);
    const population2023 = mapAll(68_000_000);
    const defence2025 = mapAll(89_000_000_000);
    const population2025 = mapAll(70_000_000);
    const publication = buildInternationalComparisonPublication(comparisonSourceBundle({
      gdpPerCapita2023: mapAll(48_000),
      gdpPerCapita2024: mapAll(50_000),
      gdpPerCapita2026: mapAll(61_060),
      population2025,
      populationByYear: new Map([[2023, population2023], [2025, population2025]]),
      debtPctGdp2026: mapAll(80),
      interestPctGdp2024: mapAll(2),
      odaUsd2025: mapOecd(10_000_000_000),
      defenceUsd2025: defence2025,
      defenceUsdByYear: new Map([[2023, defence2023], [2025, defence2025]]),
      socialPctGdp2023: mapOecd(15),
      healthPerCapita2024: mapAll(4_000),
      taxPctGdp2024: mapOecd(30),
    }), new Date("2026-08-18T22:00:00.000Z"));

    expect(publication.measures.defenceSpending.countryHistory).toHaveLength(26);
    expect(publication.measures.defenceSpending.countryHistory?.find((row) => row.country === "GBR" && row.observationYear === 2023)).toMatchObject({
      valueType: "historical",
      value: 65_000_000_000 / 68_000_000,
      source: { publisher: "SIPRI", additionalSources: [{ publisher: "World Bank World Development Indicators" }] },
    });
    expect(publication.measures.defenceSpending.countryHistory?.find((row) => row.country === "GBR" && row.observationYear === 2025)?.valueType).toBe("estimate");
  });
});
