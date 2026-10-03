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
    const next = edition(measure(undefined, { sourceEditionId: "ons-2" }), "edition-2");
    expect(buildEditionSummary(previous, next)).toMatchObject({ previousEditionId: "edition-1", changes: [] });
  });

  it("distinguishes a new observation from a revision to an older point", () => {
    const previous = edition(measure([point("Jan 2024", "2024-01-31", 2)]), "edition-1");
    const next = edition(measure([
      point("Jan 2024", "2024-01-31", 1.9, "revision-2"),
      point("Feb 2024", "2024-02-29", 2.1, "revision-2"),
    ], { sourceEditionId: "ons-2" }));
    expect(buildEditionSummary(previous, next).changes).toMatchObject([
      { kind: "new-observation", period: "Feb 2024", previous: null, next: 2.1 },
      { kind: "revision", period: "Jan 2024", previous: 2, next: 1.9, previousRevisionId: "revision-1", nextRevisionId: "revision-2", previousSourcePublishedAt: "2024-02-14T07:00:00.000Z", nextSourcePublishedAt: "2024-02-14T07:00:00.000Z", previousSourceUrl: "https://www.ons.gov.uk/prices", nextSourceUrl: "https://www.ons.gov.uk/prices", previousUnit: "%", nextUnit: "%" },
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
    expect(buildEditionSummary(previous, next).changes).toMatchObject([{ kind: "method-change", previous: null, next: null }]);
  });

  it("records source and reader-note changes as metadata changes, not method changes", () => {
    const previous = edition(measure());
    const next = edition(measure([point("Jan 2024", "2024-01-31", 2)], {
      publisher: "A named publisher", note: "A material qualification was added.", publishedAt: "2024-02-15T07:00:00.000Z",
    }));
    expect(buildEditionSummary(previous, next).changes).toMatchObject([
      { kind: "metadata-change", previous: null, next: null, changedFields: ["publisher", "publishedAt", "note"] },
    ]);
  });

  it("uses observation identity and refuses to compare values across unit or geography changes", () => {
    const previous = edition(measure([point("Jan 2024", "2024-01-31", 2)]), "edition-1");
    const next = edition(measure([point("Jan 2024", "2024-01-31", 200)], {
      unit: "basis points", geography: { code: "UK", label: "United Kingdom" },
    }));

    expect(buildEditionSummary(previous, next).changes).toMatchObject([
      { kind: "method-change", previous: null, next: null, previousUnit: "%", nextUnit: "basis points", changedFields: ["unit", "geography.code", "geography.label"] },
    ]);
  });

  it("does not infer a publisher withdrawal from an omitted historical point", () => {
    const previous = edition(measure([
      point("Jan 2024", "2024-01-31", 2),
      point("Feb 2024", "2024-02-29", 2.1),
    ]), "edition-1");
    const next = edition(measure([point("Feb 2024", "2024-02-29", 2.1)], { sourceEditionId: "ons-2" }));

    expect(buildEditionSummary(previous, next).changes).toEqual([]);
  });

  it("reports a methodology change once per measure instead of marking every historic point", () => {
    const previous = edition(measure([
      point("Jan 2024", "2024-01-31", 2),
      point("Feb 2024", "2024-02-29", 2.1),
      point("Mar 2024", "2024-03-31", 2.2),
    ]), "edition-1");
    const next = edition(measure([
      point("Jan 2024", "2024-01-31", 2),
      point("Feb 2024", "2024-02-29", 2.1),
      point("Mar 2024", "2024-03-31", 2.2),
    ], { basis: "A revised CPI definition" }));

    expect(buildEditionSummary(previous, next).changes).toEqual([
      expect.objectContaining({ kind: "method-change", period: null, observedAt: null, previous: null, next: null }),
    ]);
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
    expect(summary.previousEditionId).toBeNull();
  });
});
