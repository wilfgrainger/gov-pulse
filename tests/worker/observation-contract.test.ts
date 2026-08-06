import { describe, expect, it } from "vitest";
import {
  applyObservationContracts,
  parsePeriod,
} from "../../worker/observation-contract.js";

type WrappedObservation = {
  __observation: {
    status: string;
    period: string;
    observedAt: string;
  };
};

function published(period: string, observedAt: number, releaseDate: string) {
  return { headline: { period, observedAt, releaseDate } };
}

function nhsPublished(period: string, observedAt: number, publicationDate: string) {
  return { headline: { period, observedAt, publicationDate } };
}

function currentDescriptors() {
  return {
    electionPolling: {
      build: async () => ({ recentPolls: [{ date: "18–19 Jul" }] }),
    },
    sentimentPulse: {
      build: async () => ({ economicData: [{ date: "Jun 26" }] }),
    },
    gdpTracker: {
      build: async () => published("May 2026", Date.UTC(2026, 5, 0), "2026-07-10"),
    },
    employmentStats: {
      build: async () =>
        published("March to May 2026", Date.UTC(2026, 5, 0), "2026-07-16"),
    },
    nationalDebt: { build: async () => ({ baseDate: Date.UTC(2026, 4, 31) }) },
    taxRevenue: {
      build: async () => published("May 2026", Date.UTC(2026, 5, 0), "2026-06-19"),
    },
    migrationStats: {
      build: async () =>
        published("YE December 2025", Date.UTC(2025, 12, 0), "2026-05-21"),
    },
    nhsStats: {
      build: async () => nhsPublished("May 2026", Date.UTC(2026, 5, 0), "2026-07-09"),
    },
    crimeStatistics: {
      build: async () => published("Year ending Mar 2024", Date.UTC(2024, 3, 0), "2024-07-24"),
    },
  };
}

describe("observation currentness contracts", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("parses monthly, quarterly and polling periods deterministically", () => {
    expect(parsePeriod("2026 MAY", now)?.toISOString()).toBe(
      "2026-05-01T00:00:00.000Z"
    );
    expect(parsePeriod("2026 Q1", now)?.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z"
    );
    expect(parsePeriod("18–19 Jul", now)?.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z"
    );
    expect(parsePeriod("2026 XYZ", now)).toBeNull();
    expect(parsePeriod("XYZ 26", now)).toBeNull();
  });

  it("uses the GDP publication date for freshness and preserves the observation month", async () => {
    const descriptors = currentDescriptors();
    applyObservationContracts(descriptors, () => now);

    const result = (await descriptors.gdpTracker.build()) as unknown as WrappedObservation;

    expect(result.__observation).toMatchObject({
      status: "current",
      period: "May 2026",
      observedAt: "2026-05-31T00:00:00.000Z",
    });
  });

  it("preserves separate labour, migration and NHS observation periods", async () => {
    const descriptors = currentDescriptors();
    applyObservationContracts(descriptors, () => now);

    const employment = (await descriptors.employmentStats.build()) as unknown as WrappedObservation;
    const migration = (await descriptors.migrationStats.build()) as unknown as WrappedObservation;
    const nhs = (await descriptors.nhsStats.build()) as unknown as WrappedObservation;

    expect(employment.__observation).toMatchObject({
      period: "March to May 2026",
      observedAt: "2026-05-31T00:00:00.000Z",
    });
    expect(migration.__observation).toMatchObject({
      period: "YE December 2025",
      observedAt: "2025-12-31T00:00:00.000Z",
    });
    expect(nhs.__observation).toMatchObject({
      period: "May 2026",
      observedAt: "2026-05-31T00:00:00.000Z",
    });
  });

  it("fails closed when economy feeds expose old publication dates", async () => {
    const descriptors = {
      ...currentDescriptors(),
      gdpTracker: {
        build: async () => published("2024", Date.UTC(2024, 11, 31), "2025-01-01"),
      },
      employmentStats: {
        build: async () => published("2024", Date.UTC(2024, 11, 31), "2025-01-01"),
      },
      taxRevenue: {
        build: async () => published("2024", Date.UTC(2024, 11, 31), "2025-01-01"),
      },
    };
    applyObservationContracts(descriptors, () => now);

    await expect(descriptors.gdpTracker.build()).rejects.toThrow(
      /outside its 70-day currentness contract/i
    );
    await expect(descriptors.employmentStats.build()).rejects.toThrow(
      /outside its 70-day currentness contract/i
    );
    await expect(descriptors.taxRevenue.build()).rejects.toThrow(
      /outside its 70-day currentness contract/i
    );
  });

  it("fails closed when NHS exposes an old publication date", async () => {
    const descriptors = {
      ...currentDescriptors(),
      nhsStats: {
        build: async () =>
          nhsPublished("March 2026", Date.UTC(2026, 3, 0), "2026-04-01"),
      },
    };
    applyObservationContracts(descriptors, () => now);

    await expect(descriptors.nhsStats.build()).rejects.toThrow(
      /outside its 45-day currentness contract/i
    );
  });

  it("fails closed when a publication payload is incomplete", async () => {
    const descriptors = {
      ...currentDescriptors(),
      taxRevenue: { build: async () => ({ headline: { period: "May 2026" } }) },
      nhsStats: { build: async () => ({ headline: { period: "May 2026" } }) },
    };
    applyObservationContracts(descriptors, () => now);

    await expect(descriptors.taxRevenue.build()).rejects.toThrow(
      /did not expose a verifiable observation period/i
    );
    await expect(descriptors.nhsStats.build()).rejects.toThrow(
      /did not expose a verifiable observation period/i
    );
  });

  it("fails closed when an upstream series is not an array", async () => {
    const descriptors = {
      ...currentDescriptors(),
      electionPolling: { build: async () => ({ recentPolls: { error: true } }) },
    };

    applyObservationContracts(descriptors, () => now);
    await expect(descriptors.electionPolling.build()).rejects.toThrow(
      /did not expose a verifiable observation period/i
    );
  });
});
