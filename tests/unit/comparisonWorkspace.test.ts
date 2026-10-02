import { describe, expect, it } from "vitest";
import { parseWorkspace, workspaceUrl } from "@/app/lib/comparisonWorkspace";
import type { MeasureCatalog } from "@/app/lib/measureCatalog";

function record(id: string, comparisonKey = "jobs-unemployment") {
  return {
    id, label: id, evidenceClass: "official-statistics", comparisonKey, cadence: "monthly",
    unit: "%", basis: "Unemployed people as a share of the economically active population",
    geography: { code: "GB", label: "Great Britain" }, sourceId: `source-${id}`, sourceUrl: `https://example.org/${id}`,
    sourceEditionId: `edition-${id}`, observationPeriod: { start: "2024-01-01", end: "2024-02-01", label: "Jan to Feb 2024" },
    publishedAt: "2024-03-01T00:00:00.000Z", fetchedAt: "2024-03-01T00:00:00.000Z", validUntil: "2030-01-01T00:00:00.000Z",
    availability: "current", value: 5.1, revisionId: `revision-${id}`,
    points: [
      { period: "January", observedAt: "2024-01-01", value: 5, valueStatus: "estimate", revisionId: `revision-${id}` },
      { period: "February", observedAt: "2024-02-01", value: 5.1, valueStatus: "estimate", revisionId: `revision-${id}` },
    ], caveats: [],
  };
}

const catalog = {
  schemaVersion: 2, editionId: "edition", generatedAt: "2024-03-01T00:00:00.000Z", validUntil: "2030-01-01T00:00:00.000Z",
  measures: { first: record("first"), second: record("second"), third: record("third"), fourth: record("fourth"), fifth: record("fifth"), other: record("other", "inflation") },
} as unknown as MeasureCatalog;

describe("comparison workspace", () => {
  it("starts with a compatible pair on a clean visit and preserves an explicit empty selection", () => {
    expect(parseWorkspace("", catalog).measureIds).toEqual(["fifth", "first"]);
    expect(parseWorkspace("", catalog).mode).toBe("overlay");
    expect(parseWorkspace("?measure=", catalog).measureIds).toEqual([]);
    expect(parseWorkspace("?start=2024-01-01&end=2024-02-01&mode=panels", catalog).measureIds).toEqual([]);
  });

  it("uses the catalog's observation window when no measures are selected", () => {
    expect(parseWorkspace("?measure=", catalog).window).toEqual({ start: "2024-01-01", end: "2024-02-01" });
  });

  it("restores measure identities, dates and overlay mode from its URL", () => {
    const workspace = parseWorkspace("?measure=first,second&start=2024-01-01&end=2024-02-01&mode=overlay", catalog);
    expect(workspace).toEqual({ version: 1, measureIds: ["first", "second"], window: { start: "2024-01-01", end: "2024-02-01" }, mode: "overlay" });
    expect(parseWorkspace(workspaceUrl(workspace).split("?")[1], catalog)).toEqual(workspace);
  });

  it("downgrades a requested overlay for incompatible measures to labelled panels", () => {
    expect(parseWorkspace("?measure=first,other&mode=overlay", catalog).mode).toBe("panels");
  });

  it.each([
    "?measure=first,first", "?measure=first,unknown", "?measure=first,second,third,fourth,fifth", "?measure=first&start=2024-01-01", "?measure=first&start=2024-03-01&end=2024-02-01",
    "?measure=first&measure=second", "?start=2024-01-01&start=2024-02-01&end=2024-02-01",
  ])("rejects malformed, duplicate, unknown, fifth, or invalid workspace state: %s", (search) => {
    expect(() => parseWorkspace(search, catalog)).toThrow();
  });

  it("rejects oversized shared state before parsing it", () => {
    expect(() => parseWorkspace(`?${"x".repeat(2049)}`, catalog)).toThrow(/too large/i);
  });
});
