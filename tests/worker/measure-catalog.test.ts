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
      geography: { code: "GB", label: "Great Britain" },
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
    const catalog = buildMeasureCatalog(value, now);
    expect(catalog.measures.unemployment).toBeUndefined();
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
});
