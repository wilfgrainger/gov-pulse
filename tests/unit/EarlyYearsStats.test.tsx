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
    mmrPeriod: "2024/25",
    mmrObservedAt: Date.UTC(2025, 2, 31),
    mmrRate: 88.9,
    mmrDelta: 0,
    schoolReadyPeriod: "2024/25",
    schoolReadyObservedAt: Date.UTC(2025, 7, 31),
    schoolReadyRate: 68.3,
    schoolReadyDelta: 0.6,
  },
  history: [
    { mmrPeriod: "2023/24", mmrObservedAt: 1711843200000, mmrRate: 88.9, schoolReadyPeriod: "2023/24", schoolReadyObservedAt: 1725062400000, schoolReadyRate: 67.7 },
    { mmrPeriod: "2024/25", mmrObservedAt: Date.UTC(2025, 2, 31), mmrRate: 88.9, schoolReadyPeriod: "2024/25", schoolReadyObservedAt: Date.UTC(2025, 7, 31), schoolReadyRate: 68.3 },
  ],
  source: {
    mmrPublisher: "UK Health Security Agency",
    mmrEditionId: "ukhsa-cover-2024-25",
    mmrUrl: "https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-annual-reports/vaccination-coverage-statistics-for-children-aged-up-to-5-years-england-cover-programme-report-april-2024-to-march-2025",
    mmrPublicationDate: "2025-08-28",
    mmrValidUntil: "2026-11-30T00:00:00.000Z",
    schoolReadyPublisher: "Department for Education",
    schoolReadyEditionId: "dfe-eyfsp-2024-25",
    schoolReadyUrl: "https://explore-education-statistics.service.gov.uk/find-statistics/early-years-foundation-stage-profile-results/2024-25",
    schoolReadyPublicationDate: "2025-11-27",
    schoolReadyValidUntil: "2026-11-30T00:00:00.000Z",
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
      source: "worker",
      cacheState: null,
    });

    render(<EarlyYearsStats />);

    expect(screen.getAllByText("88.9%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("68.3%").length).toBeGreaterThan(0);
    expect(screen.getByText(/England MMR vaccination coverage was unchanged at 88.9%/i)).toBeInTheDocument();
    expect(screen.getByText("Why it matters")).toBeInTheDocument();
    expect(screen.getByText("Explain this number")).toBeInTheDocument();
    expect(screen.getByText("Important caveat")).toBeInTheDocument();
    expect(screen.getByText("Source and date")).toBeInTheDocument();
    expect(screen.getByText(/UK Health Security Agency published 28 Aug 2025/)).toBeInTheDocument();
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

  it("does not call a checked-in old edition current when no live publication record exists", () => {
    useMetrics.mockReturnValue({
      data: currentEarlyYears,
      isLive: false,
      lastUpdated: null,
      source: "fallback",
      cacheState: null,
    });

    render(<EarlyYearsStats />);

    expect(screen.getByRole("status")).toHaveTextContent("Early years data unavailable");
    expect(screen.queryByText("88.9%")).not.toBeInTheDocument();
  });

  it("rejects unsupported publisher identities and out-of-range rates", () => {
    for (const data of [
      { ...currentEarlyYears, source: { ...currentEarlyYears.source, mmrPublisher: "Unknown source" } },
      { ...currentEarlyYears, headline: { ...currentEarlyYears.headline, schoolReadyRate: 108 } },
    ]) {
      useMetrics.mockReturnValue({ data, isLive: true, lastUpdated: new Date(), source: "worker", cacheState: "fresh" });
      const { unmount } = render(<EarlyYearsStats />);
      expect(screen.getByRole("status")).toHaveTextContent("Early years data unavailable");
      unmount();
      useMetrics.mockClear();
    }
  });
});
