import { describe, expect, it } from "vitest";
import { DATA_SOURCES } from "@/app/lib/config";
import { selectNationalEvidenceEdition } from "@/app/lib/nationalEvidence";

const NOW = "2026-07-18T18:00:00.000Z";

function currentSource() {
  return { status: "ok", cacheState: "fresh", fetchedAt: NOW };
}

function minimalSnapshot() {
  return {
    meta: {
      registryVersion: "test",
      generatedAt: NOW,
      sources: {
        gdpTracker: currentSource(),
        sentimentPulse: currentSource(),
        employmentStats: currentSource(),
        nationalDebt: currentSource(),
        nhsStats: currentSource(),
        migrationStats: currentSource(),
        electionPolling: currentSource(),
      },
    },
    gdpTracker: { available: false },
    sentimentPulse: { available: false },
    employmentStats: { available: false },
    nationalDebt: {},
    nhsStats: { available: false },
    migrationStats: {},
  };
}

describe("national evidence signal evidenceClass", () => {
  it("derives each homepage signal's evidence class from the canonical feed-registry-backed taxonomy, not an invented one", () => {
    const edition = selectNationalEvidenceEdition(minimalSnapshot());
    const bySignal = Object.fromEntries(edition.signals.map((signal) => [signal.id, signal.evidenceClass]));

    expect(bySignal.gdp).toBe(DATA_SOURCES.gdpTracker.evidenceClass);
    expect(bySignal.inflation).toBe(DATA_SOURCES.sentimentPulse.evidenceClass);
    expect(bySignal.unemployment).toBe(DATA_SOURCES.employmentStats.evidenceClass);
    expect(bySignal["national-debt"]).toBe(DATA_SOURCES.nationalDebt.evidenceClass);
    expect(bySignal["nhs-waiting-list"]).toBe(DATA_SOURCES.nhsStats.evidenceClass);
    expect(bySignal["net-migration"]).toBe(DATA_SOURCES.migrationStats.evidenceClass);
  });

  it("only uses evidence classes that are objective evidence types, never a synthesized score", () => {
    const edition = selectNationalEvidenceEdition(minimalSnapshot());
    const validClasses = new Set([
      "official-data",
      "public-opinion",
      "market-signal",
      "derived-analysis",
      "user-generated",
    ]);
    for (const signal of edition.signals) {
      expect(validClasses.has(signal.evidenceClass), `${signal.id} evidenceClass`).toBe(true);
    }
  });
});
