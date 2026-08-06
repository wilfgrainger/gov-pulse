import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EarlyYearsStats from "@/app/components/EarlyYearsStats";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const currentEarlyYears = {
  available: true,
  headline: {
    period: "2024/25",
    mmrPeriod: "2024/25",
    schoolReadyPeriod: "2024/25",
    mmrRate: 88.9,
    mmrDelta: 0.0,
    schoolReadyRate: 68.3,
    schoolReadyDelta: 0.6,
  },
  history: [
    { period: "2023/24", observedAt: 1711843200000, mmrRate: 88.9, schoolReadyRate: 67.7 },
    { period: "2024/25", observedAt: 1743379200000, mmrRate: 88.9, schoolReadyRate: 68.3 },
  ],
  source: {
    mmrUrl: "https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-annual-reports/vaccination-coverage-statistics-for-children-aged-up-to-5-years-england-cover-programme-report-april-2024-to-march-2025",
    mmrPublicationDate: "2025-08-28",
    schoolReadyUrl: "https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/2024-25",
    schoolReadyPublicationDate: "2025-11-27",
  }
};

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
});

describe("EarlyYearsStats evidence integrity", () => {
  it("renders the child vaccination and school readiness metrics with the editorial contract", () => {
    useMetrics.mockReturnValue({
      data: currentEarlyYears,
      isLive: true,
      lastUpdated: new Date("2025-09-18T00:00:00Z"),
      source: "fallback",
      cacheState: null,
    });

    render(<EarlyYearsStats />);

    expect(screen.getByText("88.9%")).toBeInTheDocument();
    expect(screen.getByText("68.3%")).toBeInTheDocument();
    expect(screen.getByText(/england child mmr vaccination rate fell to 88.9%/i)).toBeInTheDocument();
    expect(screen.getByText("Why it matters")).toBeInTheDocument();
    expect(screen.getByText("Explain this number")).toBeInTheDocument();
    expect(screen.getByText("Important caveat")).toBeInTheDocument();
    expect(screen.getByText("Source and date")).toBeInTheDocument();
    expect(screen.getByText(/UKHSA published 28 Aug 2025/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download full verified snapshot (JSON)" })).toHaveAttribute(
      "href",
      "/data/metrics-snapshot.json",
    );
  });

  it("fails closed when the data is not available", () => {
    useMetrics.mockReturnValue({
      data: {
        ...currentEarlyYears,
        available: false,
      },
      isLive: false,
      lastUpdated: null,
      source: "fallback",
      cacheState: null,
    });

    render(<EarlyYearsStats />);

    expect(screen.getByRole("status")).toHaveTextContent("Early years data unavailable");
  });
});
