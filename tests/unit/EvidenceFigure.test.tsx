import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { barWidthPercent, buildExportPackage, buildPublicationExportPackage, clipPoints, exportPackageCitation, segmentPoints, serializeMeasureExportCsv, serializeMeasureExportJson } from "@/app/lib/chartModel";
import EvidenceFigure from "@/app/components/charts/EvidenceFigure";
import type { MeasurePoint, MeasureRecord } from "@/app/lib/measureCatalog";

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

function renderFigure(
  points: MeasurePoint[],
  variant: "line" | "step" | "bar" | "dot" = "line",
  window = { start: "2026-01-01", end: "2026-12-31" },
) {
  const latest = [...points].reverse().find((point) => point.value !== null);
  return renderToStaticMarkup(<EvidenceFigure
    measure={{
      ...measure,
      availability: latest ? "current" : "unavailable",
      value: latest?.value ?? null,
      validUntil: latest ? measure.validUntil : null,
      points,
    } as unknown as MeasureRecord}
    title="Unemployment rate"
    description="Published survey observations."
    window={window}
    variant={variant}
  />);
}

function markerPositions(markup: string) {
  return [...markup.matchAll(/<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

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
    const pkg = buildExportPackage({
      title: "Unemployment rate",
      measures: [measure],
      dateWindow: { start: "2026-01-01", end: "2026-03-31" },
    });
    expect(pkg).toMatchObject({
      title: "Unemployment rate",
      dateWindow: { start: "2026-01-01", end: "2026-03-31" },
      measures: [{ id: "unemployment", sourceUrl: measure.sourceUrl, sourceEditionId: measure.sourceEditionId }],
      caveats: measure.caveats,
    });
    expect(pkg.measures[0].observations).toEqual(measure.points);
    expect(serializeMeasureExportCsv(pkg)).toContain("December to February 2026");
    expect(serializeMeasureExportCsv(pkg)).toContain(
      '"2026-05-19T06:00:00.000Z","published","January to March 2026","2026-03-31","January to March 2026","4.8","estimate"',
    );
  });

  it("records comparison mode and axis transformation in machine-readable exports", () => {
    const pkg = buildExportPackage({
      title: "Unemployment comparison",
      measures: [measure],
      dateWindow: { start: "2026-02-01", end: "2026-03-31" },
      comparison: {
        displayMode: "panels",
        transformations: ["Separate measure-specific scales; source values are not rebased."],
      },
    });

    const json = JSON.parse(serializeMeasureExportJson(pkg));
    const csv = serializeMeasureExportCsv(pkg);
    expect(json.comparison).toEqual({
      displayMode: "panels",
      transformations: ["Separate measure-specific scales; source values are not rebased."],
    });
    expect(json.dateWindow).toEqual({ start: "2026-02-01", end: "2026-03-31" });
    expect(json.measures[0].observations.map((point: MeasurePoint) => point.observedAt)).toEqual(["2026-02-28", "2026-03-31"]);
    expect(csv).toContain("display_mode");
    expect(csv).toContain("panels");
    expect(csv).toContain("Separate measure-specific scales; source values are not rebased.");
  });

  it("keeps spreadsheet-formula text inert in CSV exports", () => {
    const unsafeMeasure = {
      ...measure,
      points: [{ ...measure.points[2], period: "=HYPERLINK(\"https://example.invalid\")" }],
    };
    const pkg = buildExportPackage({
      title: "=SUM(1,1)",
      measures: [unsafeMeasure],
      dateWindow: { start: "2026-01-01", end: "2026-03-31" },
    });

    const csv = serializeMeasureExportCsv(pkg);
    expect(csv).toContain("\"'=SUM(1,1)\"");
    expect(csv).toContain("\"'=HYPERLINK(");
  });

  it("keeps polling publications in source-specific export metadata", () => {
    const pkg = buildPublicationExportPackage({
      title: "Individual poll publications",
      dateWindow: { start: "2026-01-01", end: "2026-02-01" },
      publications: [{
        id: "yougov-2026-01-30", publisher: "YouGov", sourceUrl: "https://yougov.co.uk/results/1",
        title: "Voting intention published 2 February 2026", commissioner: "Example newspaper", questionText: "Voting intention question",
        headlineMethod: "Voting intention", population: "GB adults", geography: "Great Britain", mode: "Online",
        sampleSize: 2100, sampleSizeNote: null, partyResults: { conservative: 26, labour: 24 },
        methodologyUrl: "https://yougov.co.uk/methodology/1", publishedAt: "2026-02-02", publicationDateStatus: "published",
        fieldworkStart: "2026-01-30", fieldworkEnd: "2026-02-01",
        disclosures: ["Weighted online sample; 2,100 GB adults."],
      }],
      caveats: ["No average or forecast is presented."],
    });
    expect(pkg.measures).toEqual([]);
    expect(pkg.publications[0]).toMatchObject({ publisher: "YouGov", id: "yougov-2026-01-30" });
    expect(pkg.caveats).toContain("No average or forecast is presented.");
    const csv = serializeMeasureExportCsv(pkg);
    const json = JSON.parse(serializeMeasureExportJson(pkg));
    expect(csv).toContain("yougov-2026-01-30");
    expect(csv).toContain("\"conservative\",\"26\",\"2100\"");
    expect(csv).toContain("2026-01-31T00:00:00.000Z");
    expect(csv).toContain("https://yougov.co.uk/methodology/1");
    expect(json.publications[0].partyResults).toEqual({ conservative: 26, labour: 24 });
    expect(json.publications[0].publisher).toBe("YouGov");
    expect(json.schemaVersion).toBe(1);
  });

  it("exports an undisclosed polling publication date as null, without substituting fieldwork or retrieval", () => {
    const pkg = buildPublicationExportPackage({
      title: "Polling publications",
      dateWindow: { start: "2026-09-25", end: "2026-09-29" },
      publications: [{
        id: "more-in-common-2026-09-29", publisher: "More in Common",
        sourceUrl: "https://www.moreincommon.org.uk/polling-tables/current.xlsx",
        title: "GB voting intention tracker", commissioner: null, questionText: null,
        headlineMethod: "Publisher-weighted voting-intention headline", population: "GB adults",
        geography: "Great Britain", mode: null, sampleSize: 1514, sampleSizeNote: "Unweighted headline base.",
        partyResults: { conservative: 22.1, labour: 26.9 },
        methodologyUrl: "https://www.moreincommon.org.uk/polling-tables/",
        publishedAt: null, publicationDateStatus: "not-disclosed",
        fieldworkStart: "2026-09-25", fieldworkEnd: "2026-09-29", disclosures: [],
      }],
      caveats: [],
    });

    const json = JSON.parse(serializeMeasureExportJson(pkg));
    const csv = serializeMeasureExportCsv(pkg);
    expect(json.publications[0]).toMatchObject({ publishedAt: null, publicationDateStatus: "not-disclosed" });
    expect(csv).toContain("more-in-common-2026-09-29");
    expect(csv).toContain("not-disclosed");
    expect(exportPackageCitation(pkg)).toContain("publication date not disclosed");
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
    expect(markup).toContain("Source revision identifier ons-labour-2026-06");
    expect(markup).not.toContain("Revision ons-labour-2026-06");
    expect(markup).toContain("November to January 2026");
    expect(markup).toContain("January to March 2026");
    expect(markup).toContain("Source: ONS Labour Force Survey estimate");
    expect(markup).toContain("sampling uncertainty and revision");
    expect(markup).toContain("Download selected observations:");
    expect(markup).toContain('data-chart-language="public-data"');
    expect(markup).toContain("var(--chart-series, #315f8f)");
    expect(markup).toContain("Latest observation");
    expect(markup).toContain(">CSV</button>");
    expect(markup).toContain(">JSON</button>");
  });

  it("links the citation directly to the primary publication", () => {
    const markup = renderFigure([...measure.points]);

    expect(markup).toMatch(/<a href="https:\/\/www\.ons\.gov\.uk\/labour-market"[^>]*>Primary publication<\/a>/);
  });

  it("places irregularly spaced observations at their actual calendar distances", () => {
    const points: MeasurePoint[] = [
      { ...measure.points[0], observedAt: "2026-01-01", value: 1 },
      { ...measure.points[0], observedAt: "2026-01-11", value: 2 },
      { ...measure.points[0], observedAt: "2026-04-02", value: 3 },
    ];
    const positions = markerPositions(renderFigure(points));

    expect(positions).toHaveLength(3);
    expect(positions[0].x).toBe(220);
    expect(positions[1].x).toBeCloseTo(220 + 542 * 10 / 91, 3);
    expect(positions[2].x).toBe(762);
  });

  it("keeps many irregular, negative, missing and revised observations inside the plot", () => {
    const points: MeasurePoint[] = Array.from({ length: 12 }, (_, index) => ({
      ...measure.points[0],
      period: `Published observation ${index + 1}`,
      observedAt: new Date(Date.UTC(2025, index, 15)).toISOString().slice(0, 10),
      value: index === 5 ? null : index - 6,
      revisionId: index >= 9 ? "ons-labour-corrected" : "ons-labour-original",
    }));
    const markup = renderFigure(points, "line", { start: "2025-01-01", end: "2025-12-31" });
    const markers = markerPositions(markup);

    expect(markers).toHaveLength(11);
    expect(markers.every(({ x, y }) => x >= 220 && x <= 762 && y >= 22 && y <= 268)).toBe(true);
    expect(markup).toContain("Show observation table (12)");
    expect(markup).toContain("Not available");
  });

  it("centres a single published point in the visible plot", () => {
    const markup = renderFigure([{ ...measure.points[0], value: 4.7 }]);
    expect(markerPositions(markup)).toEqual([{ x: 491, y: expect.any(Number) }]);
  });

  it("keeps a long period label available while shortening the plot-edge label", () => {
    const longPeriod = "December 2025 to February 2026 provisional estimate";
    const point: MeasurePoint = { ...measure.points[0], period: longPeriod, observedAt: "2026-02-28", value: 4.4 };
    const markup = renderFigure([point]);

    expect(markup).toContain(`<title>${longPeriod}</title>`);
    expect(markup).toContain("December 2025 to Februa…");
  });

  it.each([
    ["zero", [] as MeasurePoint[], 0],
    ["one", [measure.points[0]] as MeasurePoint[], 1],
    ["two", [measure.points[0], measure.points[2]] as MeasurePoint[], 2],
    ["many with a missing point", [...measure.points] as MeasurePoint[], 2],
  ])("keeps %s observations and null gaps exact", (_shape, points, expectedMarkers) => {
    const markup = renderFigure(points);
    expect(markerPositions(markup)).toHaveLength(expectedMarkers);
    if (points.length === 0) expect(markup).toContain("No observations in this window");
    if (points.length > 0) expect(markup).toContain(`Show observation table (${points.length})`);
  });

  it.each([-5, 0])("keeps a constant value of %s visible without changing its value", (value) => {
    const point: MeasurePoint = { ...measure.points[0], observedAt: "2026-04-30", value };
    const markup = renderFigure([point]);

    expect(markerPositions(markup)).toHaveLength(1);
    expect(markup).toContain(`${value}%`);
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

  it("draws a negative bar from the zero baseline without inverting or clipping it", () => {
    const negativeMeasure = {
      ...measure,
      availability: "current",
      value: -5,
      points: [{ ...measure.points[0], value: -5 }],
    } as unknown as MeasureRecord;
    const markup = renderToStaticMarkup(<EvidenceFigure
      measure={negativeMeasure}
      title="Net change"
      description="Published net change, including negative values."
      window={{ start: "2026-01-01", end: "2026-12-31" }}
      variant="bar"
    />);

    expect(markup).toContain("Vertical axis: -5% to 0%; zero baseline shown.");
    expect(markup).toContain('y1="22" y2="22"');
    expect(markup).toContain('y="22" width="42" height="246"');
  });
});
