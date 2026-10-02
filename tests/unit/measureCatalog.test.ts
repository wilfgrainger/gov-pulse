import { describe, expect, it } from "vitest";
import {
  compareEligibility,
  selectMeasure,
  validateMeasureRecord,
} from "../../contracts/measure-record.js";
import { isCompatibleMetricsSnapshot } from "../../app/lib/metricsSnapshot";
import { measureForDisplay } from "../../app/lib/measureCatalog";
import { FEED_REGISTRY_VERSION } from "../../worker/feed-registry.js";

const instant = "2026-07-01T00:00:00.000Z";
const measure = (overrides: Record<string, unknown> = {}) => ({
  id: "unemployment-rate",
  label: "Unemployment rate",
  evidenceClass: "official-statistics",
  comparisonKey: "uk-labour-force-survey-unemployment-rate",
  cadence: "monthly",
  unit: "%",
  basis: "ILO unemployed / economically active population",
  geography: { code: "GB", label: "Great Britain" },
  sourceId: "ons-labour-market",
  sourceUrl: "https://www.ons.gov.uk/releases/labour-market",
  sourceEditionId: "labour-market-2026-06",
  observationPeriod: { start: "2026-02-01", end: "2026-04-30", label: "February to April 2026" },
  publishedAt: instant,
  fetchedAt: instant,
  validUntil: "2026-07-08T00:00:00.000Z",
  availability: "current",
  value: 4.9,
  revisionId: "edition-2026-06",
  points: [{ period: "February to April 2026", observedAt: "2026-04-30", value: 4.9, valueStatus: "estimate", revisionId: "edition-2026-06" }],
  caveats: ["Survey estimate; subject to revision."],
  ...overrides,
});

describe("canonical measure contract", () => {
  it("normalizes a valid dated source record", () => {
    expect(validateMeasureRecord(measure())).toMatchObject({ id: "unemployment-rate", value: 4.9 });
  });

  it("allows a later explicit missing observation while matching the current value to the latest numeric point", () => {
    const record = validateMeasureRecord(measure({
      observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "August 2026" },
      points: [
        { period: "July 2026", observedAt: "2026-07-31", value: 4.9, valueStatus: "estimate", revisionId: "edition-2026-06" },
        { period: "August 2026", observedAt: "2026-08-31", value: null, valueStatus: "estimate", revisionId: "edition-2026-06" },
      ],
    }));
    expect(record.points.at(-1)?.value).toBeNull();
    expect(record.value).toBe(4.9);
  });

  it.each([
    ["future timestamp", { publishedAt: "not-a-date" }],
    ["impossible UTC timestamp", { fetchedAt: "2026-02-30T00:00:00.000Z" }],
    ["current without expiry", { validUntil: null }],
    ["current with expired evidence", { validUntil: "2026-06-30T00:00:00.000Z" }],
    ["non-finite value", { value: Number.NaN }],
    ["unapproved protocol", { sourceUrl: "javascript:alert(1)" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => validateMeasureRecord(measure(overrides))).toThrow();
  });

  it("prevents same-unit but semantically different percentage overlays", () => {
    const debt = measure({ id: "debt-ratio", comparisonKey: "public-debt-gdp-ratio", basis: "PSND / GDP", geography: { code: "UK", label: "United Kingdom" } });
    expect(compareEligibility(validateMeasureRecord(measure()), validateMeasureRecord(debt))).toBe("panels");
    expect(compareEligibility(validateMeasureRecord(measure()), validateMeasureRecord(measure({ id: "unemployment-other-series" })))).toBe("overlay");
  });

  it("selects current values only before source-owned expiry", () => {
    const catalog = {
      schemaVersion: 2,
      editionId: "catalog-2026-07-01",
      generatedAt: instant,
      validUntil: null,
      measures: { "unemployment-rate": validateMeasureRecord(measure()) },
    };
    expect(selectMeasure(catalog, "unemployment-rate", new Date("2026-07-07T23:59:59.000Z"))?.value).toBe(4.9);
    expect(selectMeasure(catalog, "unemployment-rate", new Date("2026-07-08T00:00:00.000Z"))).toBeNull();
    expect(selectMeasure(catalog, "missing", new Date(instant))).toBeNull();
  });

  it("keeps a verified expired record discoverable as historical", () => {
    const catalog = {
      schemaVersion: 2,
      editionId: "catalog-2026-07-01",
      generatedAt: instant,
      validUntil: "2026-07-08T00:00:00.000Z",
      measures: { "unemployment-rate": validateMeasureRecord(measure()) },
    };
    expect(measureForDisplay(catalog, "unemployment-rate", new Date("2026-07-09T00:00:00.000Z")))
      .toMatchObject({ availability: "historical", value: 4.9, validUntil: "2026-07-08T00:00:00.000Z" });
    expect(measureForDisplay(catalog, "missing", new Date("2026-07-09T00:00:00.000Z"))).toBeNull();
  });

  it("retains historical provenance when a publisher republishes the same expired edition", () => {
    const historic = validateMeasureRecord(measure({
      fetchedAt: "2026-07-10T00:00:00.000Z",
      validUntil: "2026-07-08T00:00:00.000Z",
      availability: "historical",
    }));
    expect(historic.validUntil).toBe("2026-07-08T00:00:00.000Z");
    expect(selectMeasure({
      schemaVersion: 2,
      editionId: "catalog-historical",
      generatedAt: "2026-07-10T00:00:00.000Z",
      validUntil: null,
      measures: { "unemployment-rate": historic },
    }, "unemployment-rate", new Date("2026-07-10T00:00:00.000Z"))?.availability).toBe("historical");
  });

  it("rejects a catalog key that does not match the record identity", () => {
    const catalog = {
      schemaVersion: 2,
      editionId: "catalog-mismatch",
      generatedAt: instant,
      validUntil: null,
      measures: { unemployment: validateMeasureRecord(measure()) },
    };
    expect(selectMeasure(catalog, "unemployment", new Date(instant))).toBeNull();
  });

  it("fails closed when the catalogue envelope is malformed", () => {
    expect(selectMeasure({
      schemaVersion: 2,
      editionId: "catalog-invalid",
      generatedAt: "not-a-timestamp",
      validUntil: null,
      measures: { "unemployment-rate": validateMeasureRecord(measure()) },
    }, "unemployment-rate", new Date(instant))).toBeNull();
  });

  it("does not publish a future catalogue or a record fetched in the future", () => {
    const record = validateMeasureRecord(measure());
    const futureCatalog = {
      schemaVersion: 2,
      editionId: "catalog-future",
      generatedAt: "2026-07-02T00:00:00.000Z",
      validUntil: "2026-07-08T00:00:00.000Z",
      measures: { "unemployment-rate": record },
    };
    expect(selectMeasure(futureCatalog, "unemployment-rate", new Date(instant))).toBeNull();

    const fetchedInFuture = validateMeasureRecord(measure({ fetchedAt: "2026-07-02T00:00:00.000Z" }));
    expect(selectMeasure({
      ...futureCatalog,
      generatedAt: instant,
      measures: { "unemployment-rate": fetchedInFuture },
    }, "unemployment-rate", new Date(instant))).toBeNull();
  });

  it("keeps additive catalog metadata compatible with existing snapshot consumers", () => {
    expect(isCompatibleMetricsSnapshot({
      meta: {
        registryVersion: FEED_REGISTRY_VERSION,
        sources: {},
        measureCatalog: { schemaVersion: 2, editionId: "catalog-a", generatedAt: instant, validUntil: null, measures: {} },
      },
    })).toBe(true);
  });
});
