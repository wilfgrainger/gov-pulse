import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChartExportButtons from "@/app/components/ChartExportButtons";
import * as chartExport from "@/app/lib/chartExport";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function containerWithSvg() {
  const ref = createRef<HTMLDivElement>();
  const container = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  container.appendChild(svg);
  // @ts-expect-error -- assigning to a ref's current for a test double container.
  ref.current = container;
  return { ref, svg };
}

describe("ChartExportButtons", () => {
  it("renders an SVG download control wired to the chart container", () => {
    const { ref } = containerWithSvg();
    render(<ChartExportButtons containerRef={ref} title="Example chart" />);

    expect(screen.getByText("Download chart as image:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SVG" })).toBeInTheDocument();
  });

  it("renders a PNG control when canvas rasterisation is supported", async () => {
    vi.spyOn(chartExport, "canRasterizeToPng").mockReturnValue(true);
    const { ref } = containerWithSvg();
    render(<ChartExportButtons containerRef={ref} title="Example chart" />);

    expect(await screen.findByRole("button", { name: "PNG" })).toBeInTheDocument();
  });

  it("keeps PNG capability out of server-rendered markup until browser hydration", () => {
    vi.spyOn(chartExport, "canRasterizeToPng").mockReturnValue(true);
    const ref = createRef<HTMLDivElement>();

    const html = renderToString(<ChartExportButtons containerRef={ref} title="Example chart" />);

    expect(html).not.toContain(">PNG<");
  });

  it("omits the PNG control when canvas rasterisation is not supported", () => {
    vi.spyOn(chartExport, "canRasterizeToPng").mockReturnValue(false);
    const { ref } = containerWithSvg();
    render(<ChartExportButtons containerRef={ref} title="Example chart" />);

    expect(screen.queryByRole("button", { name: "PNG" })).not.toBeInTheDocument();
  });

  it("invokes the SVG downloader with the chart's live <svg> node on click", () => {
    const { ref, svg } = containerWithSvg();
    const spy = vi.spyOn(chartExport, "downloadChartSvg").mockImplementation(() => {});
    render(<ChartExportButtons containerRef={ref} title="Example chart" citation="Source: ONS" />);

    fireEvent.click(screen.getByRole("button", { name: "SVG" }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(svg);
    expect(spy.mock.calls[0][1]).toBe("public-data-example-chart.svg");
    expect(spy.mock.calls[0][2]).toEqual({ title: "Example chart", citation: "Source: ONS" });
  });

  it("shows a friendly message instead of throwing when the chart has no <svg> yet", () => {
    const ref = createRef<HTMLDivElement>();
    const emptyContainer = document.createElement("div");
    // @ts-expect-error -- assigning to a ref's current for a test double container.
    ref.current = emptyContainer;
    const spy = vi.spyOn(chartExport, "downloadChartSvg").mockImplementation(() => {});

    render(<ChartExportButtons containerRef={ref} title="Example chart" />);
    fireEvent.click(screen.getByRole("button", { name: "SVG" }));

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/not ready yet/i);
  });
});
