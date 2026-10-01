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
        employmentStats: currentSource(),
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
    employmentStats: {
      available: true,
      headline: { unemploymentRate: 4.9, period: "February to April 2026", releaseDate: "2026-06-18" },
      annualDelta: { unemploymentRatePoints: 0.2 },
      history: { labourForce: [
        { observedAt: Date.parse("2026-04-30"), unemploymentRate: 4.9 },
      ] },
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
        immigration: 813_000,
        emigration: 642_000,
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
  it("selects one lead and six separately dated official signal cards, plus an unavailable house-price signal", () => {
    const edition = selectNationalEvidenceEdition(snapshot());

    expect(edition.lead?.id).toBe("gdp");
    expect(edition.lead?.leadHeadline).toBe("UK GDP grew in May 2026 by 0.1%.");
    expect(edition.signals.map((signal) => signal.id)).toEqual([
      "gdp", "inflation", "unemployment", "national-debt", "nhs-waiting-list", "net-migration", "house-price-index",
    ]);
    expect(edition.counts.current).toBe(6);
    expect(edition.signals.find((signal) => signal.id === "national-debt")?.value).toBe("£2.98tn");
    expect(edition.signals.find((signal) => signal.id === "nhs-waiting-list")?.value).toBe("7.39m pathways");
    expect(edition.signals.find((signal) => signal.id === "unemployment")?.value).toBe("4.9%");
    expect(edition.signals.find((signal) => signal.id === "nhs-waiting-list")?.geography).toBe("England");
    expect(edition.signals.find((signal) => signal.id === "net-migration")?.geography).toBe("United Kingdom");
    expect(edition.signals.find((signal) => signal.id === "house-price-index")?.state).toBe("unavailable");
  });

  it("does not align economic series onto one shared period", () => {
    const edition = selectNationalEvidenceEdition(snapshot());

    expect(edition.signals.find((signal) => signal.id === "inflation")?.period).toBe("May 2026");
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

  it("flags a stored figure when another verified section knows of a newer ONS release", () => {
    const payload = snapshot();
    payload.sentimentPulse.series.unemployment.publishedAt = "2026-07-20T06:00:00.000Z";
    Object.assign(payload, { taxRevenue: { headline: { releaseDate: "2026-07-21" } } });
    Object.assign(payload.meta.sources, { taxRevenue: currentSource() });
    const edition = selectNationalEvidenceEdition(payload);
    expect(edition.signals.find((signal) => signal.id === "unemployment")?.state).toBe("update-due");
    expect(edition.signals.find((signal) => signal.id === "national-debt")?.state).toBe("update-due");
  });

  it("does not borrow an unemployment value from the indicators section when labour evidence is missing", () => {
    const payload = snapshot();
    delete (payload.meta.sources as Record<string, unknown>).employmentStats;
    const edition = selectNationalEvidenceEdition(payload);
    expect(edition.signals.find((signal) => signal.id === "unemployment")?.state).toBe("unavailable");
  });

  it("leads with the most recently published current official signal", () => {
    const payload = snapshot();
    payload.migrationStats.headline.releaseDate = "2026-07-17";
    expect(selectNationalEvidenceEdition(payload).lead?.id).toBe("net-migration");
  });

  it("prepends immigration and emigration flows to the net-migration comparison", () => {
    const edition = selectNationalEvidenceEdition(snapshot());
    const migration = edition.signals.find((signal) => signal.id === "net-migration");
    expect(migration?.comparison?.startsWith("Immigration 813,000 · Emigration 642,000")).toBe(true);
    expect(migration?.comparison).toContain("49% lower than YE Dec 2024");
  });

  it("fails closed for an incompatible publication", () => {
    const payload = snapshot();
    payload.meta.registryVersion = "obsolete";

    const edition = selectNationalEvidenceEdition(payload);

    expect(edition.lead).toBeNull();
    expect(edition.counts.unavailable).toBe(7);
    expect(edition.signals.every((signal) => signal.value === null)).toBe(true);
  });
});

it("does not describe a missing annual comparison as unchanged", () => {
  const payload = snapshot();
  Object.assign(payload.nhsStats.headline, { yearChangePercent: null });
  Object.assign(payload.migrationStats.headline, { changePercent: null });
  const edition = selectNationalEvidenceEdition(payload);
  expect(edition.signals.find(s => s.id === "nhs-waiting-list")?.leadSummary).toBe("A matched annual comparison is unavailable.");
  expect(edition.signals.find(s => s.id === "net-migration")?.leadHeadline).not.toContain("unchanged");
});
