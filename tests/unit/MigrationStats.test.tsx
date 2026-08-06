import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MigrationStats from "@/app/components/MigrationStats";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const current = {
  headline: {
    period: "YE December 2025",
    observedAt: Date.UTC(2026, 0, 0),
    releaseDate: "2026-05-21",
    netMigration: 171_000,
    immigration: 813_000,
    emigration: 642_000,
    previousPeriod: "YE December 2024",
    previousNetMigration: 331_000,
    changePercent: -48,
    provisional: true,
  },
  comparison: [
    { period: "YE December 2024", netMigration: 331_000 },
    { period: "YE December 2025", netMigration: 171_000 },
  ],
  history: [
    { period: "YE December 2024", observedAt: Date.UTC(2025, 0, 0), immigration: 950_000, emigration: 619_000, netMigration: 331_000 },
    { period: "YE December 2025", observedAt: Date.UTC(2026, 0, 0), immigration: 813_000, emigration: 642_000, netMigration: 171_000 },
  ],
  annualDelta: {
    immigration: -137_000,
    emigration: 23_000,
    netMigration: -160_000,
  },
  methodology: {
    definition: "People moving to or from the UK for 12 months or more",
    status: "Official statistics in development",
    revisionNote: "The newest estimates are provisional and may be revised.",
  },
  source: {
    edition: "yearendingdecember2025",
    bulletinUrl: "https://www.ons.gov.uk/migration/yearendingdecember2025",
    datasetUrl: "https://www.ons.gov.uk/migration/dataset",
    historyUrl: "https://www.ons.gov.uk/visualisations/test/fig02/data.csv",
  },
};

function metricResult(data: unknown) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date("2026-05-21T08:00:00Z"),
    source: "worker",
    cacheState: "fresh",
  };
}

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
});

describe("MigrationStats evidence integrity", () => {
  it("leads with the latest reconciled ONS estimate and complete editorial contract", () => {
    useMetrics.mockReturnValue(metricResult(current));

    render(<MigrationStats />);

    expect(
      screen.getByRole("heading", {
        name: "Net migration fell to 171,000 in the year ending December 2025.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("813,000")).toBeInTheDocument();
    expect(screen.getByText("642,000")).toBeInTheDocument();
    expect(screen.getAllByText("171,000").length).toBeGreaterThan(0);
    expect(screen.getByText(/48% lower than the updated YE December 2024/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Published 21 May 2026/i).length).toBeGreaterThan(1);
    expect(screen.getByText("What changed?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why it matters" })).toBeInTheDocument();
    expect(screen.getByText("Explain this number")).toBeInTheDocument();
    expect(screen.getByText("Important caveat")).toBeInTheDocument();
    expect(screen.getByText("Source and date")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ONS long-term international migration bulletin" })
    ).toHaveAttribute("href", current.source.bulletinUrl);
  });

  it("describes a future increase without stale fall language", () => {
    useMetrics.mockReturnValue(
      metricResult({
        ...current,
        headline: {
          ...current.headline,
          period: "YE June 2026",
          observedAt: Date.UTC(2026, 6, 0),
          releaseDate: "2026-11-20",
          netMigration: 200_000,
          immigration: 850_000,
          emigration: 650_000,
          previousPeriod: "YE June 2025",
          previousNetMigration: 180_000,
          changePercent: 11,
        },
        comparison: [
          { period: "YE June 2025", netMigration: 180_000 },
          { period: "YE June 2026", netMigration: 200_000 },
        ],
      })
    );

    render(<MigrationStats />);

    expect(
      screen.getByRole("heading", {
        name: "Net migration rose to 200,000 in the year ending June 2026.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/11% higher than the updated YE June 2025/i)).toBeInTheDocument();
    expect(screen.queryByText(/sharp year-on-year fall/i)).not.toBeInTheDocument();
  });

  it("shows no migration value when the live feed is unavailable", () => {
    useMetrics.mockReturnValue({
      ...metricResult(current),
      isLive: false,
      lastUpdated: null,
      source: "fallback",
      cacheState: null,
    });

    render(<MigrationStats />);

    expect(screen.getByRole("status")).toHaveTextContent("Migration estimate unavailable");
    expect(screen.queryByText(/Net migration fell to 171,000/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visa and nationality tables withdrawn" })).toBeInTheDocument();
    expect(screen.getByText(/mixed Home Office visa grants with ONS long-term migration estimates/i)).toBeInTheDocument();
    expect(screen.queryByText("BY VISA TYPE")).not.toBeInTheDocument();
    expect(screen.queryByText("TOP ORIGINS")).not.toBeInTheDocument();
  });

  it.each([
    ["arithmetic mismatch", { ...current.headline, emigration: 600_000 }],
    ["missing comparison baseline", { ...current.headline, previousNetMigration: Number.NaN }],
    ["invalid release date", { ...current.headline, releaseDate: "not-a-date" }],
  ])("fails closed for %s", (_label, headline) => {
    useMetrics.mockReturnValue(
      metricResult({
        ...current,
        headline,
      })
    );

    render(<MigrationStats />);

    expect(screen.getByRole("status")).toHaveTextContent("Migration estimate unavailable");
    expect(screen.queryByText(/Net migration (fell|rose)/)).not.toBeInTheDocument();
    expect(screen.queryByText("Explain this number")).not.toBeInTheDocument();
  });

  it("fails closed when the payload is absent or stale", () => {
    useMetrics.mockReturnValue({
      ...metricResult(null),
      cacheState: "stale",
    });

    render(<MigrationStats />);

    expect(screen.getByRole("status")).toHaveTextContent("Migration estimate unavailable");
  });
});
