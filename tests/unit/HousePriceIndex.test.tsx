import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HousePriceIndex from "@/app/components/HousePriceIndex";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const current = {
  headline: {
    period: "Jul 2026",
    observedAt: Date.UTC(2026, 6, 31),
    releaseDate: "2026-09-16",
    avgPriceGbp: 273_000,
    changePercent: 1.4,
    previousPeriod: "Jun 2026",
    previousChangePercent: 1.5,
  },
  history: [
    { period: "Jun 2026", observedAt: Date.UTC(2026, 5, 30), hpiChangePercent: 1.5 },
    { period: "Jul 2026", observedAt: Date.UTC(2026, 6, 31), hpiChangePercent: 1.4 },
  ],
  methodology: {
    measure: "UK House Price Index (HPI), average house price annual percentage change",
    status: "Official statistics",
    revisionNote: "UK HPI first estimates are provisional and subject to revision as later transaction data is incorporated.",
  },
  source: {
    edition: "september2026",
    bulletinUrl: "https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026",
    historyUrl: "https://www.ons.gov.uk/visualisations/test/fig01/data.csv",
  },
};

function metricResult(data: unknown) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date("2026-09-16T08:00:00Z"),
    source: "worker",
    cacheState: "fresh",
  };
}

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
});

describe("HousePriceIndex evidence integrity", () => {
  it("leads with the latest reconciled ONS estimate and complete editorial contract", () => {
    useMetrics.mockReturnValue(metricResult(current));

    render(<HousePriceIndex />);

    expect(
      screen.getByRole("heading", {
        name: "The average UK house price rose to £273,000 in the 12 months to Jul 2026.",
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText("£273,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.4%").length).toBeGreaterThan(0);
    expect(screen.getByText((_, element) => element?.tagName === "P" && /1\.5% recorded in the 12 months to Jun 2026/i.test(element.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getAllByText(/Published 16 September 2026/i).length).toBeGreaterThan(1);
    expect(screen.getByText("Average price and annual change")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why it matters" })).toBeInTheDocument();
    expect(screen.getByText("Explain this number")).toBeInTheDocument();
    expect(screen.getByText("Important caveat")).toBeInTheDocument();
    expect(screen.getByText("Source and date")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ONS Private rent and house prices, UK bulletin" })
    ).toHaveAttribute("href", current.source.bulletinUrl);
  });

  it("renders a release note computed from the headline and history, not free-form prose", () => {
    useMetrics.mockReturnValue(metricResult(current));

    render(<HousePriceIndex />);

    const note = screen.getByTestId("release-note");
    expect(note).toHaveTextContent("Release note");
    expect(note).toHaveTextContent(/Annual house price change fell to 1\.4%, a change of -\d+(\.\d+)?% from the prior comparable period\./);
  });

  it("describes a decline without stale rise language", () => {
    useMetrics.mockReturnValue(
      metricResult({
        ...current,
        headline: {
          ...current.headline,
          period: "Aug 2026",
          observedAt: Date.UTC(2026, 7, 31),
          releaseDate: "2026-10-16",
          avgPriceGbp: 270_000,
          changePercent: -0.5,
          previousPeriod: "Jul 2026",
          previousChangePercent: 1.4,
        },
      })
    );

    render(<HousePriceIndex />);

    expect(
      screen.getByRole("heading", {
        name: "The average UK house price fell to £270,000 in the 12 months to Aug 2026.",
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/rose to £270,000/i)).not.toBeInTheDocument();
  });

  it("shows no house price value when the live feed is unavailable", () => {
    useMetrics.mockReturnValue({
      ...metricResult(current),
      isLive: false,
      lastUpdated: null,
      source: "fallback",
      cacheState: null,
    });

    render(<HousePriceIndex />);

    expect(screen.getByRole("status")).toHaveTextContent("House price estimate unavailable");
    expect(screen.queryByText(/The average UK house price rose to £273,000/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("release-note")).not.toBeInTheDocument();
  });

  it("does not fill unmatched wage periods or headline values with estimated numbers", () => {
    useMetrics
      .mockReturnValueOnce(metricResult(current))
      .mockReturnValueOnce({ ...metricResult({
        headline: { regularPayRealGrowthPercent: 2.1, period: "May to July 2026" },
        history: [{ period: "May to July 2026", regularPayRealGrowthPercent: 2.1 }],
      }), cacheState: "stale" });

    render(<HousePriceIndex />);

    fireEvent.click(screen.getByRole("button", { name: "View screen-reader table" }));
    const rows = within(screen.getByRole("table", { name: /historical comparison table/i })).getAllByRole("row");
    expect(rows).toHaveLength(3);
    for (const row of rows.slice(1)) {
      expect(within(row).getAllByText("Unavailable")).toHaveLength(2);
    }
  });

  it.each([
    ["non-positive average price", { ...current.headline, avgPriceGbp: 0 }],
    ["invalid release date", { ...current.headline, releaseDate: "not-a-date" }],
    ["missing period", { ...current.headline, period: "" }],
  ])("fails closed for %s", (_label, headline) => {
    useMetrics.mockReturnValue(
      metricResult({
        ...current,
        headline,
      })
    );

    render(<HousePriceIndex />);

    expect(screen.getByRole("status")).toHaveTextContent("House price estimate unavailable");
    expect(screen.queryByText(/The average UK house price (rose|fell)/)).not.toBeInTheDocument();
    expect(screen.queryByText("Explain this number")).not.toBeInTheDocument();
  });

  it("fails closed when the payload is absent or stale", () => {
    useMetrics.mockReturnValue({
      ...metricResult(null),
      cacheState: "stale",
    });

    render(<HousePriceIndex />);

    expect(screen.getByRole("status")).toHaveTextContent("House price estimate unavailable");
  });
});
