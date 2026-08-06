import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TaxRevenue from "@/app/components/TaxRevenue";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: (...args: unknown[]) => useMetrics(...args),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

function mockMetricsResult() {
  return {
    data: {
      available: true,
      headline: {
        period: "May 2026",
        observedAt: Date.UTC(2026, 5, 0),
        releaseDate: "2026-06-19",
        receiptsBillion: 93.7,
        yearChangeBillion: 8.2,
      },
      history: Array.from({ length: 13 }, (_, index) => ({
        period: `Month ${index + 1}`,
        observedAt: Date.UTC(2025, 4 + index, 0),
        receiptsBillion: 93.7,
      })),
      methodology: {
        measure: "Central government receipts",
        status: "Official statistics",
        caveat: "This is not a tax-burden forecast.",
      },
      source: {
        bulletinUrl: "https://www.ons.gov.uk/finances/may2026",
        landingUrl: "https://www.ons.gov.uk/finances",
      },
    },
    isLive: true,
    lastUpdated: new Date("2026-07-16T08:00:00Z"),
    source: "worker",
    cacheState: "fresh",
    observationPeriod: null,
    observationStatus: "current",
  };
}

describe("TaxRevenue Procurement & Spend Explorer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows ONS Receipts by default and shows unavailable notice for other tabs", () => {
    useMetrics.mockReturnValue(mockMetricsResult());
    render(<TaxRevenue />);

    // Default tab is ONS Receipts
    expect(screen.getByText("Central government receipts were £93.7bn in May 2026.")).toBeInTheDocument();

    // Click Spending by Sector tab
    const spendingTab = screen.getByRole("button", { name: /Spending by Sector/i });
    fireEvent.click(spendingTab);

    // Verify spending content is withheld/unavailable
    expect(screen.getByText("Procurement and spending data unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Government Spend by Sector and Department")).not.toBeInTheDocument();

    // Click Top 50 Contracts tab
    const contractsTab = screen.getByRole("button", { name: /Top 50 Contracts/i });
    fireEvent.click(contractsTab);

    // Verify contracts content is withheld/unavailable
    expect(screen.getByText("Procurement and spending data unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Top 50 Government Contracts Awarded (Last 12 Months)")).not.toBeInTheDocument();

    // Click Largest Outsourcers tab
    const outsourcersTab = screen.getByRole("button", { name: /Largest Outsourcers/i });
    fireEvent.click(outsourcersTab);

    // Verify outsourcers content is withheld/unavailable
    expect(screen.getByText("Procurement and spending data unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Largest Departmental Outsourcing Partners")).not.toBeInTheDocument();
  });
});
