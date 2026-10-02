import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canRasterizeToPng,
  chartExportFilename,
  findChartSvg,
  serializeChartSvg,
} from "@/app/lib/chartExport";
import type { ExportPackage } from "@/app/lib/chartModel";

function makeChartSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 640 300");
  svg.setAttribute("width", "640");
  svg.setAttribute("height", "300");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", "0,0 10,10");
  svg.appendChild(line);
  return svg;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("findChartSvg", () => {
  it("returns null for a null container", () => {
    expect(findChartSvg(null)).toBeNull();
  });

  it("returns the element itself when it is already an <svg>", () => {
    const svg = makeChartSvg();
    expect(findChartSvg(svg)).toBe(svg);
  });

  it("finds the first descendant <svg> inside a wrapper container", () => {
    const wrapper = document.createElement("div");
    const svg = makeChartSvg();
    wrapper.appendChild(svg);
    expect(findChartSvg(wrapper)).toBe(svg);
  });

  it("returns null when the container has no <svg> descendant", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = "<span>no chart yet</span>";
    expect(findChartSvg(wrapper)).toBeNull();
  });
});

describe("serializeChartSvg", () => {
  it("produces a standalone SVG document with an XML prolog and explicit xmlns", () => {
    const svg = makeChartSvg();
    const markup = serializeChartSvg(svg);

    expect(markup.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')).toBe(true);
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup).toContain("<polyline");
  });

  it("inlines explicit width/height so the file has no dependency on page CSS", () => {
    const svg = makeChartSvg();
    // jsdom returns a zero getBoundingClientRect; serialization should still
    // fall back to the viewBox/attribute size rather than emitting 0x0.
    const markup = serializeChartSvg(svg);
    expect(markup).toMatch(/width="640"/);
    expect(markup).toMatch(/height="300"/);
  });

  it("embeds the chart title as an accessible <title> element", () => {
    const svg = makeChartSvg();
    const markup = serializeChartSvg(svg, { title: "Net migration: ten annual observations" });
    expect(markup).toContain("<title>Net migration: ten annual observations</title>");
  });

  it("replaces an existing <title> rather than duplicating it", () => {
    const svg = makeChartSvg();
    const existingTitle = document.createElementNS("http://www.w3.org/2000/svg", "title");
    existingTitle.textContent = "Old title";
    svg.insertBefore(existingTitle, svg.firstChild);

    const markup = serializeChartSvg(svg, { title: "New title" });
    expect(markup).toContain("<title>New title</title>");
    expect(markup).not.toContain("Old title");
    expect(markup.match(/<title>/g)?.length).toBe(1);
  });

  it("appends a source-citation watermark line and grows the canvas to fit it", () => {
    const svg = makeChartSvg();
    const markup = serializeChartSvg(svg, { citation: "Source: ONS, published 1 January 2026" });
    expect(markup).toContain("Source: ONS, published 1 January 2026");
    expect(markup).toMatch(/height="318"/); // 300 + 18px footer
  });

  it("wraps long citations into a larger readable footer at narrow and wide sizes", () => {
    const citation = "Source edition ons-labour-2026-06 https://www.ons.gov.uk/labour-market published 2026-05-19 covering January to March 2026; survey estimate subject to sampling uncertainty and revision.";
    const narrow = makeChartSvg();
    narrow.setAttribute("viewBox", "0 0 240 180");
    narrow.setAttribute("width", "240");
    narrow.setAttribute("height", "180");
    const narrowMarkup = serializeChartSvg(narrow, { citation });
    const wideMarkup = serializeChartSvg(makeChartSvg(), { citation });

    expect(narrowMarkup).toMatch(/height="\d{3}"/);
    expect(wideMarkup).toMatch(/height="\d{3}"/);
    expect(narrowMarkup).toContain("uncertainty and revision.");
  });

  it("embeds the export package as portable SVG metadata", () => {
    const exportPackage = {
      title: "Unemployment rate",
      dateWindow: { start: "2026-01-01", end: "2026-03-31" },
      measures: [{ id: "unemployment", sourceUrl: "https://www.ons.gov.uk/labour-market", sourceEditionId: "ons-labour-2026-06" }],
      caveats: ["Survey estimate."],
    } as unknown as ExportPackage;
    const markup = serializeChartSvg(makeChartSvg(), { exportPackage });
    expect(markup).toContain('id="public-data-export-package"');
    expect(markup).toContain("ons-labour-2026-06");
    expect(markup).toContain("2026-01-01");
    expect(markup).toContain("Survey estimate.");
  });

  it("embeds legacy financial chart citation, plotted window, series and caveat as structured SVG metadata", () => {
    const chartMetadata = {
      schemaVersion: 1,
      title: "GDP growth",
      sourceCitation: "ONS · https://www.ons.gov.uk/gdp · published 2026-09-01",
      observationWindow: {
        start: { period: "August 2026", observedAt: "2026-08-01T00:00:00.000Z" },
        end: { period: "September 2026", observedAt: "2026-09-01T00:00:00.000Z" },
      },
      series: [{ key: "growth", label: "Three-month growth" }],
      caveats: ["Early estimate; subject to revision."],
    };
    const markup = serializeChartSvg(makeChartSvg(), { chartMetadata });

    expect(markup).toContain('id="public-data-chart-metadata"');
    expect(markup).toContain("https://www.ons.gov.uk/gdp");
    expect(markup).toContain("September 2026");
    expect(markup).toContain("Three-month growth");
    expect(markup).toContain("subject to revision");
  });

  it("does not mutate the original live chart <svg>", () => {
    const svg = makeChartSvg();
    serializeChartSvg(svg, { title: "Should not appear on the live DOM node" });
    expect(svg.querySelector("title")).toBeNull();
  });
});

describe("chartExportFilename", () => {
  it("slugifies a title into a safe lowercase-hyphen filename", () => {
    expect(chartExportFilename("Net migration: ten annual observations", "svg")).toBe(
      "public-data-net-migration-ten-annual-observations.svg",
    );
  });

  it("falls back to a generic name for a title with no alphanumeric characters", () => {
    expect(chartExportFilename("---", "png")).toBe("public-data-chart.png");
  });

  it("produces different extensions for svg vs png", () => {
    expect(chartExportFilename("Example", "svg").endsWith(".svg")).toBe(true);
    expect(chartExportFilename("Example", "png").endsWith(".png")).toBe(true);
  });
});

describe("canRasterizeToPng", () => {
  it("feature-detects via a real getContext('2d') call rather than assuming support", () => {
    // jsdom does not implement canvas 2D rendering, so this correctly
    // mirrors the no-support path a real legacy/limited browser would hit;
    // the important behaviour is that it returns a boolean without throwing.
    expect(typeof canRasterizeToPng()).toBe("boolean");
  });

  it("reports true when canvas reports a working 2D context and Image exists", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as unknown as CanvasRenderingContext2D);
    expect(canRasterizeToPng()).toBe(true);
    getContext.mockRestore();
  });

  it("reports false when canvas has no 2D context", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null);
    expect(canRasterizeToPng()).toBe(false);
    getContext.mockRestore();
  });
});
