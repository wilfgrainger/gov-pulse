import { describe, expect, it } from "vitest";
import { MAX_COMPARISON_MEASURES, parseWorkspace, workspaceUrl } from "@/app/lib/comparisonWorkspace";
import { parseNamedComparisonWorkspaces } from "@/app/lib/comparisonSavedWorkspaces";
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
    expect(new URL(workspaceUrl(workspace), "https://public-data.org").searchParams.get("version")).toBe("1");
  });

  it("shares twelve selections within the URL-size guard", () => {
    const records = Array.from({ length: MAX_COMPARISON_MEASURES }, (_, index) => record(`measure-${index}`));
    const manyMeasures = { ...catalog, measures: Object.fromEntries(records.map((item) => [item.id, item])) } as unknown as MeasureCatalog;
    const workspace = {
      version: 1 as const,
      measureIds: records.map((item) => item.id),
      window: { start: "2024-01-01", end: "2024-02-01" },
      mode: "panels" as const,
    };
    const url = workspaceUrl(workspace);
    expect(url.length).toBeLessThan(2048);
    expect(parseWorkspace(url.split("?")[1], manyMeasures)).toEqual(workspace);
  });

  it("downgrades a requested overlay for incompatible measures to labelled panels", () => {
    expect(parseWorkspace("?measure=first,other&mode=overlay", catalog).mode).toBe("panels");
  });

  it.each([
    "?measure=first,first", "?measure=first,unknown", "?measure=first&start=2024-01-01", "?measure=first&start=2024-03-01&end=2024-02-01",
    "?measure=first&measure=second", "?start=2024-01-01&start=2024-02-01&end=2024-02-01",
    "?version=2&measure=first", "?version=1&version=1&measure=first", "?old_measure=first",
  ])("rejects malformed, duplicate, unknown or invalid workspace state: %s", (search) => {
    expect(() => parseWorkspace(search, catalog)).toThrow();
  });

  it("rejects a thirteenth selection after measuring share-link capacity", () => {
    const records = Array.from({ length: MAX_COMPARISON_MEASURES + 1 }, (_, index) => record(`measure-${index}`));
    const manyMeasures = { ...catalog, measures: Object.fromEntries(records.map((item) => [item.id, item])) } as unknown as MeasureCatalog;
    expect(() => parseWorkspace(`?measure=${records.map((item) => item.id).join(",")}`, manyMeasures)).toThrow(/up to 12/i);
  });

  it("rejects oversized shared state before parsing it", () => {
    expect(() => parseWorkspace(`?${"x".repeat(2049)}`, catalog)).toThrow(/too large/i);
  });
});

describe("named comparison workspaces", () => {
  const file = (overrides: Record<string, unknown> = {}) => ({
    version: 1,
    workspaces: [{
      id: "workspace-0001",
      name: "  Employment trends  ",
      workspace: { version: 1, measureIds: ["first", "second"], window: { start: "2024-01-01", end: "2024-02-01" }, mode: "overlay" },
      unavailableMeasureIds: [],
    }],
    ...overrides,
  });

  it("normalizes and round-trips a named, versioned workspace", () => {
    expect(parseNamedComparisonWorkspaces(file(), catalog)).toEqual({
      version: 1,
      workspaces: [{
        id: "workspace-0001",
        name: "Employment trends",
        workspace: { version: 1, measureIds: ["first", "second"], window: { start: "2024-01-01", end: "2024-02-01" }, mode: "overlay" },
        unavailableMeasureIds: [],
      }],
    });
  });

  it("preserves removed measures with an explicit unavailable list", () => {
    const input = file({
      workspaces: [{
        id: "workspace-0001", name: "Old selection",
        workspace: { version: 1, measureIds: ["first", "retired-measure"], window: { start: "2024-01-01", end: "2024-02-01" }, mode: "panels" },
      }],
    });
    const parsed = parseNamedComparisonWorkspaces(input, catalog);
    expect(parsed.workspaces[0].workspace.measureIds).toEqual(["first", "retired-measure"]);
    expect(parsed.workspaces[0].unavailableMeasureIds).toEqual(["retired-measure"]);
  });

  it("preserves a catalogued measure after its current value expires", () => {
    const expiredCatalog = {
      ...catalog,
      measures: { ...catalog.measures, first: { ...record("first"), validUntil: "2000-01-01T00:00:00.000Z" } },
    } as unknown as MeasureCatalog;
    const input = file({
      workspaces: [{
        id: "workspace-0001", name: "Expired source",
        workspace: { version: 1, measureIds: ["first"], window: { start: "2024-01-01", end: "2024-02-01" }, mode: "panels" },
      }],
    });
    expect(parseNamedComparisonWorkspaces(input, expiredCatalog).workspaces[0].unavailableMeasureIds).toEqual(["first"]);
  });

  it.each([
    file({ version: 2 }),
    file({ workspaces: [{ id: "bad", name: "x", workspace: { version: 1, measureIds: [], window: { start: "2024-02-01", end: "2024-01-01" }, mode: "panels" } }] }),
    file({ workspaces: [{ id: "workspace-0001", name: "x", workspace: { version: 1, measureIds: ["first", "first"], window: { start: "2024-01-01", end: "2024-02-01" }, mode: "panels" } }] }),
  ])("rejects invalid imported workspace files", (input) => {
    expect(() => parseNamedComparisonWorkspaces(input, catalog)).toThrow();
  });

  it("rejects duplicate saved workspace identities", () => {
    const item = (name: string) => ({ id: "workspace-0001", name, workspace: { version: 1, measureIds: [], window: { start: "2024-01-01", end: "2024-02-01" }, mode: "panels" } });
    expect(() => parseNamedComparisonWorkspaces({ version: 1, workspaces: [item("One"), item("Two")] }, catalog)).toThrow(/duplicate ids/i);
  });
});
