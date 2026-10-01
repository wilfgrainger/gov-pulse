import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GDPTracker from "@/app/components/GDPTracker";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

function historyPoint(monthOffset: number, monthlyGrowth: number) {
  return {
    period: `Month ${monthOffset}`,
    observedAt: Date.UTC(2025, monthOffset, 1),
    index: 100 + monthOffset,
    monthlyGrowth,
    threeMonthGrowth: 0.3,
    annualGrowth: 1.1,
  };
}

const current = {
  available: true,
  headline: {
    period: "March 2026",
    observedAt: Date.UTC(2026, 2, 1),
    releaseDate: "2026-05-14",
    monthlyGrowth: 0.2,
    threeMonthGrowth: 0.3,
    annualGrowth: 1.1,
  },
  history: [
    ...Array.from({ length: 11 }, (_, index) => historyPoint(index, 0.1)),
    historyPoint(11, 0.1),
    historyPoint(12, 0.2),
  ],
  methodology: {
    measure: "Monthly chained-volume real GDP index",
    status: "Official statistics",
    revisionNote: "Monthly GDP is an early estimate and can be revised.",
  },
  source: {
    bulletinUrl: "https://www.ons.gov.uk/gdp/bulletin",
    landingUrl: "https://www.ons.gov.uk/gdp",
  },
};

function metricResult(data: unknown) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date("2026-05-14T08:00:00Z"),
    source: "worker",
    cacheState: "fresh",
  };
}

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
});

describe("GDPTracker release note", () => {
  it("renders a release note computed from the monthly-growth history, not free-form prose", () => {
    useMetrics.mockReturnValue(metricResult(current));

    render(<GDPTracker />);

    const note = screen.getByTestId("release-note");
    expect(note).toHaveTextContent("Release note");
    expect(note).toHaveTextContent(/Monthly GDP growth rose to \+0\.2%, a change of \+100\.0% from the prior comparable period\./);
    expect(note).not.toHaveTextContent("provisional");
  });

  it("shows no release note when the current GDP release is unavailable", () => {
    useMetrics.mockReturnValue(metricResult({ ...current, available: false }));

    render(<GDPTracker />);

    expect(screen.getByRole("status")).toHaveTextContent("Current GDP estimate unavailable");
    expect(screen.queryByTestId("release-note")).not.toBeInTheDocument();
  });
});
