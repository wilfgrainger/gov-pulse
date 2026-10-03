import { describe, expect, it } from "vitest";
import { buildWatchEvidenceReference, compareWatchEvidence, parseWatchEvidenceBaselines, parseWatchlist } from "@/app/lib/watchlist";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";

const record = (id: string) => ({
  id, label: `Measure ${id}`, evidenceClass: "official-statistics", comparisonKey: id, cadence: "monthly", unit: "%", basis: "A named measure",
  geography: { code: "GB", label: "Great Britain" }, sourceId: "publisher", sourceUrl: "https://example.org/release", sourceEditionId: "edition-1",
  observationPeriod: { start: "2026-01-01", end: "2026-01-31", label: "January 2026" }, publishedAt: "2026-02-01T00:00:00.000Z", fetchedAt: "2026-02-02T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", availability: "current", value: 2,
  revisionId: "revision-1", points: [{ period: "January 2026", observedAt: "2026-01-31", value: 2, valueStatus: "observed", revisionId: "revision-1" }], caveats: [],
});
const ids = Array.from({ length: 80 }, (_, index) => `measure-${index}`);
const catalog = { schemaVersion: 2, editionId: "catalog-1", generatedAt: "2026-02-02T00:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z", measures: Object.fromEntries(ids.map((id) => [id, record(id)])) } as unknown as MeasureCatalog;

describe("on-device watchlist configuration", () => {
  it("accepts the full validated catalog and excludes cached values", () => {
    const result = parseWatchlist({ version: 1, measureIds: ["measure-0", "measure-1"] }, catalog);
    expect(result).toEqual({ version: 1, measureIds: ["measure-0", "measure-1"] });
    expect(result).not.toHaveProperty("values");
    expect(parseWatchlist({ version: 1, measureIds: ids }, catalog).measureIds).toHaveLength(80);
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

describe("on-device change detection", () => {
  it("detects evidence changes while ignoring retrieval clocks and revision labels", async () => {
    const first = record("measure-0") as unknown as import("@/app/lib/measureCatalog").MeasureRecord;
    const refreshed = { ...first, fetchedAt: "2026-02-03T00:00:00.000Z", revisionId: "revision-2", points: first.points.map((point) => ({ ...point, revisionId: "revision-2" })) };
    const initial = await buildWatchEvidenceReference(first);
    const same = await buildWatchEvidenceReference(refreshed);
    expect(same).toEqual(initial);
    expect(compareWatchEvidence(initial, same)).toBe("unchanged");
    expect(compareWatchEvidence(initial, { ...same, sourceEditionId: "edition-2" })).toBe("edition-only");

    const revised = { ...refreshed, value: 3, points: refreshed.points.map((point) => ({ ...point, value: 3 })) };
    expect(compareWatchEvidence(initial, await buildWatchEvidenceReference(revised))).toBe("changed");
    expect(compareWatchEvidence(undefined, initial)).toBe("first-visit");
    expect(compareWatchEvidence(initial, null)).toBe("unavailable");
  });

  it("retains only valid baselines for catalog measures", async () => {
    const reference = await buildWatchEvidenceReference(record("measure-0") as unknown as import("@/app/lib/measureCatalog").MeasureRecord);
    const parsed = parseWatchEvidenceBaselines({ version: 1, measures: {
      "measure-0": reference,
      missing: reference,
      "measure-1": { signature: "raw-data", sourceEditionId: "edition-1" },
    } }, catalog);
    expect(parsed).toEqual({ version: 1, measures: { "measure-0": reference } });
  });
});
