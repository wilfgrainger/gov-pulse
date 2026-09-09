// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  comparePoints,
  exploreMeasures,
  formatMeasure,
  measuresCsv,
} from "@/app/lib/dataExplorer";
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
};
describe("data explorer", () => {
  it("exposes available evidence without fabricating missing measures", () => {
    const measures = exploreMeasures(payload, now);
    expect(measures).toHaveLength(27);
    expect(measures.find((m) => m.id === "receipts")?.value).toBe(100);
    expect(measures.filter((m) => m.value !== null)).toHaveLength(1);
  });
  it("suppresses expired sources and untrusted links", () => {
    expect(
      exploreMeasures(payload, new Date("2026-10-07")).every(
        (m) => m.value === null,
      ),
    ).toBe(true);
    const bad = structuredClone(payload);
    bad.taxRevenue.source.bulletinUrl = "https://www.ons.gov.uk.evil.test/";
    expect(exploreMeasures(bad, now).every((m) => m.value === null)).toBe(true);
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
    expect(csv).toContain('"GDP: monthly growth","","%"');
    expect(csv).toContain("https://www.ons.gov.uk/");
  });
});
it('links the debt ratio to HF6X rather than the absolute HF6W debt series', () => {
  const snapshot = { meta: { registryVersion: FEED_REGISTRY_VERSION, sources: { nationalDebt: { status: 'ok', cacheState: 'fresh', fetchedAt: now.toISOString() } } }, nationalDebt: { baseDebt: 3e12, debtToGdp: 95, observationPeriod: 'July 2026', publicationDate: '2026-08-21', source: { debtUrl: 'https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf', debtToGdpUrl: 'https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf' } } };
  const measures = exploreMeasures(snapshot, now);
  expect(measures.find(m => m.id === 'debt-ratio')?.sourceUrl).toContain('/hf6x/');
  expect(measures.find(m => m.id === 'debt')?.value).toBe(3000);
});
