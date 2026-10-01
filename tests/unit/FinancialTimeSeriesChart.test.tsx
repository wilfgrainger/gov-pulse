import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";

afterEach(() => {
  cleanup();
});

const data = [
  { observedAt: Date.UTC(2024, 0, 1), period: "January 2024", value: 10 },
  { observedAt: Date.UTC(2024, 1, 1), period: "February 2024", value: 20 },
  { observedAt: Date.UTC(2024, 2, 1), period: "March 2024", value: 30 },
];

const series = [{ key: "value", label: "Example measure", color: "#111827" }];

function renderChart() {
  return render(
    <FinancialTimeSeriesChart
      title="Example chart"
      description="Example description"
      data={data}
      series={series}
      valueFormatter={(value) => `${value} units`}
      showEvents={false}
    />,
  );
}

function getLiveRegion() {
  const region = document.querySelector('[aria-live="polite"]');
  if (!region) throw new Error("aria-live region not found");
  return region;
}

describe("FinancialTimeSeriesChart keyboard scrubber", () => {
  it("is focusable and exposes keyboard instructions in its accessible name", () => {
    renderChart();
    const chart = screen.getByRole("group", { name: /Example chart/i });
    expect(chart).toHaveAttribute("tabindex", "0");
    expect(chart.getAttribute("aria-label")).toMatch(/left and right arrow keys to scrub/i);
  });

  it("announces the first point via aria-live on ArrowRight from a focused, unscrubbed chart", () => {
    renderChart();
    const chart = screen.getByRole("group", { name: /Example chart/i });
    chart.focus();
    fireEvent.keyDown(chart, { key: "ArrowRight" });

    const live = getLiveRegion();
    expect(live).toHaveTextContent(/January 2024/);
    expect(live).toHaveTextContent(/Example measure 10 units/);
  });

  it("moves forward and backward through points with ArrowRight/ArrowLeft", () => {
    renderChart();
    const chart = screen.getByRole("group", { name: /Example chart/i });
    chart.focus();
    fireEvent.keyDown(chart, { key: "ArrowRight" }); // -> Jan
    fireEvent.keyDown(chart, { key: "ArrowRight" }); // -> Feb
    expect(getLiveRegion()).toHaveTextContent(/February 2024/);
    expect(getLiveRegion()).toHaveTextContent(/20 units/);

    fireEvent.keyDown(chart, { key: "ArrowLeft" }); // -> Jan
    expect(getLiveRegion()).toHaveTextContent(/January 2024/);
  });

  it("does not move past the first or last point", () => {
    renderChart();
    const chart = screen.getByRole("group", { name: /Example chart/i });
    chart.focus();
    fireEvent.keyDown(chart, { key: "End" });
    expect(getLiveRegion()).toHaveTextContent(/March 2024/);
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(getLiveRegion()).toHaveTextContent(/March 2024/);

    fireEvent.keyDown(chart, { key: "Home" });
    expect(getLiveRegion()).toHaveTextContent(/January 2024/);
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(getLiveRegion()).toHaveTextContent(/January 2024/);
  });

  it("clears the scrub readout on Escape", () => {
    renderChart();
    const chart = screen.getByRole("group", { name: /Example chart/i });
    chart.focus();
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(getLiveRegion()).toHaveTextContent(/January 2024/);

    fireEvent.keyDown(chart, { key: "Escape" });
    expect(getLiveRegion()).toHaveTextContent("");
  });

  it("renders a visible, non-aria-hidden-only readout alongside the aria-live announcement", () => {
    renderChart();
    const chart = screen.getByRole("group", { name: /Example chart/i });
    chart.focus();
    fireEvent.keyDown(chart, { key: "ArrowRight" });

    const visibleReadout = document.querySelector('p[aria-hidden="true"]');
    expect(visibleReadout).not.toBeNull();
    expect(visibleReadout).toHaveTextContent(/January 2024/);
    expect(visibleReadout).toHaveTextContent(/Example measure: 10 units/);
  });
});
