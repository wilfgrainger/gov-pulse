import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/ChartExportButtons", () => ({
  default: ({ citation, chartMetadata }: { citation: string; chartMetadata: unknown }) => <>
    <output data-testid="chart-citation">{citation}</output>
    <output data-testid="chart-metadata">{JSON.stringify(chartMetadata)}</output>
  </>,
}));

import FinancialTimeSeriesChart from "@/app/components/FinancialTimeSeriesChart";

afterEach(() => cleanup());

describe("FinancialTimeSeriesChart export citation", () => {
  it("carries the publisher citation, observation window, and chart caveat into the export control", () => {
    render(
      <FinancialTimeSeriesChart
        title="Example"
        description="Estimate subject to revision."
        citation="ONS · https://www.ons.gov.uk/example · published 2026-09-01 · September 2026"
        data={[
          { observedAt: Date.UTC(2026, 8, 1), period: "September 2026", value: 1 },
          { observedAt: Date.UTC(2026, 9, 1), period: "October 2026", value: 2 },
        ]}
        series={[{ key: "value", label: "Example measure", color: "#14243b" }]}
        valueFormatter={(value) => `${value}%`}
        showEvents={false}
      />,
    );

    expect(screen.getByTestId("chart-citation")).toHaveTextContent("ONS · https://www.ons.gov.uk/example");
    expect(screen.getByTestId("chart-citation")).toHaveTextContent("Observation period: September 2026 to October 2026");
    expect(screen.getByTestId("chart-citation")).toHaveTextContent("Estimate subject to revision.");
    expect(screen.getByTestId("chart-metadata")).toHaveTextContent('"schemaVersion":2');
    expect(screen.getByTestId("chart-metadata")).toHaveTextContent('"key":"value"');
    expect(screen.getByTestId("chart-metadata")).toHaveTextContent("https://www.ons.gov.uk/example");
    expect(screen.getByTestId("chart-metadata")).toHaveTextContent('"values":{"value":1}');
    expect(screen.getByTestId("chart-metadata")).toHaveTextContent('"observedAt":"2026-09-01T00:00:00.000Z"');
    expect(screen.getByTestId("chart-metadata")).toHaveTextContent("Estimate subject to revision.");
  });
});
