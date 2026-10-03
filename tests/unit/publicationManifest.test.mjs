// @vitest-environment node

import { describe, expect, it } from "vitest";
import { currentPublicationManifest } from "../../scripts/publication-manifest.mjs";
import {
  FEED_REGISTRY_VERSION,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "../../worker/feed-registry.js";

function publication(missing = [], now = new Date()) {
  const fetchedAt = new Date(now.getTime() - 30_000).toISOString();
  const observedAt = new Date(now.getTime() - 60_000).toISOString();
  const validUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
  const sources = {};
  const sections = {};

  for (const section of REQUIRED_PUBLISHED_SECTION_IDS) {
    if (missing.includes(section)) continue;
    sources[section] = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt,
      provenance: { section },
    };
    sections[section] = {
      expiresAt: validUntil,
      __observation: {
        status: "current",
        period: "Current test period",
        observedAt,
        maxAgeDays: 30,
      },
    };
    if (section === "sentimentPulse") {
      sections[section].__measureValidity = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [
          id,
          { validUntil },
        ])
      );
      sections[section].series = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [
          id,
          { status: "current", value: 1 },
        ])
      );
    }
  }

  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: now.toISOString(),
      sources,
    },
    ...sections,
  };
}

describe("current publication manifest", () => {
  it("counts only current required sections as present", () => {
    const now = new Date("2026-10-02T18:00:00.000Z");
    const result = currentPublicationManifest(publication([], now), now);

    expect(result.missingRequiredSections).toEqual([]);
  });

  it("treats errored, stale and expired required sections as missing", () => {
    const now = new Date("2026-10-02T18:00:00.000Z");
    const snapshot = publication([], now);
    snapshot.meta.sources.gdpTracker.status = "error";
    snapshot.meta.sources.employmentStats.cacheState = "stale";
    delete snapshot.employmentStats.expiresAt;
    snapshot.nationalDebt.expiresAt = new Date(now.getTime() - 1).toISOString();

    expect(currentPublicationManifest(snapshot, now).missingRequiredSections).toEqual(
      ["employmentStats", "gdpTracker", "nationalDebt"]
    );
  });

  it("treats a missing data member as unavailable even when its source record exists", () => {
    const now = new Date("2026-10-02T18:00:00.000Z");
    const snapshot = publication([], now);
    delete snapshot.migrationStats;

    expect(currentPublicationManifest(snapshot, now).missingRequiredSections).toEqual(
      ["migrationStats"]
    );
  });
});
