import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SentimentPulse from "@/app/components/SentimentPulse";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: (...args: unknown[]) => useMetrics(...args),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Panel evidence status</div>,
}));

vi.mock("@/app/components/ClientOnlyChart", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const retrievedAt = "2026-07-14T12:00:00.000Z";

const data = {
  available: true,
  order: ["inflation", "bankRate", "unemployment"],
  series: {
    inflation: {
      id: "inflation",
      label: "CPI inflation",
      shortLabel: "Inflation",
      value: 3.4,
      unit: "%",
      color: "#C92F00",
      period: "May 2026",
      observedAt: "2026-05-31T00:00:00.000Z",
      publishedAt: "2026-06-17T00:00:00.000Z",
      retrievedAt,
      publisher: "Office for National Statistics",
      sourceUrl: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23",
      seriesId: "D7G7",
      datasetId: "MM23",
      frequency: "Monthly",
      revisionStatus: "CPI may be revised.",
      evidenceClass: "official-data",
      status: "current",
      nextRelease: "2026-07-22",
      annualDelta: 0.6,
      annualDeltaUnit: "percentage points",
      history: [
        {
          period: "April 2026",
          observedAt: "2026-04-30T00:00:00.000Z",
          value: 2.8,
        },
        {
          period: "May 2026",
          observedAt: "2026-05-31T00:00:00.000Z",
          value: 3.4,
        },
      ],
    },
    bankRate: {
      id: "bankRate",
      label: "Official Bank Rate",
      shortLabel: "Bank Rate",
      value: 3.75,
      unit: "%",
      color: "#111111",
      period: "18 December 2025",
      observedAt: "2025-12-18T00:00:00.000Z",
      publishedAt: "2025-12-18T00:00:00.000Z",
      retrievedAt,
      publisher: "Bank of England",
      sourceUrl: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
      seriesId: "IUDBEDR",
      datasetId: "IADB",
      frequency: "Changed by Monetary Policy Committee decision",
      revisionStatus: "Bank Rate is event-dated.",
      evidenceClass: "official-data",
      status: "current",
      nextRelease: null,
      annualDelta: -1.25,
      annualDeltaUnit: "percentage points",
      history: [
        {
          period: "7 August 2025",
          observedAt: "2025-08-07T00:00:00.000Z",
          value: 4,
        },
        {
          period: "18 December 2025",
          observedAt: "2025-12-18T00:00:00.000Z",
          value: 3.75,
        },
      ],
    },
    unemployment: {
      id: "unemployment",
      label: "Unemployment rate",
      shortLabel: "Unemployment",
      value: 4.9,
      unit: "%",
      color: "#555555",
      period: "January 2026 to March 2026",
      observedAt: "2026-03-31T00:00:00.000Z",
      publishedAt: "2026-06-18T00:00:00.000Z",
      retrievedAt,
      publisher: "Office for National Statistics",
      sourceUrl: "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms",
      seriesId: "MGSX",
      datasetId: "LMS",
      frequency: "Monthly publication of a rolling three-month estimate",
      revisionStatus: "Labour Force Survey estimates may be revised.",
      evidenceClass: "official-data",
      status: "current",
      nextRelease: "2026-07-16",
      annualDelta: 0.4,
      annualDeltaUnit: "percentage points",
      history: [
        {
          period: "December 2025 to February 2026",
          observedAt: "2026-02-28T00:00:00.000Z",
          value: 5,
        },
        {
          period: "January 2026 to March 2026",
          observedAt: "2026-03-31T00:00:00.000Z",
          value: 4.9,
        },
      ],
    },
  },
  methodology: {
    alignment: "Each series keeps its own clock.",
    evidenceClass: "official-data",
  },
};

function result(overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date(retrievedAt),
    source: "worker",
    cacheState: "fresh",
    observationPeriod: "Series-specific periods shown below",
    observationStatus: "current",
    observedAt: new Date("2026-05-31T00:00:00.000Z"),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
});

describe("SentimentPulse series-level evidence", () => {
  it("shows three independent values, periods and publishers", () => {
    useMetrics.mockReturnValue(result());

    render(<SentimentPulse />);

    expect(
      screen.getByRole("heading", {
        name: "Inflation is 3.4%, Bank Rate is 3.75% and unemployment is 4.9%.",
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText("May 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("18 December 2025").length).toBeGreaterThan(0);
    expect(screen.getAllByText("January 2026 to March 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Office for National Statistics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bank of England").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Freshness and provenance for each indicator" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("14 Jul 2026, 12:00 UTC").length).toBe(3);
  });

  it("switches the chart to the selected series without aligning dates", () => {
    useMetrics.mockReturnValue(result());

    render(<SentimentPulse />);
    fireEvent.click(screen.getByRole("button", { name: /Bank Rate/i }));

    expect(
      screen.getByRole("heading", { name: "Official Bank Rate: published history" })
    ).toBeInTheDocument();
    expect(screen.getByText("7 August 2025 to 18 December 2025")).toBeInTheDocument();
  });

  it("fails closed for a stale Worker record", () => {
    useMetrics.mockReturnValue(result({ cacheState: "stale" }));

    render(<SentimentPulse />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current economic indicators unavailable"
    );
    expect(screen.queryByText(/Inflation is 3.4%/i)).not.toBeInTheDocument();
  });

  it("fails closed for the legacy mixed timeline", () => {
    useMetrics.mockReturnValue(
      result({
        data: {
          economicData: [{ date: "Jan 26", inflation: 3, bankRate: 3.75 }],
          metricConfig: { inflation: { current: "3.0%" } },
        },
      })
    );

    render(<SentimentPulse />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current economic indicators unavailable"
    );
  });

  it("uses an unavailable fallback rather than embedded values", () => {
    useMetrics.mockImplementation((_section: string, fallback: unknown) =>
      result({ data: fallback, isLive: false, cacheState: null })
    );

    render(<SentimentPulse />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "it is not showing the old embedded values"
    );
  });
});
