import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BriefingEdition from "@/app/components/BriefingEdition";
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
  });

  it("maps every guided story reference to a canonical catalog measure", () => {
    for (const story of [householdStory, publicFinanceStory]) {
      expect(story.owner).toBeTruthy();
      expect(story.measureIds.length).toBeGreaterThan(0);
      expect(story.measureIds.every((id) => (MEASURE_IDS as readonly string[]).includes(id))).toBe(true);
    }
  });
});
