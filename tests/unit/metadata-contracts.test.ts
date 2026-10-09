import { describe, expect, it } from "vitest";
import { DATA_SOURCES } from "@/app/lib/config";
import { SECTIONS } from "@/app/lib/sections";
import { SECTION_CONTENT } from "@/app/lib/sectionContent";
import { AUTOMATED_METRIC_KEYS } from "@/app/lib/metricFallbacks";
import { FEED_REGISTRY } from "@/worker/feed-registry";
import { sectionDescriptors } from "@/worker/index";

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

  it("keeps Worker-managed automated sections aligned with worker descriptors", () => {
    expect(workerManagedAutomatedKeys()).toEqual(Object.keys(sectionDescriptors).sort());
  });

  it("keeps Worker-managed automated sections aligned with the feed registry", () => {
    expect(workerManagedAutomatedKeys()).toEqual(Object.keys(FEED_REGISTRY).sort());
  });

  it("keeps publication-managed automation out of the Worker contract", () => {
    const publicationKeys = Object.entries(DATA_SOURCES)
      .filter(
        ([, meta]) =>
          meta.automation === "automated" && meta.collectionLayer === "publication"
      )
      .map(([key]) => key)
      .sort();

    expect(publicationKeys).toEqual(["governmentContracts"]);
    expect(AUTOMATED_METRIC_KEYS).not.toContain("governmentContracts");
    expect(sectionDescriptors).not.toHaveProperty("governmentContracts");
    expect(FEED_REGISTRY).not.toHaveProperty("governmentContracts");
  });

  it("keeps active navigation aligned with section pages", () => {
    const navIds = SECTIONS.flatMap((group) =>
      group.sections.map((section) => section.id)
    ).sort();

    expect(navIds).toEqual(Object.keys(SECTION_CONTENT).sort());
  });

  it("removes retired products instead of keeping withdrawn pseudo-sources", () => {
    for (const key of ["pmApproval", "polarizationMeter", "trendLines", "geographicHeatmap", "echoChamberMap", "politicalCompass"]) {
      expect(DATA_SOURCES).not.toHaveProperty(key);
    }
    expect(
      Object.entries(DATA_SOURCES)
        .filter(([, meta]) => meta.automation === "withdrawn")
        .map(([key]) => key)
    ).toEqual([]);
  });

  it("removes retired routes from section pages", () => {
    for (const route of ["pm-approval", "govt-approval", "gov-trust-trend", "uk-regions", "policy-links"]) {
      expect(SECTION_CONTENT).not.toHaveProperty(route);
    }
  });
});
