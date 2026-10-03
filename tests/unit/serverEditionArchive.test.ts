// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readArchivedEdition, readEditionSummaries } from "@/app/lib/serverEditionArchive";

const id = "catalog-2026-07-01-a1";
const publishedAt = "2026-07-01T00:00:00.000Z";
const catalog = {
  schemaVersion: 2,
  editionId: id,
  generatedAt: publishedAt,
  validUntil: "2026-07-08T00:00:00.000Z",
  measures: {
    inflation: {
      id: "inflation", label: "CPI inflation", evidenceClass: "official-statistics",
      comparisonKey: "uk-cpi-annual", cadence: "monthly", unit: "%", basis: "Annual CPI change",
      geography: { code: "UK", label: "United Kingdom" }, sourceId: "sentimentPulse",
      sourceUrl: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
      sourceEditionId: "ons-inflation-2026-06-16-a1",
      observationPeriod: { start: "2026-06-01", end: "2026-06-30", label: "June 2026" },
      publishedAt: "2026-07-01T00:00:00.000Z", fetchedAt: "2026-07-01T01:00:00.000Z",
      validUntil: "2026-08-01T00:00:00.000Z", availability: "current", value: 3.2,
      revisionId: "ons-inflation-2026-06-16-a1",
      points: [{ period: "June 2026", observedAt: "2026-06-30", value: 3.2, valueStatus: "observed", revisionId: "ons-inflation-2026-06-16-a1" }],
      caveats: [],
    },
  },
};
const summary = {
  id,
  publishedAt,
  previousEditionId: "catalog-2026-06-01-b1",
  sourceEditionIds: ["ons-inflation-2026-06-16-a1"],
  changes: [{
    measureId: "inflation", kind: "new-observation", observedAt: "2026-06-30", period: "June 2026",
    previousSourceEditionId: null, nextSourceEditionId: "ons-inflation-2026-06-16-a1",
    previousRevisionId: null, nextRevisionId: "ons-inflation-2026-06-16-a1", previous: null, next: 3.2,
    previousSourcePublishedAt: null, nextSourcePublishedAt: "2026-07-01T00:00:00.000Z",
    previousSourceUrl: null, nextSourceUrl: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
    previousUnit: null, nextUnit: "%",
  }],
};
const archived = {
  edition: id,
  asOf: publishedAt,
  availability: "historical",
  measureCatalog: catalog,
  summary,
};

afterEach(() => vi.unstubAllGlobals());

function serve(payload: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })));
}

describe("server edition archive reads", () => {
  it("accepts matching dated summaries and a validated immutable catalog", async () => {
    serve({ editions: [summary], retention: 1 });
    await expect(readEditionSummaries()).resolves.toEqual([summary]);

    serve(archived);
    await expect(readArchivedEdition(id)).resolves.toEqual(archived);
  });

  it("continues to read archived summaries that predate baseline identity", async () => {
    const legacySummary = Object.fromEntries(Object.entries(summary).filter(([key]) => key !== "previousEditionId"));
    serve({ editions: [legacySummary], retention: 1 });
    await expect(readEditionSummaries()).resolves.toEqual([legacySummary]);
  });

  it.each([
    ["unsafe edition ID", { ...summary, id: "catalog other" }],
    ["invalid publication time", { ...summary, publishedAt: "not-a-time" }],
    ["unlisted source identity", { ...summary, changes: [{ ...summary.changes[0], nextSourceEditionId: "not-in-manifest" }] }],
    ["unsafe source link", { ...summary, changes: [{ ...summary.changes[0], nextSourceUrl: "javascript:alert(1)" }] }],
  ])("rejects a summary with %s", async (_label, invalidSummary) => {
    serve({ editions: [invalidSummary], retention: 1 });
    await expect(readEditionSummaries()).resolves.toBeNull();
  });

  it("rejects detail data with the wrong as-of identity, availability or measure shape", async () => {
    serve({ ...archived, asOf: "2026-07-02T00:00:00.000Z" });
    await expect(readArchivedEdition(id)).resolves.toBeNull();

    serve({ ...archived, availability: "current" });
    await expect(readArchivedEdition(id)).resolves.toBeNull();

    serve({ ...archived, measureCatalog: { ...catalog, measures: { inflation: { ...catalog.measures.inflation, value: "3.2" } } } });
    await expect(readArchivedEdition(id)).resolves.toBeNull();
  });
});
