import { describe, expect, it } from "vitest";
import { DATA_SOURCES } from "@/app/lib/config";
import { SECTIONS, WITHDRAWN_SECTION_IDS } from "@/app/lib/sections";
import { SECTION_CONTENT } from "@/app/lib/sectionContent";
import { AUTOMATED_METRIC_KEYS } from "@/app/lib/metricFallbacks";
import { FEED_REGISTRY } from "@/worker/feed-registry";

function workerManagedAutomatedKeys() {
  return Object.entries(DATA_SOURCES)
    .filter(
      ([, meta]) =>
        meta.automation === "automated" && meta.collectionLayer !== "publication"
    )
    .map(([key]) => key)
    .sort();
}

describe("metadata contracts", () => {
  it("keeps Worker-managed automated sections aligned with local fallbacks", () => {
    expect(workerManagedAutomatedKeys()).toEqual([...AUTOMATED_METRIC_KEYS].sort());
  });

  it("keeps Worker-managed automated sections aligned with the feed registry", () => {
    expect(workerManagedAutomatedKeys()).toEqual(Object.keys(FEED_REGISTRY).sort());
  });

  it("keeps publication-managed automation out of the feed registry", () => {
    const publicationKeys = Object.entries(DATA_SOURCES)
      .filter(
        ([, meta]) =>
          meta.automation === "automated" && meta.collectionLayer === "publication"
      )
      .map(([key]) => key)
      .sort();

    expect(publicationKeys).toEqual(["governmentContracts"]);
    expect(AUTOMATED_METRIC_KEYS).not.toContain("governmentContracts");
    expect(FEED_REGISTRY).not.toHaveProperty("governmentContracts");
  });

  it("keeps active navigation and direct withdrawn routes aligned with section pages", () => {
    const navIds = SECTIONS.flatMap((group) =>
      group.sections.map((section) => section.id)
    ).sort();
    const withdrawnIds = [...WITHDRAWN_SECTION_IDS].sort();
    const withdrawnSet = new Set<string>(withdrawnIds);

    expect(navIds.filter((id) => withdrawnSet.has(id))).toEqual([]);
    expect([...navIds, ...withdrawnIds].sort()).toEqual(
      Object.keys(SECTION_CONTENT).sort()
    );
  });

  it("marks all unreproducible routes as withdrawn rather than snapshots", () => {
    const withdrawnKeys = [
      "pmApproval",
      "polarizationMeter",
      "trendLines",
      "geographicHeatmap",
      "echoChamberMap",
    ];

    for (const key of withdrawnKeys) {
      expect(DATA_SOURCES[key].automation).toBe("withdrawn");
      expect(DATA_SOURCES[key].frequency).toBe("withdrawn");
      expect(DATA_SOURCES[key].sources.join(" ")).toMatch(/No current/i);
    }

    expect(
      Object.entries(DATA_SOURCES)
        .filter(([, meta]) => meta.automation === "withdrawn")
        .map(([key]) => key)
        .sort()
    ).toEqual([...withdrawnKeys].sort());
  });

  it("labels the derived routes as withdrawn evidence", () => {
    expect(SECTION_CONTENT["uk-regions"]).toMatchObject({
      title: "UK regional comparison",
      tag: "Withdrawn derived evidence",
    });
    expect(SECTION_CONTENT["policy-links"]).toMatchObject({
      title: "Policy relationships",
      tag: "Withdrawn derived evidence",
    });
  });
});