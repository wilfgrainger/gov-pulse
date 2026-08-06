// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  createEconomySectionCache,
  isOfficialEconomyRecord,
} from "@/worker/economy-section-cache";

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

describe("economy evidence cache migration", () => {
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

  it("replaces a legacy cached GDP record on first request", async () => {
    const store = new Map<string, unknown>([
      [
        "v10:section:gdpTracker",
        {
          section: "gdpTracker",
          data: { gdpHistory: [{ year: "2025F", growth: 1.1 }] },
          fetchedAt: new Date().toISOString(),
        },
      ],
    ]);
    const put = vi.fn(async (key: string, value: string) => {
      store.set(key, JSON.parse(value));
    });
    const descriptors = {
      gdpTracker: {
        source: "ONS GDP bulletin",
        freshTtlSeconds: 36 * 60 * 60,
        build: vi.fn().mockResolvedValue(gdpData),
      },
      employmentStats: {
        source: "ONS labour bulletin",
        freshTtlSeconds: 36 * 60 * 60,
        build: vi.fn().mockResolvedValue(employmentData),
      },
      taxRevenue: {
        source: "ONS finances bulletin",
        freshTtlSeconds: 36 * 60 * 60,
        build: vi.fn().mockResolvedValue(taxData),
      },
    };
    const cache = createEconomySectionCache(descriptors);
    const env = {
      METRICS_CACHE: {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put,
      },
    };

    const record = await cache.ensure("gdpTracker", env);

    expect(record.data).toEqual(gdpData);
    expect(descriptors.gdpTracker.build).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith("v10:section:gdpTracker", expect.any(String));
  });

  it("reuses a complete fresh official record without another upstream request", async () => {
    const record = {
      section: "taxRevenue",
      data: taxData,
      fetchedAt: new Date().toISOString(),
      backend: "verified-data-service",
    };
    const descriptors = {
      gdpTracker: { source: "ONS", freshTtlSeconds: 3600, build: vi.fn() },
      employmentStats: { source: "ONS", freshTtlSeconds: 3600, build: vi.fn() },
      taxRevenue: { source: "ONS", freshTtlSeconds: 3600, build: vi.fn() },
    };
    const cache = createEconomySectionCache(descriptors);
    const env = {
      METRICS_CACHE: {
        get: vi.fn().mockResolvedValue(record),
        put: vi.fn(),
      },
    };

    await expect(cache.ensure("taxRevenue", env)).resolves.toBe(record);
    expect(descriptors.taxRevenue.build).not.toHaveBeenCalled();
  });
});
