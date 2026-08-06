// @vitest-environment node

import { describe, expect, it } from "vitest";
import { sectionDescriptors } from "@/worker/entry";
import {
  applyFreshnessPolicy,
  SECTION_FRESH_TTL_SECONDS,
} from "@/worker/freshness-policy";

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
      crimeStatistics: 36 * 60 * 60,
    });
  });

  it("applies every configured window to the production Worker descriptors", () => {
    for (const [section, freshTtlSeconds] of Object.entries(
      SECTION_FRESH_TTL_SECONDS
    )) {
      expect(sectionDescriptors[section].freshTtlSeconds).toBe(
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
        ...sectionDescriptors,
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
