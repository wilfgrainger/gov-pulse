// @vitest-environment node

import { describe, expect, it } from "vitest";
import { isOfficialEconomyRecord } from "@/worker/section-builders";

const points = Array.from({ length: 13 }, (_, index) => ({
  period: `Month ${index + 1}`,
  observedAt: Date.UTC(2025, 4 + index, 0),
}));

const gdpData = {
  available: true,
  headline: {
    period: "May 2026",
    observedAt: Date.UTC(2026, 5, 0),
    releaseDate: "2026-07-10",
    monthlyGrowth: 0.1,
    threeMonthGrowth: 0.5,
    annualGrowth: 1.3,
  },
  history: points.map((point) => ({
    ...point,
    index: 103.2,
    monthlyGrowth: 0.1,
    annualGrowth: 1.3,
    threeMonthGrowth: 0.5,
  })),
  methodology: { measure: "Real GDP", status: "Official", revisionNote: "Revisable" },
  source: {
    bulletinUrl: "https://www.ons.gov.uk/gdp/may2026",
    landingUrl: "https://www.ons.gov.uk/gdp",
  },
};

const employmentData = {
  available: true,
  headline: {
    period: "March to May 2026",
    observedAt: Date.UTC(2026, 5, 0),
    releaseDate: "2026-07-16",
    employmentRate: 75.1,
    unemploymentRate: 5.2,
    inactivityRate: 21,
    vacancies: 721000,
    vacanciesPeriod: "April to June 2026",
  },
  annualDelta: {
    employmentRatePoints: 0.3,
    unemploymentRatePoints: 0.4,
    inactivityRatePoints: -0.4,
    vacancies: -39_000,
  },
  history: {
    labourForce: points.map((point) => ({
      ...point,
      employmentRate: 75.1,
      unemploymentRate: 5.2,
      inactivityRate: 21,
    })),
    vacancies: points.map((point) => ({ ...point, vacancies: 721_000 })),
  },
  methodology: { status: "Official", caveat: "Sampling uncertainty" },
  source: {
    bulletinUrl: "https://www.ons.gov.uk/labour/july2026",
    landingUrl: "https://www.ons.gov.uk/labour",
  },
};

const taxData = {
  available: true,
  headline: {
    period: "May 2026",
    observedAt: Date.UTC(2026, 5, 0),
    releaseDate: "2026-06-19",
    receiptsBillion: 93.7,
    yearChangeBillion: 8.2,
  },
  methodology: { measure: "Central government receipts", status: "Official", caveat: "Revisable" },
  source: {
    bulletinUrl: "https://www.ons.gov.uk/finances/may2026",
    landingUrl: "https://www.ons.gov.uk/finances",
  },
  history: points.map((point) => ({ ...point, receiptsBillion: 93.7 })),
};

describe("economy evidence record validation", () => {
  it("rejects each legacy mixed dashboard shape", () => {
    expect(isOfficialEconomyRecord("gdpTracker", { data: { gdpHistory: [] } })).toBe(false);
    expect(isOfficialEconomyRecord("employmentStats", { data: { publicVsPrivate: [] } })).toBe(false);
    expect(isOfficialEconomyRecord("taxRevenue", { data: { taxCategories: [] } })).toBe(false);
  });

  it("recognises the three complete official bulletin shapes", () => {
    expect(isOfficialEconomyRecord("gdpTracker", { data: gdpData })).toBe(true);
    expect(isOfficialEconomyRecord("employmentStats", { data: employmentData })).toBe(true);
    expect(isOfficialEconomyRecord("taxRevenue", { data: taxData })).toBe(true);
  });
});
