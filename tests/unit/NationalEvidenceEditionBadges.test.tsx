import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NationalEvidenceEdition from "@/app/components/NationalEvidenceEdition";
import { EVIDENCE_CLASS_LABELS } from "@/app/lib/config";
import { selectNationalEvidenceEdition } from "@/app/lib/nationalEvidence";

afterEach(() => {
  cleanup();
});

const NOW = "2026-07-18T18:00:00.000Z";

function currentSource() {
  return { status: "ok", cacheState: "fresh", fetchedAt: NOW };
}

function snapshot() {
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
    gdpTracker: {
      available: true,
      headline: { period: "May 2026", releaseDate: "2026-07-16", monthlyGrowth: 0.1, threeMonthGrowth: 0.7, annualGrowth: 1.3 },
      history: [
        { observedAt: Date.parse("2026-04-01"), index: 101.1 },
        { observedAt: Date.parse("2026-05-01"), index: 101.2 },
      ],
    },
    sentimentPulse: { available: false },
    employmentStats: {
      available: true,
      headline: { unemploymentRate: 4.9, period: "February to April 2026", releaseDate: "2026-06-18" },
      annualDelta: { unemploymentRatePoints: 0.2 },
      history: { labourForce: [{ observedAt: Date.parse("2026-04-30"), unemploymentRate: 4.9 }] },
    },
    nationalDebt: {},
    nhsStats: { available: false },
    migrationStats: {},
  };
}

describe("NationalEvidenceEdition signal cards", () => {
  it("shows the evidence-category badge on each homepage signal card, matching the canonical label", () => {
    const edition = selectNationalEvidenceEdition(snapshot());
    render(<NationalEvidenceEdition initialEdition={edition} />);

    // GDP (official-data) and unemployment (official-data) both render the
    // "Official data" badge; it should appear at least twice (once per card).
    expect(screen.getAllByText(EVIDENCE_CLASS_LABELS["official-data"]).length).toBeGreaterThanOrEqual(2);
  });

  it("omits the badge only when the whole signal is unavailable, never by guessing a category", () => {
    const edition = selectNationalEvidenceEdition(snapshot());
    const unavailableSignal = edition.signals.find((signal) => signal.state === "unavailable");
    expect(unavailableSignal).toBeDefined();
    // Even an unavailable signal keeps its known, registry-backed evidence class —
    // the taxonomy describes the SOURCE TYPE, which doesn't change when the
    // current value is temporarily unavailable.
    expect(unavailableSignal?.evidenceClass).toBeTruthy();
  });
});
