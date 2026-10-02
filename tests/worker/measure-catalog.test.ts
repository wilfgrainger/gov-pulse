import { describe, expect, it } from "vitest";
import { buildMeasureCatalog, catalogRevisionIdentity } from "../../worker/measure-catalog.js";
import { FEED_REGISTRY_VERSION } from "../../worker/feed-registry.js";

const now = new Date("2026-07-01T12:00:00.000Z");
const observedAt = "2026-04-30T00:00:00.000Z";
const source = {
  status: "ok",
  cacheState: "fresh",
  fetchedAt: "2026-07-01T10:00:00.000Z",
  provenance: { section: "employmentStats", upstreams: [{ url: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/latest" }] },
};

function snapshot() {
  return {
    meta: { registryVersion: FEED_REGISTRY_VERSION, generatedAt: "2026-07-01T10:00:00.000Z", sources: { employmentStats: source } },
    employmentStats: {
      available: true,
      expiresAt: "2026-07-08T00:00:00.000Z",
      __observation: { status: "current", period: "February to April 2026", observedAt, maxAgeDays: 60 },
      headline: { period: "February to April 2026", releaseDate: "2026-06-18", unemploymentRate: 4.9 },
      history: { labourForce: [{ period: "February to April 2026", observedAt, unemploymentRate: 4.9 }] },
      source: { edition: "uklabourmarket-2026-06", bulletinUrl: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/june2026" },
    },
  };
}

describe("Worker measure catalog", () => {
  it("derives only source-identified records with matching headline and history", () => {
    const catalog = buildMeasureCatalog(snapshot(), now);
    expect(catalog.schemaVersion).toBe(2);
    expect(catalog.measures.unemployment).toMatchObject({
      availability: "current", value: 4.9,
      sourceEditionId: "uklabourmarket-2026-06", unit: "%",
      geography: { code: "UK", label: "United Kingdom" },
      observationPeriod: { start: "2026-02-01", end: "2026-04-30" },
    });
  });

  it("does not use the snapshot build time as a substitute for a source expiry", () => {
    const value = snapshot();
    delete value.employmentStats.expiresAt;
    const catalog = buildMeasureCatalog(value, now);
    expect(catalog.measures.unemployment).toBeUndefined();
  });

  it("retains a verified old edition as historical after its currentness deadline", () => {
    const value = snapshot();
    value.employmentStats.expiresAt = "2026-06-30T00:00:00.000Z";
    value.meta.sources.employmentStats = {
      ...source,
      status: "stale",
      cacheState: "stale",
      fetchedAt: "2026-06-19T10:00:00.000Z",
    };
    const catalog = buildMeasureCatalog(value, now);
    expect(catalog.measures.unemployment.availability).toBe("historical");
    expect(catalog.measures.unemployment.value).toBe(4.9);
    expect(catalog.measures.unemployment.validUntil).toBe("2026-06-30T00:00:00.000Z");
  });

  it("rejects a current headline that disagrees with the latest plotted point", () => {
    const value = snapshot();
    value.employmentStats.history.labourForce[0].unemploymentRate = 5.1;
    const omissions: { measureId: string; reason: string }[] = [];
    const catalog = buildMeasureCatalog(value, now, { onOmission: (entry) => omissions.push(entry) });
    expect(catalog.measures.unemployment).toBeUndefined();
    expect(omissions).toContainEqual({ measureId: "unemployment", reason: "headline-history-mismatch" });
    expect(catalog).not.toHaveProperty("diagnostics");
  });

  it("does not reinterpret an incompatible old snapshot as a current catalogue", () => {
    const value = snapshot();
    value.meta.registryVersion = "old-version";
    expect(Object.keys(buildMeasureCatalog(value, now).measures)).toEqual([]);
  });

  it("keeps a publication identity stable across fetch refreshes but changes it for historical corrections", () => {
    const original = buildMeasureCatalog(snapshot(), now);
    const refreshedSnapshot = snapshot();
    refreshedSnapshot.meta.generatedAt = "2026-07-02T10:00:00.000Z";
    refreshedSnapshot.meta.sources.employmentStats = {
      ...source,
      fetchedAt: "2026-07-02T10:00:00.000Z",
    };
    const refreshed = buildMeasureCatalog(refreshedSnapshot, new Date("2026-07-02T12:00:00.000Z"));
    expect(refreshed.editionId).toBe(original.editionId);

    const correctedSnapshot = snapshot();
    correctedSnapshot.employmentStats.history.labourForce.unshift({
      period: "January 2026",
      observedAt: "2026-02-28T00:00:00.000Z",
      unemploymentRate: 4.7,
    });
    const corrected = buildMeasureCatalog(correctedSnapshot, now);
    expect(corrected.measures.unemployment).toBeDefined();
    expect(catalogRevisionIdentity(corrected.measures)).not.toBe(original.editionId);
  });

  it("derives a stable ONS release identity from the dated source and publication date", () => {
    const value = snapshot();
    delete value.employmentStats.source.edition;
    const first = buildMeasureCatalog(value, now).measures.unemployment;
    const refreshed = snapshot();
    delete refreshed.employmentStats.source.edition;
    refreshed.meta.sources.employmentStats.fetchedAt = "2026-07-02T10:00:00.000Z";
    const second = buildMeasureCatalog(refreshed, new Date("2026-07-02T12:00:00.000Z")).measures.unemployment;
    expect(first.sourceEditionId).toMatch(/^ons-unemployment-2026-06-18-/);
    expect(second.sourceEditionId).toBe(first.sourceEditionId);

    const laterPublication = snapshot();
    delete laterPublication.employmentStats.source.edition;
    laterPublication.employmentStats.headline.releaseDate = "2026-06-19";
    expect(buildMeasureCatalog(laterPublication, now).measures.unemployment.sourceEditionId)
      .not.toBe(first.sourceEditionId);
  });

  it("uses the CPI series deadline and source URL within a multi-series section", () => {
    const value = snapshot();
    value.meta.sources.sentimentPulse = {
      ...source,
      fetchedAt: "2026-10-01T10:00:00.000Z",
      provenance: {
        ...source.provenance,
        upstreams: [
          { url: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23" },
          { url: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp" },
        ],
      },
    };
    value.sentimentPulse = {
      series: {
        inflation: {
          value: 3.1,
          period: "August 2026",
          publishedAt: "2026-09-16T00:00:00.000Z",
          sourceUrl: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
          history: [
            { period: "August 2026", observedAt: "2026-08-31T00:00:00.000Z", value: 3.1 },
          ],
        },
      },
      __measureValidity: { inflation: { validUntil: "2026-11-30T00:00:00.000Z" } },
    };

    const measure = buildMeasureCatalog(value, new Date("2026-10-01T12:00:00.000Z")).measures.inflation;
    expect(measure).toMatchObject({
      availability: "current",
      value: 3.1,
      sourceUrl: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
      validUntil: "2026-11-30T00:00:00.000Z",
    });
  });

  it("keeps the newer rent observation separate from the lagging house-price series", () => {
    const value = snapshot();
    const bulletinUrl = "https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026";
    value.meta.sources.housePriceIndex = {
      ...source,
      fetchedAt: "2026-09-16T08:00:00.000Z",
      provenance: { section: "housePriceIndex", upstreams: [{ url: bulletinUrl }] },
    };
    value.housePriceIndex = {
      expiresAt: "2026-10-31T00:00:00.000Z",
      headline: {
        privateRentPeriod: "Aug 2026",
        privateRentObservedAt: Date.UTC(2026, 7, 31),
        avgMonthlyPrivateRentGbp: 1400,
        privateRentAnnualChangePercent: 3.8,
        period: "Jul 2026",
        observedAt: Date.UTC(2026, 6, 31),
        releaseDate: "2026-09-16",
        avgPriceGbp: 273000,
        changePercent: 1.4,
        previousPeriod: "Jun 2026",
        previousChangePercent: 1.5,
      },
      history: [
        { period: "Jun 2026", observedAt: Date.UTC(2026, 5, 30), privateRentAnnualChangePercent: 3.3, hpiChangePercent: 1.5 },
        { period: "Jul 2026", observedAt: Date.UTC(2026, 6, 31), privateRentAnnualChangePercent: 3.7, hpiChangePercent: 1.4 },
        { period: "Aug 2026", observedAt: Date.UTC(2026, 7, 31), privateRentAnnualChangePercent: 3.8, hpiChangePercent: null },
      ],
      source: { edition: "september2026", bulletinUrl, historyUrl: `${bulletinUrl}/figure1.csv` },
    };

    const catalog = buildMeasureCatalog(value, now);
    expect(catalog.measures.housePriceChange).toMatchObject({ value: 1.4, points: [{ value: 1.5 }, { value: 1.4 }, { value: null }] });
    expect(catalog.measures.privateRentAnnualChange).toMatchObject({ value: 3.8, observationPeriod: { label: "Aug 2026" }, points: [{ value: 3.3 }, { value: 3.7 }, { value: 3.8 }] });
    expect(catalog.measures.privateRentAverage).toMatchObject({ value: 1400, unit: "GBP/month", observationPeriod: { label: "Aug 2026" }, points: [{ period: "Aug 2026", observedAt: "2026-08-31", value: 1400 }] });
  });
});
