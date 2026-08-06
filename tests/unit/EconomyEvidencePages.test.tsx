import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GDPTracker from "@/app/components/GDPTracker";
import EmploymentStats from "@/app/components/EmploymentStats";
import TaxRevenue from "@/app/components/TaxRevenue";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: (...args: unknown[]) => useMetrics(...args),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const points = Array.from({ length: 13 }, (_, index) => ({
  period: `Month ${index + 1}`,
  observedAt: Date.UTC(2025, 4 + index, 0),
}));

function result(data: unknown) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date("2026-07-16T08:00:00Z"),
    source: "worker",
    cacheState: "fresh",
    observationPeriod: null,
    observationStatus: "current",
    observedAt: null,
  };
}

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
});

describe("economy evidence pages", () => {
  it("renders the current GDP release without forecasts or G7 claims", () => {
    useMetrics.mockReturnValue(
      result({
        available: true,
        headline: {
          period: "May 2026",
          observedAt: Date.UTC(2026, 5, 0),
          releaseDate: "2026-07-10",
          monthlyGrowth: 0.1,
          threeMonthGrowth: 0.5,
          annualGrowth: 1.3,
        },
        history: points.map((point) => ({
          ...point,
          index: 103.2,
          monthlyGrowth: 0.1,
          threeMonthGrowth: 0.5,
          annualGrowth: 1.3,
        })),
        methodology: {
          measure: "Real gross domestic product, seasonally adjusted",
          status: "Official statistics",
          revisionNote: "This estimate can be revised.",
        },
        source: {
          bulletinUrl: "https://www.ons.gov.uk/gdp/may2026",
          landingUrl: "https://www.ons.gov.uk/gdp",
        },
      })
    );

    render(<GDPTracker />);

    expect(screen.getByRole("heading", { name: "UK GDP grew in May 2026 by 0.1%." })).toBeInTheDocument();
    expect(screen.getByText(/Across the latest three months, real GDP grew by 0.5%/i)).toBeInTheDocument();
    expect(screen.getByText(/Forecast and comparison tables withdrawn/i)).toBeInTheDocument();
    expect(screen.queryByText(/2025 forecast/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/G7 comparison/i)).not.toBeInTheDocument();
  });

  it("fails closed when GDP is unavailable", () => {
    useMetrics.mockImplementation((_section: string, fallback: unknown) => result(fallback));
    render(<GDPTracker />);
    expect(screen.getByRole("status")).toHaveTextContent("Current GDP estimate unavailable");
  });

  it("renders aligned labour-market periods and withdraws workforce mixes", () => {
    useMetrics.mockReturnValue(
      result({
        available: true,
        headline: {
          period: "March to May 2026",
          observedAt: Date.UTC(2026, 5, 0),
          releaseDate: "2026-07-16",
          employmentRate: 75.1,
          unemploymentRate: 5.2,
          inactivityRate: 21,
          vacancies: 721000,
          vacanciesPeriod: "April to June 2026",
        },
        annualDelta: {
          employmentRatePoints: 0.3,
          unemploymentRatePoints: 0.4,
          inactivityRatePoints: -0.4,
          vacancies: -39_000,
        },
        history: {
          labourForce: points.map((point) => ({
            ...point,
            employmentRate: 75.1,
            unemploymentRate: 5.2,
            inactivityRate: 21,
          })),
          vacancies: points.map((point) => ({ ...point, vacancies: 721_000 })),
        },
        methodology: {
          status: "Official statistics",
          caveat: "Rolling estimates carry sampling uncertainty.",
        },
        source: {
          bulletinUrl: "https://www.ons.gov.uk/labour/july2026",
          landingUrl: "https://www.ons.gov.uk/labour",
        },
      })
    );

    render(<EmploymentStats />);

    expect(
      screen.getByRole("heading", {
        name: "Employment was 75.1% and unemployment was 5.2%.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("721,000")).toBeInTheDocument();
    expect(screen.getAllByText("April to June 2026").length).toBeGreaterThan(1);
    expect(
      screen.getByRole("heading", {
        name: "Freshness and provenance for each labour-market series",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Employment, unemployment and inactivity rates")).toBeInTheDocument();
    expect(screen.getAllByText("Vacancies").length).toBeGreaterThan(1);
    expect(screen.getByText(/Workforce breakdowns withdrawn/i)).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE VS PUBLIC/i)).not.toBeInTheDocument();
  });

  it("fails closed when the labour payload is incomplete", () => {
    useMetrics.mockReturnValue(
      result({
        available: true,
        headline: {
          period: "March to May 2026",
          observedAt: Date.UTC(2026, 5, 0),
          releaseDate: "2026-07-16",
          employmentRate: 75.1,
        },
        methodology: { status: "", caveat: "" },
        source: { bulletinUrl: "", landingUrl: "" },
      })
    );
    render(<EmploymentStats />);
    expect(screen.getByRole("status")).toHaveTextContent("Current labour-market release unavailable");
  });

  it("renders one official receipts measure and withdraws tax forecasts", () => {
    useMetrics.mockReturnValue(
      result({
        available: true,
        headline: {
          period: "May 2026",
          observedAt: Date.UTC(2026, 5, 0),
          releaseDate: "2026-06-19",
          receiptsBillion: 93.7,
          yearChangeBillion: 8.2,
        },
        history: points.map((point) => ({ ...point, receiptsBillion: 93.7 })),
        methodology: {
          measure: "Central government receipts",
          status: "Official statistics",
          caveat: "This is not a tax-burden forecast.",
        },
        source: {
          bulletinUrl: "https://www.ons.gov.uk/finances/may2026",
          landingUrl: "https://www.ons.gov.uk/finances",
        },
      })
    );

    render(<TaxRevenue />);

    expect(
      screen.getByRole("heading", {
        name: "Central government receipts were £93.7bn in May 2026.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/£8.2bn more than in the comparable month/i)).toBeInTheDocument();
    expect(screen.getByText(/Tax breakdown and burden forecast withdrawn/i)).toBeInTheDocument();
    expect(screen.queryByText("Income Tax")).not.toBeInTheDocument();
    expect(screen.queryByText("37.7%")).not.toBeInTheDocument();
  });

  it("fails closed when receipts evidence is unavailable", () => {
    useMetrics.mockImplementation((_section: string, fallback: unknown) => result(fallback));
    render(<TaxRevenue />);
    expect(screen.getByRole("status")).toHaveTextContent("Current receipts estimate unavailable");
  });
});
