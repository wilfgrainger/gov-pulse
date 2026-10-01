import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EmploymentStats from "@/app/components/EmploymentStats";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

function labourForcePoint(monthOffset: number, unemploymentRate: number) {
  return {
    period: `Period ${monthOffset}`,
    observedAt: Date.UTC(2025, monthOffset, 1),
    employmentRate: 75,
    unemploymentRate,
    inactivityRate: 21,
  };
}

function vacancyPoint(monthOffset: number) {
  return {
    period: `Period ${monthOffset}`,
    observedAt: Date.UTC(2025, monthOffset, 1),
    vacancies: 800_000,
  };
}

const current = {
  available: true,
  headline: {
    period: "Jan-Mar 2026",
    observedAt: Date.UTC(2026, 2, 1),
    releaseDate: "2026-05-14",
    employmentRate: 75.2,
    unemploymentRate: 4.5,
    inactivityRate: 21.1,
    vacancies: 820_000,
    vacanciesPeriod: "Feb-Apr 2026",
  },
  annualDelta: {
    employmentRatePoints: 0.3,
    unemploymentRatePoints: 0.2,
    inactivityRatePoints: -0.1,
    vacancies: -15_000,
  },
  history: {
    labourForce: [
      ...Array.from({ length: 11 }, (_, index) => labourForcePoint(index, 4.0)),
      labourForcePoint(11, 4.3),
      labourForcePoint(12, 4.5),
    ],
    vacancies: [
      ...Array.from({ length: 11 }, (_, index) => vacancyPoint(index)),
      vacancyPoint(11),
      vacancyPoint(12),
    ],
  },
  methodology: {
    status: "Official statistics",
    caveat: "Labour Force Survey estimates carry sampling uncertainty and may be revised.",
  },
  source: {
    bulletinUrl: "https://www.ons.gov.uk/employment/bulletin",
    landingUrl: "https://www.ons.gov.uk/employment",
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

describe("EmploymentStats release note", () => {
  it("renders a release note computed from the unemployment-rate history, not free-form prose", () => {
    useMetrics.mockReturnValue(metricResult(current));

    render(<EmploymentStats />);

    const note = screen.getByTestId("release-note");
    expect(note).toHaveTextContent("Release note");
    expect(note).toHaveTextContent(/The unemployment rate rose to 4\.5%, a change of \+4\.7% from the prior comparable period\./);
    expect(note).toHaveTextContent(/consecutive period of increase/);
  });

  it("shows no release note when the current labour-market release is unavailable", () => {
    useMetrics.mockReturnValue(metricResult({ ...current, available: false }));

    render(<EmploymentStats />);

    expect(screen.getByRole("status")).toHaveTextContent("Current labour-market release unavailable");
    expect(screen.queryByTestId("release-note")).not.toBeInTheDocument();
  });
});
