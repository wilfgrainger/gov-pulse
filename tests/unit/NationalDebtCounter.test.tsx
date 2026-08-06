import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NationalDebtCounter from "@/app/components/NationalDebtCounter";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const currentDebt = {
  baseDebt: 2_984_300_000_000,
  baseDate: new Date("2026-05-31T00:00:00Z").getTime(),
  debtToGdp: 95.1,
  observationPeriod: "2026 MAY",
  publicationDate: "2026-06-19",
  annualDelta: { debtBillion: 174.3, debtToGdpPoints: 2.1 },
  history: Array.from({ length: 13 }, (_, index) => ({
    period: index === 12 ? "2026 MAY" : `Month ${index + 1}`,
    observedAt: index === 12 ? Date.UTC(2026, 5, 0) : Date.UTC(2025, index + 1, 0),
    debtBillion: index === 12 ? 2984.3 : 2810,
    debtToGdp: index === 12 ? 95.1 : 93,
  })),
  revisionStatus:
    "Public-sector-finance estimates can be revised as source data and classifications are updated.",
  source: {
    publisher: "Office for National Statistics",
    debtUrl:
      "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6w/pusf",
    debtToGdpUrl:
      "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/timeseries/hf6x/pusf",
  },
  series: {
    debt: "HF6W",
    debtToGdp: "HF6X",
  },
};

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
});

describe("NationalDebtCounter evidence integrity", () => {
  it("renders the dated ONS debt stock with the complete editorial contract", () => {
    useMetrics.mockReturnValue({
      data: currentDebt,
      isLive: true,
      lastUpdated: new Date("2026-06-19T06:00:00Z"),
      source: "worker",
      cacheState: "fresh",
    });

    render(<NationalDebtCounter />);

    expect(screen.getByText("£2,984,300,000,000")).toBeInTheDocument();
    expect(screen.getAllByText(/ons monthly observation for may 2026/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/equivalent to 95.1% of gdp/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/published 19 june 2026/i).length).toBeGreaterThan(1);
    expect(screen.getByText("What changed?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why it matters" })).toBeInTheDocument();
    expect(screen.getByText("Explain this number")).toBeInTheDocument();
    expect(screen.getByText("Important caveat")).toBeInTheDocument();
    expect(screen.getByText("Source and date")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ONS HF6W public sector net debt series" })
    ).toHaveAttribute("href", currentDebt.source.debtUrl);
    expect(screen.getByText(/not a real-time counter/i)).toBeInTheDocument();
    expect(screen.queryByText(/growth \/ sec/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/debt per person/i)).not.toBeInTheDocument();
  });

  it("rejects coerced numeric values or missing publication provenance", () => {
    useMetrics.mockReturnValue({
      data: {
        ...currentDebt,
        baseDebt: "2984300000000",
        publicationDate: "",
      },
      isLive: true,
      lastUpdated: new Date("2026-06-19T06:00:00Z"),
      source: "worker",
      cacheState: "fresh",
    });

    render(<NationalDebtCounter />);

    expect(screen.getByRole("status")).toHaveTextContent("Debt observation unavailable");
  });

  it("fails closed when the observation is unavailable or stale", () => {
    useMetrics.mockReturnValue({
      data: currentDebt,
      isLive: true,
      lastUpdated: new Date("2026-06-19T06:00:00Z"),
      source: "worker",
      cacheState: "stale",
    });

    render(<NationalDebtCounter />);

    expect(screen.getByRole("status")).toHaveTextContent("Debt observation unavailable");
    expect(screen.queryByText(/£2,984/)).not.toBeInTheDocument();
  });
});
