import { describe, expect, it } from "vitest";
import { buildEditionSummary } from "../../worker/edition-summary.js";

const point = (period: string, observedAt: string, value: number | null, revisionId = "revision-1") => ({ period, observedAt, value, valueStatus: "observed", revisionId });
const measure = (points = [point("Jan 2024", "2024-01-31", 2)], overrides: Record<string, unknown> = {}) => ({
  id: "inflation", label: "Inflation", evidenceClass: "official-statistics", comparisonKey: "cpi-annual-rate", cadence: "monthly", unit: "%", basis: "Annual consumer price change",
  geography: { code: "GB", label: "Great Britain" }, sourceId: "ons", sourceUrl: "https://www.ons.gov.uk/prices", sourceEditionId: "ons-1",
  observationPeriod: { start: "2024-01-01", end: "2024-01-31", label: "January 2024" }, publishedAt: "2024-02-14T07:00:00.000Z", fetchedAt: "2024-02-14T08:00:00.000Z", validUntil: "2024-03-14T00:00:00.000Z", availability: "current", value: points.at(-1)?.value ?? null,
  revisionId: "revision-1", points, caveats: [], ...overrides,
});
const edition = (record: ReturnType<typeof measure>, id = "edition-2") => ({ schemaVersion: 2, editionId: id, generatedAt: "2024-02-15T00:00:00.000Z", validUntil: null, measures: { inflation: record } });

describe("dated edition summaries", () => {
  it("emits no change for an identical publication", () => {
    const next = edition(measure());
    expect(buildEditionSummary(next, next).changes).toEqual([]);
  });

  it("does not report changes from retrieval or a new edition id when values and methods are identical", () => {
    const previous = edition(measure(), "edition-1");
    const next = edition(measure(undefined, { sourceEditionId: "ons-2", publishedAt: "2024-02-15T07:00:00.000Z" }), "edition-2");
    expect(buildEditionSummary(previous, next).changes).toEqual([]);
  });

  it("distinguishes a new observation from a revision to an older point", () => {
    const previous = edition(measure([point("Jan 2024", "2024-01-31", 2)]), "edition-1");
    const next = edition(measure([
      point("Jan 2024", "2024-01-31", 1.9, "revision-2"),
      point("Feb 2024", "2024-02-29", 2.1, "revision-2"),
    ], { sourceEditionId: "ons-2" }));
    expect(buildEditionSummary(previous, next).changes).toMatchObject([
      { kind: "revision", period: "Jan 2024", previous: 2, next: 1.9, previousRevisionId: "revision-1", nextRevisionId: "revision-2" },
      { kind: "new-observation", period: "Feb 2024", previous: null, next: 2.1 },
    ]);
  });

  it("retains a correction to older history when the latest headline is unchanged", () => {
    const previous = edition(measure([point("Jan 2024", "2024-01-31", 2), point("Feb 2024", "2024-02-29", 2.1)]), "edition-1");
    const next = edition(measure([point("Jan 2024", "2024-01-31", 1.8, "revision-2"), point("Feb 2024", "2024-02-29", 2.1)]));
    expect(buildEditionSummary(previous, next).changes).toMatchObject([{ kind: "revision", period: "Jan 2024", previous: 2, next: 1.8 }]);
  });

  it("labels a definition change without inventing a numeric delta", () => {
    const previous = edition(measure());
    const next = edition(measure([point("Jan 2024", "2024-01-31", 2)], { basis: "A changed methodology", comparisonKey: "revised-cpi" }));
    expect(buildEditionSummary(previous, next).changes).toMatchObject([{ kind: "method-change", previous: 2, next: 2 }]);
  });

  it("preserves transitions to or from disclosed missing values", () => {
    const previous = edition(measure([point("Jan 2024", "2024-01-31", 2)]));
    const next = edition(measure([point("Jan 2024", "2024-01-31", null, "revision-2")]));
    expect(buildEditionSummary(previous, next).changes).toMatchObject([{ kind: "revision", previous: 2, next: null }]);
  });

  it("does not claim change when no previous catalog exists", () => {
    const summary = buildEditionSummary(null, edition(measure()));
    expect(summary.changes).toEqual([]);
    expect(summary.sourceEditionIds).toEqual(["ons-1"]);
  });
});
