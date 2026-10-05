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
        sentimentPulse: currentSource(),
        employmentStats: currentSource(),
        nationalDebt: currentSource(),
        nhsStats: currentSource(),
        housePriceIndex: currentSource(),
        governmentContracts: currentSource(),
      },
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
        unemployment: {
          value: 4.9,
          period: "February to April 2026",
          publishedAt: "2026-06-18T06:00:00.000Z",
          annualDelta: 0.2,
          history: [],
        },
      },
    },
    employmentStats: {
      available: true,
      headline: { unemploymentRate: 4.9, period: "February to April 2026", releaseDate: "2026-06-18" },
      annualDelta: { unemploymentRatePoints: 0.2 },
      history: { labourForce: [{ observedAt: Date.parse("2026-04-30"), unemploymentRate: 4.9 }] },
    },
    nationalDebt: {
      baseDebt: 2_984_300_000_000,
      baseDate: Date.parse("2026-05-31T00:00:00.000Z"),
      observationPeriod: "May 2026",
      publicationDate: "2026-06-19",
      debtToGdp: 95.1,
      annualDelta: { debtBillion: 116.8 },
      history: [
        { observedAt: Date.parse("2026-04-30"), debtToGdp: 95.0 },
        { observedAt: Date.parse("2026-05-31"), debtToGdp: 95.1 },
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
    housePriceIndex: {
      headline: {
        privateRentPeriod: "June 2026",
        avgMonthlyPrivateRentGbp: 1_352,
        privateRentAnnualChangePercent: 5.1,
        previousPrivateRentPeriod: "May 2026",
        previousPrivateRentAnnualChangePercent: 5.6,
        period: "April 2026",
        releaseDate: "2026-07-16",
        avgPriceGbp: 270_000,
        changePercent: 2.9,
      },
      history: [
        { observedAt: Date.parse("2026-05-31"), privateRentAnnualChangePercent: 5.6 },
        { observedAt: Date.parse("2026-06-30"), privateRentAnnualChangePercent: 5.1 },
      ],
    },
    governmentContracts: {
      available: true,
      window: {
        updatedFrom: "2026-07-11T00:00:00.000Z",
        updatedTo: "2026-07-17T23:59:59.000Z",
        label: "11 to 17 July 2026",
      },
      dataQuality: {
        validComparableAwards: 881,
        excludedMissingValue: 30,
        excludedAmbiguousContractValue: 2,
        excludedNonGbp: 1,
        excludedMissingBuyer: 0,
        excludedMissingSupplier: 1,
        excludedMalformed: 0,
      },
    },
  };
}

