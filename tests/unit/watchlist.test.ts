import { describe, expect, it } from "vitest";
import { MAX_WATCHLIST_MEASURES, parseWatchlist } from "@/app/lib/watchlist";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";

const record = (id: string) => ({
  id, label: `Measure ${id}`, evidenceClass: "official-statistics", comparisonKey: id, cadence: "monthly", unit: "%", basis: "A named measure",
  geography: { code: "GB", label: "Great Britain" }, sourceId: "publisher", sourceUrl: "https://example.org/release", sourceEditionId: "edition-1",
  observationPeriod: { start: "2026-01-01", end: "2026-01-31", label: "January 2026" }, publishedAt: "2026-02-01T00:00:00.000Z", fetchedAt: "2026-02-02T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", availability: "current", value: 2,
  revisionId: "revision-1", points: [{ period: "January 2026", observedAt: "2026-01-31", value: 2, valueStatus: "observed", revisionId: "revision-1" }], caveats: [],
});
const ids = Array.from({ length: MAX_WATCHLIST_MEASURES }, (_, index) => `measure-${index}`);
const catalog = { schemaVersion: 2, editionId: "catalog-1", generatedAt: "2026-02-02T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", measures: Object.fromEntries(ids.map((id) => [id, record(id)])) } as unknown as MeasureCatalog;

describe("on-device watchlist configuration", () => {
  it("accepts up to 50 valid IDs and excludes cached values", () => {
    const result = parseWatchlist({ version: 1, measureIds: ["measure-0", "measure-1"] }, catalog);
    expect(result).toEqual({ version: 1, measureIds: ["measure-0", "measure-1"] });
    expect(result).not.toHaveProperty("values");
    expect(parseWatchlist({ version: 1, measureIds: ids }, catalog).measureIds).toHaveLength(50);
  });

  it.each([
    null,
    { version: 2, measureIds: ["measure-0"] },
    { version: 1, measureIds: ["measure-0", "measure-0"] },
    { version: 1, measureIds: ["missing"] },
    { version: 1, measureIds: [...ids, "extra"] },
  ])("rejects corrupt, old-version, duplicate, unknown or oversized lists", (input) => {
    expect(() => parseWatchlist(input, catalog)).toThrow();
  });
});
