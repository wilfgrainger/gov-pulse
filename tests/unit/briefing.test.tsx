import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BriefingEdition from "@/app/components/BriefingEdition";
import StoryEvidence from "@/app/components/StoryEvidence";
import householdStory from "@/app/content/stories/household-budgets";
import publicFinanceStory from "@/app/content/stories/public-finances";
import { MEASURE_IDS } from "../../worker/measure-catalog.js";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";

const measure = {
  id: "inflation", label: "CPI inflation", evidenceClass: "official-statistics", comparisonKey: "uk-cpi-annual-inflation", cadence: "monthly", unit: "%", basis: "Annual CPI change",
  geography: { code: "UK", label: "United Kingdom" }, sourceId: "ons", sourceUrl: "https://www.ons.gov.uk/prices", sourceEditionId: "ons-2026-02",
  observationPeriod: { start: "2026-01-01", end: "2026-01-31", label: "January 2026" }, publishedAt: "2026-02-18T07:00:00.000Z", fetchedAt: "2026-02-18T08:00:00.000Z", validUntil: "2026-03-18T00:00:00.000Z", availability: "historical", value: 3.2, revisionId: "ons-2026-02",
  points: [], caveats: [],
};

describe("edition briefing and guided story contracts", () => {
  it("shows the dated edition's changes and marks historical values as non-current", () => {
    const snapshot = { meta: {
      registryVersion: "test", sources: {}, measureCatalog: { schemaVersion: 2, editionId: "catalog-1", generatedAt: "2026-02-19T00:00:00.000Z", validUntil: null, measures: { inflation: measure } },
      editionSummary: { id: "edition-2", publishedAt: "2026-02-19T00:00:00.000Z", sourceEditionIds: ["ons-2026-02"], changes: [{ measureId: "inflation", kind: "revision", observedAt: "2026-01-31", period: "January 2026", previousSourceEditionId: "ons-2026-01", nextSourceEditionId: "ons-2026-02", previousRevisionId: "ons-2026-01", nextRevisionId: "ons-2026-02", previous: 3.3, next: 3.2 }] },
    } } as MetricsSnapshot;
    const markup = renderToStaticMarkup(<BriefingEdition snapshot={snapshot}/>);
    expect(markup).toContain("Historical revision");
    expect(markup).toContain("3.3 % → 3.2 %");
    expect(markup).toContain("Historical edition · not a current headline");
    expect(markup).toContain("edition-2");
    expect(markup).toContain('href="/editions/edition-2"');
    expect(markup).toContain("Published 2026-02-18");
    expect(markup).toContain('href="https://www.ons.gov.uk/prices"');
  });

  it("keeps missing story measures visible and labels their values unavailable", () => {
    const catalog = { schemaVersion: 2, editionId: "catalog-1", generatedAt: "2026-02-19T00:00:00.000Z", validUntil: null, measures: { inflation: measure } };
    const markup = renderToStaticMarkup(<StoryEvidence measureIds={["inflation", "unemployment"]} catalog={catalog}/>);

    expect(markup).toContain("CPI inflation");
    expect(markup).toContain("Unemployment rate");
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("No verified observation in this edition");
    expect(markup).toContain("https://www.ons.gov.uk/prices");
    expect(markup).toContain("Source evidence expired; value unavailable");
    expect(markup).not.toContain("3.2 %");
  });

  it("explains method changes without rendering an unlike-for-like numeric delta", () => {
    const snapshot = { meta: {
      registryVersion: "test", sources: {}, measureCatalog: { schemaVersion: 2, editionId: "catalog-1", generatedAt: "2026-02-19T00:00:00.000Z", validUntil: null, measures: { inflation: measure } },
      editionSummary: { id: "edition-2", publishedAt: "2026-02-19T00:00:00.000Z", sourceEditionIds: ["ons-2026-02"], changes: [{ measureId: "inflation", kind: "method-change", observedAt: null, period: null, previousSourceEditionId: "ons-2026-01", nextSourceEditionId: "ons-2026-02", previousRevisionId: "ons-2026-01", nextRevisionId: "ons-2026-02", previous: null, next: null }] },
    } } as MetricsSnapshot;
    const markup = renderToStaticMarkup(<BriefingEdition snapshot={snapshot}/>);
    expect(markup).toContain("Definition or method changed; values are not treated as like-for-like.");
    expect(markup).not.toContain("3.3 % → 3.2 %");
  });

  it("separates source metadata changes from numeric revisions and keeps both publication links", () => {
    const snapshot = { meta: {
      registryVersion: "test", sources: {}, measureCatalog: { schemaVersion: 2, editionId: "catalog-1", generatedAt: "2026-02-19T00:00:00.000Z", validUntil: null, measures: { inflation: measure } },
      editionSummary: { id: "edition-2", publishedAt: "2026-02-19T00:00:00.000Z", sourceEditionIds: ["ons-2026-02"], changes: [{ measureId: "inflation", kind: "metadata-change", observedAt: null, period: null, previousSourceEditionId: "ons-2026-01", nextSourceEditionId: "ons-2026-02", previousRevisionId: "ons-2026-01", nextRevisionId: "ons-2026-02", previousSourcePublishedAt: "2026-02-17T07:00:00.000Z", nextSourcePublishedAt: "2026-02-18T07:00:00.000Z", previousSourceUrl: "https://www.ons.gov.uk/old", nextSourceUrl: "https://www.ons.gov.uk/new", previousUnit: "%", nextUnit: "%", previous: null, next: null, changedFields: ["publishedAt", "sourceUrl"] }] },
    } } as MetricsSnapshot;
    const markup = renderToStaticMarkup(<BriefingEdition snapshot={snapshot}/>);

    expect(markup).toContain("Source metadata changed");
    expect(markup).toContain("No numeric change is inferred");
    expect(markup).toContain("2026-02-17 → 2026-02-18");
    expect(markup).toContain('href="https://www.ons.gov.uk/old"');
    expect(markup).toContain('href="https://www.ons.gov.uk/new"');
    expect(markup).not.toContain("unavailable → unavailable");
  });

  it.each([
    [null, "No comparable previous publication is archived for this edition."],
    ["catalog-previous", "No evidence changes were recorded against previous edition catalog-previous."],
    [undefined, "This stored edition does not record whether a comparable previous publication was available."],
  ])("describes an empty briefing accurately when baseline identity is %s", (previousEditionId, expected) => {
    const snapshot = { meta: {
      registryVersion: "test", sources: {},
      editionSummary: { id: "catalog-current", publishedAt: "2026-02-19T00:00:00.000Z", sourceEditionIds: ["ons-2026-02"], previousEditionId, changes: [] },
    } } as unknown as MetricsSnapshot;
    expect(renderToStaticMarkup(<BriefingEdition snapshot={snapshot}/>)).toContain(expected);
  });

  it("maps every guided story reference to a canonical catalog measure", () => {
    for (const story of [householdStory, publicFinanceStory]) {
      expect(story.owner).toBeTruthy();
      expect(story.measureIds.length).toBeGreaterThan(0);
      expect(story.measureIds.every((id) => (MEASURE_IDS as readonly string[]).includes(id))).toBe(true);
    }
  });
});
