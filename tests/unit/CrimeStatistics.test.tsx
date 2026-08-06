import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CrimeStatistics from "@/app/components/CrimeStatistics";
import { buildCurrentCrimeStatisticsPayload } from "@/contracts/crime-statistics";
import { parseOnsCrimeBulletin } from "@/worker/live-crime-collector";
import {
  CRIME_BULLETIN_HTML,
  CRIME_EDITION_URL,
} from "@/tests/fixtures/crime-publication";

const useMetrics = vi.fn();
const now = new Date("2026-08-02T04:30:00.000Z");

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
  vi.useRealTimers();
});

function result(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLive: true,
    cacheState: "fresh",
    observationStatus: "current",
    ...overrides,
  };
}

function currentPayload() {
  return buildCurrentCrimeStatisticsPayload(
    parseOnsCrimeBulletin(CRIME_BULLETIN_HTML, CRIME_EDITION_URL),
    now
  );
}

describe("CrimeStatistics modular evidence page", () => {
  it("fails closed when the official publication is unavailable", () => {
    useMetrics.mockReturnValue(
      result(
        { available: false },
        { isLive: false, cacheState: "missing", observationStatus: null }
      )
    );

    render(<CrimeStatistics />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Crime statistics temporarily unavailable"
    );
    expect(
      screen.getByText(/does not fall back to the former bundled dataset/i)
    ).toBeInTheDocument();
  });

  it("renders the current survey, police and court evidence as separate modules", () => {
    useMetrics.mockReturnValue(result(currentPayload()));

    render(<CrimeStatistics />);

    expect(
      screen.getByRole("heading", {
        name: "Crime needs two different lenses, not one synthetic total.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Crime experienced by households and individuals",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Crimes recorded by the police" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Criminal court timeliness" })
    ).toBeInTheDocument();
    expect(screen.getByText("9.6 million")).toBeInTheDocument();
    expect(screen.getByText("48,774")).toBeInTheDocument();
    expect(screen.getByText("346 days")).toBeInTheDocument();
    expect(screen.getAllByText(/released 23 July 2026/i)).toHaveLength(2);
    expect(screen.getAllByText(/Report Fraud/i)).toHaveLength(2);
  });

  it("keeps unsupported regional rankings unavailable without suppressing official modules", () => {
    useMetrics.mockReturnValue(result(currentPayload()));

    render(<CrimeStatistics />);

    expect(
      screen.getByRole("heading", { name: "Regional comparisons" })
    ).toBeInTheDocument();
    expect(screen.getByText(/No regional ranking is published/i)).toBeInTheDocument();
    expect(screen.queryByText(/London.*rate/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /No victimisation estimate, recorded-offence count or court-duration figure is added/i
      )
    ).toBeInTheDocument();
  });

  it("rejects a tampered modular payload", () => {
    const payload = currentPayload();
    payload.evidencePolicy.combinedTotalAllowed = true;
    useMetrics.mockReturnValue(result(payload));

    render(<CrimeStatistics />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("9.6 million")).not.toBeInTheDocument();
  });
});
