import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { barWidthPercent, buildExportPackage, buildPublicationExportPackage, clipPoints, segmentPoints } from "@/app/lib/chartModel";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";

const measure = {
  id: "unemployment", label: "Unemployment rate", evidenceClass: "official-statistics",
  comparisonKey: "gb-lfs-unemployment", cadence: "monthly-three-month-average",
  unit: "%", basis: "ILO unemployed people as a share of the economically active population",
  geography: { code: "GB", label: "Great Britain" }, sourceId: "employmentStats",
  sourceUrl: "https://www.ons.gov.uk/labour-market", sourceEditionId: "ons-labour-2026-06",
  observationPeriod: { start: "2026-01-01", end: "2026-03-31", label: "January to March 2026" },
  publishedAt: "2026-05-19T06:00:00.000Z", fetchedAt: "2026-05-20T10:00:00.000Z",
  validUntil: "2026-11-01T00:00:00.000Z", availability: "current", value: 4.8,
  revisionId: "ons-labour-2026-06",
  points: [
    { period: "November to January 2026", observedAt: "2026-01-31", value: 4.7, valueStatus: "estimate", revisionId: "ons-labour-2026-06" },
    { period: "December to February 2026", observedAt: "2026-02-28", value: null, valueStatus: "estimate", revisionId: "ons-labour-2026-06" },
    { period: "January to March 2026", observedAt: "2026-03-31", value: 4.8, valueStatus: "estimate", revisionId: "ons-labour-2026-06" },
  ],
  caveats: ["Survey estimate; subject to sampling uncertainty and revision."],
} as const;

describe("canonical evidence figure model", () => {
  it("scales bars from zero without imposing a minimum that exaggerates small values", () => {
    expect(barWidthPercent(1, 1_000)).toBe(0.1);
    expect(barWidthPercent(-1, 1_000)).toBe(0);
    expect(barWidthPercent(1_100, 1_000)).toBe(100);
  });

  it("clips observations to an inclusive date window and keeps gaps visible", () => {
    const points = clipPoints(measure.points, { start: "2026-02-01", end: "2026-03-31" });
    expect(points.map(({ observedAt }) => observedAt)).toEqual(["2026-02-28", "2026-03-31"]);
    expect(points[0].value).toBeNull();
  });

  it("does not connect through missing values or across revision identities", () => {
    const points = [
      { ...measure.points[0], value: 4.7 },
      { ...measure.points[1], value: null },
      { ...measure.points[2], value: 4.9, revisionId: "ons-labour-2026-07" },
    ];
    expect(segmentPoints(points)).toEqual([[points[0]], [points[2]]]);
  });

  it("breaks a monthly line when an entire source period is absent", () => {
    const sparse = [measure.points[0], { ...measure.points[2], observedAt: "2026-10-01" }];
    expect(segmentPoints(sparse, "monthly-three-month-average")).toEqual([[sparse[0]], [sparse[1]]]);
  });

  it("packages exact source, period and caveat identities with an export", () => {
    expect(buildExportPackage({
      title: "Unemployment rate",
      measures: [measure],
      dateWindow: { start: "2026-01-01", end: "2026-03-31" },
    })).toMatchObject({
      title: "Unemployment rate",
      dateWindow: { start: "2026-01-01", end: "2026-03-31" },
      measures: [{ id: "unemployment", sourceUrl: measure.sourceUrl, sourceEditionId: measure.sourceEditionId }],
      caveats: measure.caveats,
    });
  });

  it("keeps polling publications in source-specific export metadata", () => {
    const pkg = buildPublicationExportPackage({
      title: "Individual poll publications",
      dateWindow: { start: "2026-01-01", end: "2026-02-01" },
      publications: [{
        id: "yougov-2026-01-30", publisher: "YouGov", title: "Voting intention",
        commissioner: null, questionText: null, headlineMethod: "Voting intention",
        population: "GB adults", geography: "Great Britain", mode: null,
        sampleSize: 2100, sampleSizeNote: null,
        partyResults: { Labour: 34, Conservative: 23 },
        sourceUrl: "https://yougov.co.uk/results/1",
        methodologyUrl: "https://yougov.co.uk/methodology/1", publishedAt: "2026-02-02",
        publicationDateStatus: "published",
        fieldworkStart: "2026-01-30", fieldworkEnd: "2026-02-01",
        disclosures: ["Weighted online sample; 2,100 GB adults."],
      }],
      caveats: ["No average or forecast is presented."],
    });
    expect(pkg.measures).toEqual([]);
    expect(pkg.publications[0]).toMatchObject({ publisher: "YouGov", id: "yougov-2026-01-30" });
    expect(pkg.caveats).toContain("No average or forecast is presented.");
  });

  it("renders the same latest measure value beside the graphic and in a no-script table", () => {
    const markup = renderToStaticMarkup(<EvidenceFigure
      measure={measure}
      title="Unemployment rate"
      description="ONS Labour Force Survey estimate."
      window={{ start: "2026-01-01", end: "2026-03-31" }}
      variant="line"
    />);
    expect(markup).toContain("4.8%");
    expect(markup).toContain("November to January 2026");
    expect(markup).toContain("January to March 2026");
    expect(markup).toContain("Source: ONS Labour Force Survey estimate");
    expect(markup).toContain("sampling uncertainty and revision");
  });

  it("uses and labels an explicit zero baseline for bars", () => {
    const markup = renderToStaticMarkup(<EvidenceFigure
      measure={measure}
      title="Unemployment rate observations"
      description="Official observations."
      window={{ start: "2026-01-01", end: "2026-03-31" }}
      variant="bar"
    />);
    expect(markup).toContain("Vertical axis: 0% to 4.8%; zero baseline shown.");
    expect(markup).toContain("<rect");
    expect(markup).toContain('y1="268" y2="268"');
  });
});
