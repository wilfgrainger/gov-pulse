// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  filterCurrentSnapshot,
  sectionCurrentness,
  snapshotValidityDeadline,
} from "@/worker/publication-currentness";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";

function source(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    cacheState: "fresh",
    fetchedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function data(overrides: Record<string, unknown> = {}) {
  return {
    value: 1,
    __observation: {
      status: "current",
      period: "July 2026",
      observedAt: "2026-07-31T00:00:00.000Z",
      maxAgeDays: 45,
    },
    ...overrides,
  };
}

describe("publication currentness", () => {
  it("accepts a coherent current source-owned section", () => {
    expect(
      sectionCurrentness(
        "gdpTracker",
        data(),
        source(),
        new Date("2026-08-01T11:00:00.000Z")
      )
    ).toEqual({ current: true, reason: "current" });
  });

  it("requires observation metadata when provenance marks evidence as source-owned", () => {
    expect(
      sectionCurrentness(
        "gdpTracker",
        { value: 1 },
        source({ provenance: { section: "gdpTracker" } }),
        new Date("2026-08-01T11:00:00.000Z")
      ).reason
    ).toBe("missing-observation");
  });

  it("rejects malformed and future retrieval clocks", () => {
    expect(
      sectionCurrentness(
        "gdpTracker",
        data(),
        source({ fetchedAt: "1 August 2026" }),
        new Date("2026-08-01T11:00:00.000Z")
      ).reason
    ).toBe("missing-retrieval-time");
    expect(
      sectionCurrentness(
        "gdpTracker",
        data(),
        source({ fetchedAt: "2026-08-01T12:00:00.000Z" }),
        new Date("2026-08-01T11:00:00.000Z")
      ).reason
    ).toBe("retrieval-in-future");
  });

  it("rejects expired evidence at the exact boundary", () => {
    expect(
      sectionCurrentness(
        "bettingOdds",
        { value: 1, expiresAt: "2026-08-01T11:00:00.000Z" },
        source({ fetchedAt: "2026-08-01T09:00:00.000Z" }),
        new Date("2026-08-01T11:00:00.000Z")
      ).reason
    ).toBe("explicit-expiry");
  });

  it("uses an explicit publication expiry instead of aging from the observation period", () => {
    expect(
      sectionCurrentness(
        "nhsStats",
        data({
          expiresAt: "2026-08-23T00:00:00.000Z",
          __observation: {
            status: "current",
            period: "May 2026",
            observedAt: "2026-05-31T00:00:00.000Z",
            maxAgeDays: 45,
          },
        }),
        source({ fetchedAt: "2026-08-04T10:00:00.000Z" }),
        new Date("2026-08-04T11:00:00.000Z")
      )
    ).toEqual({ current: true, reason: "current" });
  });

  it("rejects impossible observation chronology", () => {
    expect(
      sectionCurrentness(
        "gdpTracker",
        data({
          __observation: {
            status: "current",
            observedAt: "2026-08-01T10:30:00.000Z",
            maxAgeDays: 45,
          },
        }),
        source({ fetchedAt: "2026-08-01T10:00:00.000Z" }),
        new Date("2026-08-01T11:00:00.000Z")
      ).reason
    ).toBe("observation-after-retrieval");
  });

  it("removes expired and unowned payloads and reconciles verified sections", () => {
    const snapshot = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        verifiedSections: ["gdpTracker", "bettingOdds", "orphan"],
        sources: {
          gdpTracker: source(),
          bettingOdds: source({ fetchedAt: "2026-08-01T05:00:00.000Z" }),
        },
      },
      gdpTracker: data(),
      bettingOdds: { value: 2 },
      orphan: { value: 3 },
    };

    const filtered = filterCurrentSnapshot(
      snapshot,
      new Date("2026-08-01T11:00:00.000Z")
    );

    expect(filtered?.gdpTracker).toBeDefined();
    expect(filtered?.bettingOdds).toBeUndefined();
    expect(filtered?.orphan).toBeUndefined();
    expect(filtered?.meta.verifiedSections).toEqual(["gdpTracker"]);
  });

  it("returns the earliest current evidence deadline", () => {
    const snapshot = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: {
          gdpTracker: source(),
          bettingOdds: source({ fetchedAt: "2026-08-01T09:00:00.000Z" }),
        },
      },
      gdpTracker: data(),
      bettingOdds: { value: 2, expiresAt: "2026-08-01T12:30:00.000Z" },
    };

    expect(
      snapshotValidityDeadline(snapshot, new Date("2026-08-01T11:00:00.000Z"))
    ).toBe(Date.parse("2026-08-01T12:30:00.000Z"));
  });

  it("uses explicit expiry instead of the observation-age deadline", () => {
    const snapshot = {
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: { nhsStats: source({ fetchedAt: "2026-08-04T10:00:00.000Z" }) },
      },
      nhsStats: data({
        expiresAt: "2026-08-23T00:00:00.000Z",
        __observation: {
          status: "current",
          period: "May 2026",
          observedAt: "2026-05-31T00:00:00.000Z",
          maxAgeDays: 45,
        },
      }),
    };

    expect(
      snapshotValidityDeadline(snapshot, new Date("2026-08-04T11:00:00.000Z")),
    ).toBe(Date.parse("2026-08-23T00:00:00.000Z"));
  });
});
