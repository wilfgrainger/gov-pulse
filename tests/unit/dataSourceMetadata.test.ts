import { describe, expect, it } from "vitest";
import {
  DATA_SOURCES,
  EVIDENCE_CLASS_DESCRIPTIONS,
  EVIDENCE_CLASS_LABELS,
} from "@/app/lib/config";
import { DATA_SOURCE_DETAILS } from "@/app/lib/dataSourceDetails";

describe("data source evidence metadata", () => {
  it("defines evidence class and geographic coverage for every section", () => {
    for (const [section, meta] of Object.entries(DATA_SOURCES)) {
      expect(EVIDENCE_CLASS_LABELS[meta.evidenceClass], `${section} evidence label`).toBeTruthy();
      expect(EVIDENCE_CLASS_DESCRIPTIONS[meta.evidenceClass], `${section} evidence description`).toBeTruthy();
      expect(meta.geographicCoverage.trim(), `${section} geographic coverage`).not.toBe("");
    }
  });

  it("defines publication, unit, revision and caveat context for every section", () => {
    expect(Object.keys(DATA_SOURCE_DETAILS).sort()).toEqual(Object.keys(DATA_SOURCES).sort());

    for (const [section, detail] of Object.entries(DATA_SOURCE_DETAILS)) {
      expect(detail.publicationPeriod.trim(), `${section} publication period`).not.toBe("");
      expect(detail.unit.trim(), `${section} unit`).not.toBe("");
      expect(detail.revisionStatus.trim(), `${section} revision status`).not.toBe("");
      expect(detail.caveat.trim(), `${section} caveat`).not.toBe("");
    }
  });

  it("keeps known geography, evidence and interpretation distinctions explicit", () => {
    expect(DATA_SOURCES.crimeStatistics.geographicCoverage).toBe("England and Wales");
    expect(DATA_SOURCES.nhsStats.geographicCoverage).toBe("England");
    expect(DATA_SOURCES.electionPolling.geographicCoverage).toBe("Great Britain");
    expect(DATA_SOURCES.bettingOdds.evidenceClass).toBe("market-signal");
    expect(DATA_SOURCE_DETAILS.bettingOdds.caveat).toContain("neither official statistics nor official forecasts");
    expect(DATA_SOURCE_DETAILS.crimeStatistics.caveat).toContain("never added into one total");
    expect(DATA_SOURCE_DETAILS.crimeStatistics.caveat).toContain("Regional rankings remain unavailable");
    expect(DATA_SOURCE_DETAILS.employmentStats.caveat).toContain("rolling three-month periods");
  });

  it("removes retired products from source metadata instead of keeping withdrawn pseudo-sources", () => {
    for (const section of ["pmApproval", "polarizationMeter", "trendLines", "geographicHeatmap", "echoChamberMap", "politicalCompass"]) {
      expect(DATA_SOURCES).not.toHaveProperty(section);
      expect(DATA_SOURCE_DETAILS).not.toHaveProperty(section);
    }
    expect(Object.values(DATA_SOURCES).filter((source) => source.automation === "withdrawn")).toEqual([]);
  });
});
