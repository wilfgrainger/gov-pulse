import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BettingOdds from "@/app/components/BettingOdds";
import {
  MARKET_DEFINITIONS,
  normalizeBettingMarketPayload,
} from "@/contracts/betting-markets";

const useMetrics = vi.fn();
const now = new Date("2026-07-14T12:00:00.000Z");

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: () => useMetrics(),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const currentSnapshot = normalizeBettingMarketPayload(
  {
    provider: "Oddschecker",
    observedAt: "2026-07-14T10:00:00.000Z",
    markets: [
      {
        id: "nextPrimeMinister",
        title: MARKET_DEFINITIONS.nextPrimeMinister.title,
        sourceUrl: MARKET_DEFINITIONS.nextPrimeMinister.sourceUrl,
        runners: [
          { name: "Candidate A", decimalOdds: 3 },
          { name: "Candidate B", decimalOdds: 4 },
          { name: "Candidate C", decimalOdds: 5 },
          { name: "Candidate D", decimalOdds: 8 },
          { name: "Candidate E", decimalOdds: 10 },
        ],
      },
      {
        id: "mostSeats",
        title: MARKET_DEFINITIONS.mostSeats.title,
        sourceUrl: MARKET_DEFINITIONS.mostSeats.sourceUrl,
        runners: [
          { name: "Party A", decimalOdds: 2 },
          { name: "Party B", decimalOdds: 3 },
          { name: "Party C", decimalOdds: 5 },
        ],
      },
      {
        id: "electionYear",
        title: MARKET_DEFINITIONS.electionYear.title,
        sourceUrl: MARKET_DEFINITIONS.electionYear.sourceUrl,
        runners: [
          { name: "2028", decimalOdds: 2 },
          { name: "2029 or later", decimalOdds: 2.1 },
        ],
      },
    ],
  },
  now
);

function result(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date("2026-07-14T10:00:00Z"),
    source: "worker",
    cacheState: "fresh",
    observationPeriod: "2026-07-14T10:00:00.000Z",
    observationStatus: "current",
    observedAt: new Date("2026-07-14T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
  vi.useRealTimers();
});

describe("BettingOdds evidence integrity", () => {
  it("renders canonical raw prices and direct market links without synthetic normalization", () => {
    useMetrics.mockReturnValue(result(currentSnapshot));

    render(<BettingOdds />);
    expect(
      screen.getByRole("heading", {
        name: "Candidate A has the shortest listed next-PM price at 3.00.",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Next Prime Minister after Andy Burnham",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/raw reciprocal price is 33.3%/i)).toBeInTheDocument();
    expect(screen.getByText(/without synthetic normalization/i)).toBeInTheDocument();
    const links = screen.getAllByRole("link", {
      name: "Open this exact Oddschecker market",
    });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute(
      "href",
      MARKET_DEFINITIONS.nextPrimeMinister.sourceUrl
    );
    expect(screen.queryByText(/Keir Starmer/i)).not.toBeInTheDocument();
  });

  it("suppresses stale cache state even when the payload is otherwise complete", () => {
    useMetrics.mockReturnValue(result(currentSnapshot, { cacheState: "stale" }));

    render(<BettingOdds />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Current betting market snapshot unavailable"
    );
    expect(screen.queryByText("Candidate A")).not.toBeInTheDocument();
  });

  it("suppresses expired and non-live snapshots", () => {
    useMetrics.mockReturnValue(
      result({ ...currentSnapshot, expiresAt: "2026-07-14T11:59:59.000Z" })
    );
    const { unmount } = render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    unmount();

    useMetrics.mockReturnValue(result(currentSnapshot, { isLive: false, source: "fallback" }));
    render(<BettingOdds />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /will not display stale, partial, redirected or embedded/i
    );
  });

  it("fails closed for legacy, incomplete and wrong-provenance payloads", () => {
    useMetrics.mockReturnValue(
      result({
        nextPmOdds: [{ name: "Legacy candidate", probability: 42 }],
        mostSeats: [],
        yearOdds: [],
      })
    );
    const legacy = render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    legacy.unmount();

    useMetrics.mockReturnValue(
      result({
        ...currentSnapshot,
        markets: currentSnapshot.markets.slice(0, 2),
      })
    );
    const incomplete = render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    incomplete.unmount();

    const wrongSource = structuredClone(currentSnapshot);
    wrongSource.markets[0].sourceUrl = "https://example.com";
    useMetrics.mockReturnValue(result(wrongSource));
    render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("fails closed when canonical identity, derived values or observation metadata are altered", () => {
    const alteredTitle = structuredClone(currentSnapshot);
    alteredTitle.markets[0].title = "Next Prime Minister after Keir Starmer";
    useMetrics.mockReturnValue(result(alteredTitle));
    const title = render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    title.unmount();

    const alteredProbability = structuredClone(currentSnapshot);
    alteredProbability.markets[0].runners[0].impliedProbability = 99;
    useMetrics.mockReturnValue(result(alteredProbability));
    const probability = render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    probability.unmount();

    const alteredBook = structuredClone(currentSnapshot);
    alteredBook.markets[0].marketBookPercent += 1;
    useMetrics.mockReturnValue(result(alteredBook));
    const book = render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    book.unmount();

    const missingObservation = structuredClone(currentSnapshot) as typeof currentSnapshot & {
      __observation?: unknown;
    };
    delete missingObservation.__observation;
    useMetrics.mockReturnValue(result(missingObservation));
    render(<BettingOdds />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