describe("national evidence presentation", () => {
  it("selects exactly six topic cards: prices, jobs, debt, rents, NHS waiting list and contracts", () => {
    const edition = selectNationalEvidenceEdition(snapshot());
    expect(edition.signals.map((signal) => signal.id)).toEqual([
      "inflation", "unemployment", "national-debt", "private-rents", "nhs-waiting-list", "government-contracts",
    ]);
    expect(edition.signals.map((signal) => signal.kicker)).toEqual([
      "Prices", "Jobs", "Debt", "Rents", "NHS", "Contracts",
    ]);
    expect(edition.counts.current).toBe(6);
    expect(edition.lead?.id).toBe("private-rents");
  });

  it("does not align economic series onto one shared period", () => {
    const edition = selectNationalEvidenceEdition(snapshot());
    expect(edition.signals.find((signal) => signal.id === "inflation")?.period).toBe("May 2026");
    expect(edition.signals.find((signal) => signal.id === "unemployment")?.period).toBe("February to April 2026");
    expect(edition.signals.find((signal) => signal.id === "private-rents")?.period).toBe("12 months to June 2026");
  });

  it("shows private rents and contracts with fail-closed fields", () => {
    const edition = selectNationalEvidenceEdition(snapshot());
    const rents = edition.signals.find((signal) => signal.id === "private-rents");
    expect(rents?.value).toBe("+5.1%");
    expect(rents?.comparison).toContain("Average £1,352 a month");
    const contracts = edition.signals.find((signal) => signal.id === "government-contracts");
    expect(contracts?.value).toBe("881 awards");
    expect(contracts?.comparison).toContain("Notices updated, not money spent");
    expect(contracts?.dateLabel).toBe("Notices to");
  });

  it("never leads with contracts", () => {
    const payload = snapshot();
    for (const id of ["sentimentPulse", "employmentStats", "nationalDebt", "nhsStats", "housePriceIndex"]) {
      delete (payload.meta.sources as Record<string, unknown>)[id];
    }
    const edition = selectNationalEvidenceEdition(payload);
    expect(edition.signals.find((signal) => signal.id === "government-contracts")?.state).toBe("current");
    expect(edition.lead).toBeNull();
  });

  it("labels retained stale evidence and suppresses unsupported values", () => {
    const payload = snapshot();
    payload.meta.sources.sentimentPulse = { status: "stale", cacheState: "stale", fetchedAt: NOW };
    payload.meta.sources.nationalDebt = { status: "error", cacheState: "missing", fetchedAt: NOW };
    const edition = selectNationalEvidenceEdition(payload);
    expect(edition.signals.find((signal) => signal.id === "inflation")?.state).toBe("update-due");
    expect(edition.signals.find((signal) => signal.id === "inflation")?.value).toBe("3.4%");
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

  it("does not borrow an unemployment value when labour evidence is missing", () => {
    const payload = snapshot();
    delete (payload.meta.sources as Record<string, unknown>).employmentStats;
    expect(selectNationalEvidenceEdition(payload).signals.find((signal) => signal.id === "unemployment")?.state).toBe("unavailable");
  });

  it("uses the catalog value and period consistently with the explorer", () => {
    const payload = snapshot();
    payload.meta.sources.employmentStats = { status: "error", cacheState: "stale", fetchedAt: NOW };
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
        inflation: measure("inflation", "CPI inflation", 3.6, "May 2026", "2026-05-31", "%", "Annual CPI inflation", { code: "UK", label: "United Kingdom" }, "sentimentPulse"),
        unemployment: measure("unemployment", "Unemployment rate", 5.1, "February to April 2026", "2026-04-30", "%", "ILO unemployment rate", { code: "GB", label: "Great Britain" }, "employmentStats"),
        "debt-ratio": measure("debt-ratio", "Debt as a share of GDP", 96.2, "May 2026", "2026-05-31", "%", "PSND / GDP", { code: "UK", label: "United Kingdom" }, "nationalDebt"),
        waitingPathwaysEstimate: measure("waitingPathwaysEstimate", "NHS waiting list", 7_300_000, "May 2026", "2026-05-31", "pathways", "NHS England RTT pathways", { code: "ENG", label: "England" }, "nhsStats"),
        privateRentAnnualChange: measure("privateRentAnnualChange", "Private rent: annual change", 5.1, "June 2026", "2026-06-30", "%", "PIPR annual change", { code: "UK", label: "United Kingdom" }, "housePriceIndex"),
      },
    };
    const fixedNow = new Date("2026-07-19T00:00:00.000Z");
    const dashboard = selectNationalEvidenceEdition(payload, fixedNow);
    const explorerMeasures = exploreMeasures(payload, fixedNow);
    const pairs = [
      ["inflation", "inflation", "3.6%", 3.6],
      ["unemployment", "unemployment", "5.1%", 5.1],
      ["national-debt", "debt-ratio", "96.2% of GDP", 96.2],
      ["nhs-waiting-list", "waitingPathwaysEstimate", "7.3m pathways", 7_300_000],
    ] as const;
    for (const [signalId, measureId, presentationValue, numericValue] of pairs) {
      const signal = dashboard.signals.find(({ id }) => id === signalId);
      const measure = explorerMeasures.find(({ id }) => id === measureId);
      expect(signal?.value).toBe(presentationValue);
      expect(signal?.period).toBe(measure?.period);
      expect(signal?.sourceUrl).toBe(measure?.sourceUrl);
      expect(measure?.value).toBe(numericValue);
      expect(signal?.state).toBe(signalId === "unemployment" ? "update-due" : "current");
    }
    expect(dashboard.signals.find(({ id }) => id === "private-rents")?.sourceUrl).toBe("https://www.ons.gov.uk/privateRentAnnualChange");
  });

  it("fails closed for an incompatible publication", () => {
    const payload = snapshot();
    payload.meta.registryVersion = "obsolete";
    const edition = selectNationalEvidenceEdition(payload);
    expect(edition.lead).toBeNull();
    expect(edition.signals).toHaveLength(6);
    expect(edition.counts.unavailable).toBe(6);
    expect(edition.signals.every((signal) => signal.value === null)).toBe(true);
  });
});

it("does not describe a missing annual comparison as unchanged", () => {
  const payload = snapshot();
  Object.assign(payload.nhsStats.headline, { yearChangePercent: null });
  expect(selectNationalEvidenceEdition(payload).signals.find(s => s.id === "nhs-waiting-list")?.leadSummary).toBe("A matched annual comparison is unavailable.");
});
