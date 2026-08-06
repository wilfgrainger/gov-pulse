import { describe, expect, it } from "vitest";
import { selectNationalEvidenceEdition } from "../../app/lib/nationalEvidence";
import { FEED_REGISTRY_VERSION } from "../../worker/feed-registry";

const NOW = "2026-07-18T18:00:00.000Z";

function currentSource() {
  return { status: "ok", cacheState: "fresh", fetchedAt: NOW };
}

function snapshot() {
  return {
    meta: {
      registryVersion: FEED_REGISTRY_VERSION,
      generatedAt: NOW,
      sources: {
        gdpTracker: currentSource(),
        sentimentPulse: currentSource(),
        nationalDebt: currentSource(),
        nhsStats: currentSource(),
        migrationStats: currentSource(),
        electionPolling: currentSource(),
      },
    },
    gdpTracker: {
      available: true,
      headline: {
        period: "May 2026",
        releaseDate: "2026-07-16",
        monthlyGrowth: 0.1,
        threeMonthGrowth: 0.7,
        annualGrowth: 1.3,
      },
      history: [
        { observedAt: Date.parse("2026-04-01"), index: 101.1 },
        { observedAt: Date.parse("2026-05-01"), index: 101.2 },
      ],
    },
    sentimentPulse: {
      available: true,
      series: {
        inflation: {
          value: 3.4,
          period: "May 2026",
          publishedAt: "2026-06-18T06:00:00.000Z",
          annualDelta: 0.2,
          history: [
            { observedAt: "2026-04-01T00:00:00.000Z", value: 3.2 },
            { observedAt: "2026-05-01T00:00:00.000Z", value: 3.4 },
          ],
        },
        bankRate: {
          value: 3.75,
          period: "5 February 2026",
          publishedAt: "2026-02-05T12:00:00.000Z",
          annualDelta: -0.75,
          history: [
            { observedAt: "2025-12-18T00:00:00.000Z", value: 4 },
            { observedAt: "2026-02-05T00:00:00.000Z", value: 3.75 },
          ],
        },
        unemployment: {
          value: 4.9,
          period: "February to April 2026",
          publishedAt: "2026-06-18T06:00:00.000Z",
          annualDelta: 0.2,
          history: [
            { observedAt: "2026-03-01T00:00:00.000Z", value: 4.8 },
            { observedAt: "2026-04-01T00:00:00.000Z", value: 4.9 },
          ],
        },
      },
    },
    nationalDebt: {
      baseDebt: 2_984_300_000_000,
      baseDate: Date.parse("2026-05-31T00:00:00.000Z"),
      observationPeriod: "May 2026",
      publicationDate: "2026-06-19",
      debtToGdp: 95.1,
      annualDelta: { debtBillion: 116.8 },
      history: [
        { observedAt: Date.parse("2026-04-30"), debtBillion: 2_940.8 },
        { observedAt: Date.parse("2026-05-31"), debtBillion: 2_984.3 },
      ],
    },
    nhsStats: {
      available: true,
      headline: {
        period: "May 2026",
        publicationDate: "2026-07-10",
        waitingPathwaysEstimate: 7_390_000,
        yearChangePercent: -1.1,
        within18WeeksPercent: 61.7,
      },
      history: [
        { observedAt: Date.parse("2026-04-30"), waitingPathwaysEstimate: 7_420_000 },
        { observedAt: Date.parse("2026-05-31"), waitingPathwaysEstimate: 7_390_000 },
      ],
    },
    migrationStats: {
      headline: {
        period: "YE Dec 2025",
        releaseDate: "2026-05-21",
        netMigration: 431_000,
        previousPeriod: "YE Dec 2024",
        changePercent: -49,
      },
      history: [
        { observedAt: Date.parse("2024-12-31"), netMigration: 860_000 },
        { observedAt: Date.parse("2025-12-31"), netMigration: 431_000 },
      ],
    },
    electionPolling: {
      available: true,
      polls: [
        {
          pollster: "YouGov",
          publicationDate: "2026-07-06",
          fieldworkStart: "2026-07-05",
          fieldworkEnd: "2026-07-06",
          parties: { reformUK: 24, conservative: 20, labour: 20, green: 13, other: 23 },
          uncertainty: "Published estimates carry an uncertainty interval.",
        },
      ],
    },
  };
}

describe("national evidence presentation", () => {
  it("selects one lead and eight separately dated signal cards", () => {
    const edition = selectNationalEvidenceEdition(snapshot());

    expect(edition.lead?.id).toBe("gdp");
    expect(edition.lead?.leadHeadline).toBe("UK GDP grew in May 2026 by 0.1%.");
    expect(edition.signals).toHaveLength(8);
    expect(edition.counts.current).toBe(8);
    expect(edition.signals.find((signal) => signal.id === "national-debt")?.value).toBe("£2.98tn");
    expect(edition.signals.find((signal) => signal.id === "nhs-waiting-list")?.value).toBe("7.39m pathways");
    expect(edition.signals.find((signal) => signal.id === "latest-poll")?.value).toBe("24% Reform UK");
  });

  it("does not align economic series onto one shared period", () => {
    const edition = selectNationalEvidenceEdition(snapshot());

    expect(edition.signals.find((signal) => signal.id === "inflation")?.period).toBe("May 2026");
    expect(edition.signals.find((signal) => signal.id === "bank-rate")?.period).toBe("5 February 2026");
    expect(edition.signals.find((signal) => signal.id === "unemployment")?.period).toBe("February to April 2026");
  });

  it("labels retained stale evidence and suppresses unsupported values", () => {
    const payload = snapshot();
    payload.meta.sources.gdpTracker = { status: "stale", cacheState: "stale", fetchedAt: NOW };
    payload.meta.sources.nationalDebt = { status: "error", cacheState: "missing", fetchedAt: NOW };

    const edition = selectNationalEvidenceEdition(payload);

    expect(edition.signals.find((signal) => signal.id === "gdp")?.state).toBe("update-due");
    expect(edition.signals.find((signal) => signal.id === "gdp")?.value).toBe("+0.1%");
    expect(edition.signals.find((signal) => signal.id === "national-debt")?.state).toBe("unavailable");
    expect(edition.signals.find((signal) => signal.id === "national-debt")?.value).toBeNull();
  });

  it("fails closed for an incompatible publication", () => {
    const payload = snapshot();
    payload.meta.registryVersion = "obsolete";

    const edition = selectNationalEvidenceEdition(payload);

    expect(edition.lead).toBeNull();
    expect(edition.counts.unavailable).toBe(8);
    expect(edition.signals.every((signal) => signal.value === null)).toBe(true);
  });
});
