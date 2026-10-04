import { describe, expect, it } from "vitest";
import type { MeasureRecord } from "@/app/lib/measureCatalog";
import { selectSourceRecordMeasures, sourceHistoryHref } from "@/app/lib/sourceHistory";

const measure = (id: string, publisher: string): MeasureRecord => ({
  id,
  label: id === "inflation" ? "CPI inflation" : "Official Bank Rate",
  evidenceClass: id === "bankRate" ? "official-policy" : "official-statistics",
  publisher,
  comparisonKey: id,
  cadence: "monthly",
  unit: "%",
  basis: id,
  geography: { code: "UK", label: "United Kingdom" },
  sourceId: "sentimentPulse",
  sourceUrl: id === "inflation" ? "https://www.ons.gov.uk/inflation" : "https://www.bankofengland.co.uk/bank-rate",
  sourceEditionId: `${id}-edition-2026-09`,
  observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "August 2026" },
  publishedAt: "2026-09-16T00:00:00.000Z",
  fetchedAt: "2026-09-16T01:00:00.000Z",
  validUntil: "2026-12-01T00:00:00.000Z",
  availability: "current",
  value: id === "inflation" ? 3.1 : 3.75,
  revisionId: `${id}-revision-1`,
  points: [{ period: "August 2026", observedAt: "2026-08-31", value: id === "inflation" ? 3.1 : 3.75, valueStatus: "observed", revisionId: `${id}-revision-1` }],
  caveats: [],
});

describe("measure source-history identity", () => {
  const records = [measure("bankRate", "Bank of England"), measure("inflation", "Office for National Statistics")];

  it("links a measure to its own source record within a multi-series collection", () => {
    expect(sourceHistoryHref(records[1])).toBe("/sources/sentimentPulse?measure=inflation");
  });

  it("filters a grouped source record to the requested measure", () => {
    expect(selectSourceRecordMeasures(records, "sentimentPulse", "inflation")).toEqual([records[1]]);
    expect(selectSourceRecordMeasures(records, "sentimentPulse", "missing-measure")).toBeNull();
    expect(selectSourceRecordMeasures(records, "gdpTracker", "inflation")).toBeNull();
  });

  it("keeps the existing grouped source route when no measure is requested", () => {
    expect(selectSourceRecordMeasures(records, "sentimentPulse")).toEqual(records);
  });
});
