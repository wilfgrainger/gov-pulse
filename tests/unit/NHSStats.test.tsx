import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NHSStats from "@/app/components/NHSStats";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: (...args: unknown[]) => useMetrics(...args),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const current = {
  available: true,
  expiresAt: "2026-08-23T00:00:00.000Z",
  headline: {
    period: "May 2026",
    observedAt: Date.UTC(2026, 5, 0),
    publicationDate: "2026-07-09",
    waitingPathwaysEstimate: 7_300_000,
    waitingPathwaysDisplay: "7.3 million",
    uniquePatientsEstimate: 6_200_000,
    within18WeeksPercent: 65.6,
    standardPercent: 92,
    medianWaitWeeks: 12.4,
    percentile92WaitWeeks: 38.6,
    over52Weeks: 104_734,
    over65Weeks: 6_740,
    over78Weeks: 1_144,
    over104Weeks: 177,
    yearChangePercent: -1.1,
    yearChangePathways: -77_566,
    newPathways: 1_725_997,
    admittedCompleted: 293_707,
    nonAdmittedCompleted: 1_133_648,
  },
  specialties: [
    ["Trauma and Orthopaedic Service", 827_960, 60.1],
    ["Ophthalmology Service", 624_531, 74.1],
    ["Ear Nose and Throat Service", 594_331, 58.9],
    ["Gynaecology Service", 571_683, 60.9],
    ["General Surgery Service", 482_306, 66.2],
    ["Gastroenterology Service", 459_207, 61.2],
    ["Cardiology Service", 403_511, 64.8],
    ["Dermatology Service", 390_004, 69.7],
  ].map(([name, incompletePathways, within18WeeksPercent]) => ({
    name,
    incompletePathways,
    within18WeeksPercent,
  })),
  missingTrusts: [
    { name: "Sheffield Teaching Hospitals NHS Foundation Trust", code: "RHQ" },
    { name: "Torbay and South Devon NHS Foundation Trust", code: "RA9" },
  ],
  history: Array.from({ length: 13 }, (_, index) => ({
    period: index === 12 ? "May 2026" : `Month ${index + 1}`,
    observedAt: index === 12 ? Date.UTC(2026, 5, 0) : Date.UTC(2025, index + 1, 0),
    medianWaitWeeks: 12.4,
    percentile92WaitWeeks: 38.6,
    within18WeeksPercent: 65.6,
    over52Weeks: 104_734,
    over65Weeks: 6_740,
    over78Weeks: 1_144,
    over104Weeks: 177,
    waitingPathwaysEstimate: 7_278_384,
    uniquePatientsEstimate: 6_157_633,
    admittedCompleted: 293_707,
    nonAdmittedCompleted: 1_133_648,
    newPathways: 1_725_997,
  })),
  annualDelta: {
    medianWaitWeeks: -1.2,
    percentile92WaitWeeks: -3.9,
    within18WeeksPercent: 4.7,
    over52Weeks: -92_105,
    over65Weeks: -4_733,
    over78Weeks: -93,
    over104Weeks: 17,
    waitingPathwaysEstimate: -77_566,
    uniquePatientsEstimate: -65_724,
    admittedCompleted: -19_093,
    nonAdmittedCompleted: -54_247,
    newPathways: -31_220,
  },
  methodology: {
    geography: "England",
    measure: "Incomplete consultant-led referral-to-treatment pathways",
    waitingListUnit: "pathways",
    peopleCaveat: "Some patients are on more than one pathway.",
    estimatesCaveat: "National headline figures include estimates for missing trusts.",
    revisionNote: "NHS England publishes periodic revisions.",
  },
  source: {
    publisher: "NHS England",
    landingUrl:
      "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
    dataPageUrl:
      "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/rtt-data-2026-27/",
    pressNoticeUrl:
      "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/07/May26-RTT-statistical-press-notice-PDF-574K-3jBgba.pdf",
    timeseriesUrl:
      "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/07/RTT-Overview-Timeseries-May26.xlsx",
  },
  evidencePolicy: {
    sourceClass: "official-primary",
    headlineIncludesMissingTrustEstimates: true,
    specialtiesIncludeMissingTrustEstimates: false,
    withdrawnSeries: ["A&E performance", "GP wait", "NHS workforce", "life expectancy"],
  },
};

function result(data: unknown) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date("2026-07-09T12:00:00Z"),
    source: "worker",
    cacheState: "fresh",
    observationPeriod: "May 2026",
    observationStatus: "current",
    observedAt: new Date("2026-05-31T00:00:00Z"),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));
});

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
  vi.useRealTimers();
});

describe("NHSStats evidence integrity", () => {
  it("renders one coherent current NHS RTT publication", () => {
    useMetrics.mockReturnValue(result(current));

    render(<NHSStats />);

    expect(
      screen.getByRole("heading", {
        name: "7.3 million treatment pathways were waiting at the end of May 2026.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/fell by 1.1% \(77,566 pathways\)/i)).toBeInTheDocument();
    expect(screen.getByText("65.6%")).toBeInTheDocument();
    expect(screen.getByText("104,734")).toBeInTheDocument();
    expect(screen.getByText("Trauma and Orthopaedic Service")).toBeInTheDocument();
    expect(screen.getByText(/Sheffield Teaching Hospitals/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "NHS England RTT statistical press notice" })
    ).toHaveAttribute("href", current.source.pressNoticeUrl);
  });

  it("states why unrelated health measures were withdrawn", () => {
    useMetrics.mockReturnValue(result(current));

    render(<NHSStats />);

    expect(
      screen.getByRole("heading", { name: "Unaligned health measures withdrawn" })
    ).toBeInTheDocument();
    expect(screen.getByText(/A&E performance, GP waiting time, NHS workforce and life expectancy/i)).toBeInTheDocument();
    expect(screen.queryByText("71.4%")).not.toBeInTheDocument();
    expect(screen.queryByText("14.8")).not.toBeInTheDocument();
    expect(screen.queryByText("1.55M")).not.toBeInTheDocument();
    expect(screen.queryByText("82.9")).not.toBeInTheDocument();
  });

  it("fails closed when a required current field is missing", () => {
    useMetrics.mockReturnValue(
      result({
        ...current,
        headline: { ...current.headline, publicationDate: undefined },
      })
    );

    render(<NHSStats />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current NHS RTT evidence unavailable"
    );
  });

  it("fails closed when the publication has expired", () => {
    useMetrics.mockReturnValue(
      result({ ...current, expiresAt: "2026-07-10T00:00:00.000Z" })
    );

    render(<NHSStats />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current NHS RTT evidence unavailable"
    );
    expect(screen.queryByText(/7.3 million treatment pathways/i)).not.toBeInTheDocument();
  });

  it("rejects the legacy mixed NHS dashboard shape", () => {
    useMetrics.mockReturnValue(
      result({
        headline: {
          waitingList: 7.48,
          aePerformance: 71.4,
          gpWait: 14.8,
          nhsWorkforce: 1.55,
        },
        waitingTrend: [],
        waitingBySpecialty: [],
        lifeExpectancyTrend: [],
      })
    );

    render(<NHSStats />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "It will not show an older waiting-list snapshot or unrelated embedded health measures as current"
    );
  });

  it("uses an unavailable embedded fallback with no NHS values", () => {
    useMetrics.mockImplementation((_section: string, fallback: unknown) => result(fallback));

    render(<NHSStats />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current NHS RTT evidence unavailable"
    );
    expect(screen.queryByText("7.48M")).not.toBeInTheDocument();
  });
});
