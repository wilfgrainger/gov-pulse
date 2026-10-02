// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  comparePoints,
  exploreMeasures,
  formatMeasure,
  measuresCsv,
} from "@/app/lib/dataExplorer";
import { MEASURES } from "@/app/lib/measureDefinitions";
import { FEED_REGISTRY_VERSION } from "@/worker/feed-registry";
const now = new Date("2026-09-07T12:00:00Z");
const payload = {
  meta: {
    registryVersion: FEED_REGISTRY_VERSION,
    sources: {
      taxRevenue: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: now.toISOString(),
        provenance: { section: "taxRevenue" },
      },
      employmentStats: {
        status: "ok",
        cacheState: "fresh",
        fetchedAt: now.toISOString(),
        provenance: { section: "employmentStats" },
      },
    },
  },
  taxRevenue: {
    headline: {
      receiptsBillion: 100,
      period: "July 2026",
      releaseDate: "2026-08-21",
    },
    source: {
      bulletinUrl:
        "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/july2026",
    },
    history: [
      {
        period: "July 2025",
        observedAt: Date.parse("2025-07-31"),
        receiptsBillion: 90,
      },
      {
        period: "July 2026",
        observedAt: Date.parse("2026-07-31"),
        receiptsBillion: 100,
      },
    ],
    __observation: {
      status: "current",
      observedAt: "2026-07-31T00:00:00.000Z",
      maxAgeDays: 70,
    },
  },
  employmentStats: {
    available: true,
    headline: { unemploymentRate: 4.9, period: "April to June 2026", releaseDate: "2026-08-18" },
    annualDelta: { unemploymentRatePoints: 0.2 },
    source: { bulletinUrl: "https://www.ons.gov.uk/employmentandlabourmarket/uklabourmarket/august2026" },
    history: { labourForce: [
      { observedAt: Date.parse("2026-05-31"), period: "March to May 2026", unemploymentRate: 4.8 },
      { observedAt: Date.parse("2026-06-30"), period: "April to June 2026", unemploymentRate: 4.9 },
    ] },
    __observation: { status: "current", observedAt: "2026-06-30T00:00:00.000Z", maxAgeDays: 70 },
  },
};
describe("data explorer", () => {
  it("uses canonical catalog values, periods, sources and expiry when delivered", () => {
    const catalog = {
      schemaVersion: 2,
      editionId: "catalog-labour-2026-06",
      generatedAt: now.toISOString(),
      validUntil: "2026-10-01T00:00:00.000Z",
      measures: {
        unemployment: {
          id: "unemployment", label: "Unemployment rate", evidenceClass: "official-statistics",
          comparisonKey: "gb-labour-force-survey-unemployment-rate", cadence: "monthly-three-month-average",
          unit: "%", basis: "ILO unemployment rate", geography: { code: "GB", label: "Great Britain" },
          sourceId: "employmentStats", sourceUrl: "https://www.ons.gov.uk/labour-market",
          sourceEditionId: "uklabourmarket-2026-06",
          observationPeriod: { start: "2026-04-01", end: "2026-06-30", label: "April to June 2026" },
          publishedAt: "2026-08-18T00:00:00.000Z", fetchedAt: "2026-09-07T11:00:00.000Z",
          validUntil: "2026-09-10T00:00:00.000Z", availability: "current", value: 5.1,
          revisionId: "uklabourmarket-2026-06",
          points: [{ period: "April to June 2026", observedAt: "2026-06-30", value: 5.1, valueStatus: "estimate", revisionId: "uklabourmarket-2026-06" }],
          caveats: ["Survey estimate."],
        },
      },
    };
    const measure = exploreMeasures({ meta: { registryVersion: FEED_REGISTRY_VERSION, sources: {}, measureCatalog: catalog } }, now)
      .find(({ id }) => id === "unemployment");
    expect(measure).toMatchObject({ value: 5.1, period: "April to June 2026", sourceUrl: "https://www.ons.gov.uk/labour-market" });
    expect(exploreMeasures({ meta: { registryVersion: FEED_REGISTRY_VERSION, sources: {}, measureCatalog: catalog } }, new Date("2026-09-10T00:00:00.000Z"))
      .find(({ id }) => id === "unemployment")?.value).toBeNull();
  });

  it("uses the canonical inventory and the UK labour publication for unemployment", () => {
    const measures = exploreMeasures(payload, now);
    expect(measures.map((m) => m.id)).toEqual(MEASURES.map((measure) => measure.id));
    expect(measures.map((measure) => measure.id)).toEqual(expect.arrayContaining([
      "gdp-monthlyGrowth", "employmentRate", "vacancies", "debt-stock",
      "immigration", "emigration", "totalPayRealGrowth", "housePriceChange",
    ]));
    expect(measures.find((m) => m.id === "receipts")?.value).toBe(100);
    expect(measures.find((m) => m.id === "unemployment")).toMatchObject({
      value: 4.9, period: "April to June 2026",
    });
    expect(measures.filter((m) => m.value !== null)).toHaveLength(2);
  });
  it("suppresses expired sources and untrusted links", () => {
    expect(
      exploreMeasures(payload, new Date("2026-10-07")).every(
        (m) => m.value === null,
      ),
    ).toBe(true);
    const bad = structuredClone(payload);
    bad.taxRevenue.source.bulletinUrl = "https://www.ons.gov.uk.evil.test/";
    expect(exploreMeasures(bad, now).find((m) => m.id === "receipts")?.value).toBeNull();
    expect(exploreMeasures(bad, now).find((m) => m.id === "unemployment")?.value).toBe(4.9);
  });
  it("compares rates in percentage points and never divides by zero", () => {
    const points = [
      { date: 1, period: "a", value: 0 },
      { date: 2, period: "b", value: 3 },
    ];
    expect(comparePoints(points, "%")).toMatchObject({
      delta: 3,
      unit: "percentage points",
      percent: null,
    });
    expect(comparePoints([], "%")).toBeNull();
    expect(formatMeasure(0.3, "percentage points")).toBe(
      "0.3 percentage points",
    );
  });
  it("exports provenance and preserves null separately from zero", () => {
    const measures = exploreMeasures(payload, now);
    const csv = measuresCsv(measures);
    expect(csv).toContain('"100","£bn","July 2026"');
    expect(csv).toContain('"GDP: three-month growth","","%"');
    expect(csv).toContain("https://www.ons.gov.uk/");
  });
  it("marks an older debt release for update when current receipts cite a later finances bulletin", () => {
    const candidate = structuredClone(payload) as typeof payload & { nationalDebt: Record<string, unknown> };
    const checkDate = new Date("2026-09-28T12:00:00Z");
    candidate.meta.sources.taxRevenue.fetchedAt = checkDate.toISOString();
    Object.assign(candidate.meta.sources, { nationalDebt: { status: "ok", cacheState: "fresh", fetchedAt: checkDate.toISOString() } });
    candidate.nationalDebt = {
      debtToGdp: 94.1, observationPeriod: "2026 JUL", publicationDate: "2026-08-21",
      source: { debtToGdpUrl: "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf" },
    };
    candidate.taxRevenue.headline.releaseDate = "2026-09-22";
    const debt = exploreMeasures(candidate, checkDate).find((m) => m.id === "debt-ratio");
    expect(debt).toMatchObject({ period: "July 2026", updateDue: true });
  });
});
it('links the debt ratio to HF6X rather than the absolute HF6W debt series', () => {
  const snapshot = { meta: { registryVersion: FEED_REGISTRY_VERSION, sources: { nationalDebt: { status: 'ok', cacheState: 'fresh', fetchedAt: now.toISOString() } } }, nationalDebt: { baseDebt: 3e12, debtToGdp: 95, observationPeriod: 'July 2026', publicationDate: '2026-08-21', source: { debtUrl: 'https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf', debtToGdpUrl: 'https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf' } } };
  const measures = exploreMeasures(snapshot, now);
  expect(measures.find(m => m.id === 'debt-ratio')?.sourceUrl).toContain('/hf6x/');
  expect(measures.find(m => m.id === 'debt-ratio')?.value).toBe(95);
});
