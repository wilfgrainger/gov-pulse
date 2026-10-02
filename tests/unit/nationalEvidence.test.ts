import { describe, expect, it } from "vitest";
import { selectNationalEvidenceEdition } from "../../app/lib/nationalEvidence";
import { exploreMeasures } from "../../app/lib/dataExplorer";
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
  it("selects one lead and seven separately dated official signal cards", () => {
    const edition = selectNationalEvidenceEdition(snapshot());

    expect(edition.lead?.id).toBe("gdp");
    expect(edition.lead?.leadHeadline).toBe("UK GDP grew across the latest three months to May 2026 by 0.7%.");
    expect(edition.signals.map((signal) => signal.id)).toEqual([
      "gdp", "inflation", "unemployment", "national-debt", "nhs-waiting-list", "net-migration", "real-wages",
    ]);
    expect(edition.counts.current).toBe(6);
    expect(edition.signals.find((signal) => signal.id === "national-debt")?.value).toBe("95.1% of GDP");
    expect(edition.signals.find((signal) => signal.id === "nhs-waiting-list")?.value).toBe("7.39m pathways");
    expect(edition.signals.find((signal) => signal.id === "unemployment")?.value).toBe("4.9%");
    expect(edition.signals.find((signal) => signal.id === "nhs-waiting-list")?.geography).toBe("England");
    expect(edition.signals.find((signal) => signal.id === "net-migration")?.geography).toBe("United Kingdom");
  });

  it("does not align economic series onto one shared period", () => {
    const edition = selectNationalEvidenceEdition(snapshot());

    expect(edition.signals.find((signal) => signal.id === "inflation")?.period).toBe("May 2026");
    expect(edition.signals.find((signal) => signal.id === "unemployment")?.period).toBe("February to April 2026");
  });

  it("uses the catalog value and period consistently in national evidence and the explorer", () => {
    const payload = snapshot();
    payload.meta.sources.employmentStats = { status: "error", cacheState: "stale", fetchedAt: NOW };
    payload.meta.sources.realWages = currentSource();
    Object.assign(payload, { realWages: {
      available: true,
      headline: { regularPayRealGrowthPercent: 1.4, totalPayRealGrowthPercent: 1.2, period: "February to April 2026", releaseDate: "2026-06-18" },
      history: [{ observedAt: "2026-04-30T00:00:00.000Z", regularPayRealGrowthPercent: 1.4 }],
    } });
    const fetchedAt = "2026-07-18T10:00:00.000Z";
    const common = {
      evidenceClass: "official-statistics", cadence: "monthly", geography: { code: "GB", label: "Great Britain" },
      publishedAt: "2026-06-18T00:00:00.000Z", fetchedAt,
      validUntil: "2026-07-25T00:00:00.000Z", availability: "current", revisionId: "fixture-edition",
      caveats: ["Fixture evidence."],
    };
    const measure = (id: string, label: string, value: number, period: string, observedAt: string, unit: string, basis: string, geography: { code: string; label: string }, sourceId: string) => ({
      ...common, id, label, value, unit, basis, geography, sourceId,
      comparisonKey: `${id}-fixture`, sourceUrl: `https://www.ons.gov.uk/${id}`,
      sourceEditionId: `${id}-edition`,
      observationPeriod: { start: observedAt.slice(0, 10), end: observedAt.slice(0, 10), label: period },
      points: [{ period, observedAt: observedAt.slice(0, 10), value, valueStatus: "estimate", revisionId: `${id}-edition` }],
    });
    payload.meta.measureCatalog = {
      schemaVersion: 2,
      editionId: "catalog-labour-2026-06",
      generatedAt: NOW,
      validUntil: "2026-07-25T00:00:00.000Z",
      measures: {
        "gdp-threeMonthGrowth": measure("gdp-threeMonthGrowth", "GDP: three-month growth", 0.9, "May 2026", "2026-05-31", "%", "Real GDP growth", { code: "UK", label: "United Kingdom" }, "gdpTracker"),
        inflation: measure("inflation", "CPI inflation", 3.6, "May 2026", "2026-05-31", "%", "Annual CPI inflation", { code: "UK", label: "United Kingdom" }, "sentimentPulse"),
        unemployment: measure("unemployment", "Unemployment rate", 5.1, "February to April 2026", "2026-04-30", "%", "ILO unemployment rate", { code: "GB", label: "Great Britain" }, "employmentStats"),
        "debt-ratio": measure("debt-ratio", "Debt as a share of GDP", 96.2, "May 2026", "2026-05-31", "%", "PSND / GDP", { code: "UK", label: "United Kingdom" }, "nationalDebt"),
        waitingPathwaysEstimate: measure("waitingPathwaysEstimate", "NHS waiting list", 7_300_000, "May 2026", "2026-05-31", "pathways", "NHS England RTT pathways", { code: "ENG", label: "England" }, "nhsStats"),
        netMigration: measure("netMigration", "Net migration", 450_000, "YE Dec 2025", "2025-12-31", "people", "Long-term migration balance", { code: "UK", label: "United Kingdom" }, "migrationStats"),
        regularPayRealGrowth: measure("regularPayRealGrowth", "Real wages: regular pay growth", 1.5, "February to April 2026", "2026-04-30", "%", "ONS CPIH-adjusted regular pay growth", { code: "GB", label: "Great Britain" }, "realWages"),
      },
    };
    const fixedNow = new Date("2026-07-19T00:00:00.000Z");
    const dashboard = selectNationalEvidenceEdition(payload, fixedNow);
    const explorerMeasures = exploreMeasures(payload, fixedNow);

    const pairs = [
      ["gdp", "gdp-threeMonthGrowth", "+0.9%", 0.9], ["inflation", "inflation", "3.6%", 3.6],
      ["unemployment", "unemployment", "5.1%", 5.1], ["national-debt", "debt-ratio", "96.2% of GDP", 96.2],
      ["nhs-waiting-list", "waitingPathwaysEstimate", "7.3m pathways", 7_300_000],
      ["net-migration", "netMigration", "450,000", 450_000], ["real-wages", "regularPayRealGrowth", "+1.5%", 1.5],
    ] as const;
    for (const [signalId, measureId, presentationValue, numericValue] of pairs) {
      const signal = dashboard.signals.find(({ id }) => id === signalId);
      const measure = explorerMeasures.find(({ id }) => id === measureId);
      expect(signal?.value).toBe(presentationValue);
      expect(signal?.period).toBe(measure?.period);
      expect(signal?.sourceUrl).toBe(measure?.sourceUrl);
      expect(measure?.value).toBe(numericValue);
      expect(signal?.state).toBe(signalId === "unemployment" ? "update-due" : "current");
      expect(measure?.updateDue).toBe(signalId === "unemployment");
    }
  });

  it("labels retained stale evidence and suppresses unsupported values", () => {
    const payload = snapshot();
    payload.meta.sources.gdpTracker = { status: "stale", cacheState: "stale", fetchedAt: NOW };
    payload.meta.sources.nationalDebt = { status: "error", cacheState: "missing", fetchedAt: NOW };

    const edition = selectNationalEvidenceEdition(payload);

    expect(edition.signals.find((signal) => signal.id === "gdp")?.state).toBe("update-due");
    expect(edition.signals.find((signal) => signal.id === "gdp")?.value).toBe("+0.7%");
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

  it("uses neutral wording for zero comparisons and absolute wording for negative wage changes", () => {
    const payload = snapshot();
    Object.assign(payload.nhsStats.headline, { yearChangePercent: 0 });
    Object.assign(payload.migrationStats.headline, { changePercent: 0 });
    Object.assign(payload, {
      realWages: {
        available: true,
        headline: {
          period: "March to May 2026", releaseDate: "2026-07-16",
          regularPayRealGrowthPercent: -0.6, totalPayRealGrowthPercent: 0,
        },
        history: [],
      },
    });
    Object.assign(payload.meta.sources, { realWages: currentSource() });

    const edition = selectNationalEvidenceEdition(payload);
    expect(edition.signals.find((signal) => signal.id === "nhs-waiting-list")?.leadSummary).toContain("was unchanged");
    expect(edition.signals.find((signal) => signal.id === "net-migration")?.leadHeadline).toContain("unchanged at");
    const wages = edition.signals.find((signal) => signal.id === "real-wages");
    expect(wages?.leadHeadline).toContain("fell 0.6%");
    expect(wages?.leadSummary).toContain("was unchanged");
    expect(wages?.leadSummary).not.toContain("grew -");
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
