// @vitest-environment node

import { describe, expect, it } from "vitest";
import { FEED_REGISTRY } from "@/worker/feed-registry";
import {
  applyFreshnessPolicy,
  SECTION_FRESH_TTL_SECONDS,
} from "@/worker/freshness-policy";

function registryDescriptors() {
  return Object.fromEntries(
    Object.keys(FEED_REGISTRY).map((section) => [section, { source: section, freshTtlSeconds: 0 }]),
  ) as Record<string, { source: string; freshTtlSeconds: number }>;
}

describe("worker freshness policy", () => {
  it("matches the publication-aware retrieval windows", () => {
    expect(SECTION_FRESH_TTL_SECONDS).toEqual({
      bettingOdds: 4 * 60 * 60,
      electionPolling: 14 * 24 * 60 * 60,
      nationalDebt: 40 * 24 * 60 * 60,
      gdpTracker: 36 * 60 * 60,
      sentimentPulse: 36 * 60 * 60,
      taxRevenue: 36 * 60 * 60,
      employmentStats: 36 * 60 * 60,
      nhsStats: 45 * 24 * 60 * 60,
      migrationStats: 36 * 60 * 60,
      housePriceIndex: 45 * 24 * 60 * 60,
      realWages: 36 * 60 * 60,
      crimeStatistics: 36 * 60 * 60,
    });
  });

  it("applies every configured window to the feed-registry section descriptors", () => {
    const descriptors = applyFreshnessPolicy(registryDescriptors());
    for (const [section, freshTtlSeconds] of Object.entries(
      SECTION_FRESH_TTL_SECONDS
    )) {
      expect(descriptors[section].freshTtlSeconds).toBe(
        freshTtlSeconds
      );
    }
  });

  it("fails closed when policy and Worker sections drift apart", () => {
    expect(() => applyFreshnessPolicy({})).toThrow(
      /unknown section 'bettingOdds'/i
    );

    expect(() =>
      applyFreshnessPolicy({
        ...registryDescriptors(),
        newlyAddedSection: { source: "Test", freshTtlSeconds: 100 },
      })
    ).toThrow(/section 'newlyAddedSection' is missing a freshness policy/i);
  });

  it("rejects invalid descriptor registries", () => {
    expect(() => applyFreshnessPolicy(null)).toThrow(
      /descriptors must be an object/i
    );
    expect(() => applyFreshnessPolicy([])).toThrow(
      /descriptors must be an object/i
    );
  });
});
