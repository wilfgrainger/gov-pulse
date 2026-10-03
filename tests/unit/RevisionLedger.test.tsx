import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RevisionLedger from "@/app/components/RevisionLedger";
import type { EditionSummary } from "@/app/lib/serverEditionArchive";

const summary = {
  id: "edition-2026-10-03",
  publishedAt: "2026-10-03T08:00:00.000Z",
  sourceEditionIds: ["ons-current"],
  changes: [
    {
      measureId: "inflation", kind: "revision", observedAt: "2026-08-31", period: "August 2026",
      previousSourceEditionId: "ons-previous", nextSourceEditionId: "ons-current",
      previousRevisionId: "revision-previous", nextRevisionId: "revision-current",
      previousSourcePublishedAt: "2026-09-16T07:00:00.000Z", nextSourcePublishedAt: "2026-10-02T07:00:00.000Z",
      previousSourceUrl: "https://www.ons.gov.uk/releases/previous", nextSourceUrl: "https://www.ons.gov.uk/releases/current",
      previousUnit: "%", nextUnit: "%", previous: 3.4, next: 3.2,
    },
    {
      measureId: "gdp", kind: "metadata-change", observedAt: null, period: null,
      previousSourceEditionId: "ons-gdp-old", nextSourceEditionId: "ons-gdp-new",
      previousRevisionId: "gdp-old", nextRevisionId: "gdp-new",
      previousSourcePublishedAt: "2026-09-30T07:00:00.000Z", nextSourcePublishedAt: "2026-10-02T07:00:00.000Z",
      previousSourceUrl: "https://www.ons.gov.uk/gdp/old", nextSourceUrl: "https://www.ons.gov.uk/gdp/new",
      previousUnit: "GBP billion", nextUnit: "GBP billion", previous: null, next: null, changedFields: ["sourceUrl"],
    },
  ],
} as EditionSummary;

describe("public revision ledger", () => {
  it("shows exact units, source publication dates and both primary source editions", () => {
    const html = renderToStaticMarkup(<RevisionLedger summaries={[summary]}/>);

    expect(html).toContain("Publisher revision");
    expect(html).toContain("3.4 % → 3.2 %");
    expect(html).toContain("2026-09-16 → 2026-10-02");
    expect(html).toContain('href="https://www.ons.gov.uk/releases/previous"');
    expect(html).toContain('href="https://www.ons.gov.uk/releases/current"');
  });

  it("labels metadata-only changes without showing a fake value transition", () => {
    const html = renderToStaticMarkup(<RevisionLedger summaries={[summary]} measureIds={["gdp"]}/>);

    expect(html).toContain("Source metadata change");
    expect(html).toContain("Source metadata changed; no numeric change is inferred.");
    expect(html).toContain("Changed metadata: sourceUrl.");
    expect(html).toContain('href="https://www.ons.gov.uk/gdp/old"');
    expect(html).toContain('href="https://www.ons.gov.uk/gdp/new"');
    expect(html).not.toContain("not previously reported → unavailable");
  });
});
