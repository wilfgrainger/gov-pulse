import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ElectionPolling from "@/app/components/ElectionPolling";

const useMetrics = vi.fn();

vi.mock("@/app/lib/useMetrics", () => ({
  useMetrics: (...args: unknown[]) => useMetrics(...args),
}));

vi.mock("@/app/components/MetricsStatus", () => ({
  default: () => <div>Metric provenance</div>,
}));

const current = {
  available: true,
  latestPublicationDate: "2026-07-06",
  expiresAt: "2026-07-20T00:00:00.000Z",
  polls: [
    {
      id: "yougov-2026-07-05-06-mrp-headline",
      pollster: "YouGov",
      commissioner: "YouGov",
      title: "Westminster voting intention from constituency vote projected by YouGov MRP",
      questionText: "Westminster voting intention from constituency vote projected by YouGov's MRP model",
      publicationDate: "2026-07-06",
      fieldworkStart: "2026-07-05",
      fieldworkEnd: "2026-07-06",
      sampleSize: 2285,
      geography: "Great Britain",
      population: "GB adults",
      mode: "Online panel; headline voting intention modelled using MRP",
      headlineMethod: "Headline voting intention from constituency vote projected by YouGov's MRP model",
      parties: {
        conservative: 20,
        labour: 20,
        liberalDemocrats: 13,
        reformUK: 24,
        green: 13,
        snp: 3,
        plaidCymru: 1,
        yourParty: 1,
        restoreBritain: 3,
        other: 2,
      },
      sourceUrl: "https://ygo-assets-websites-editorial-emea.yougov.net/documents/VotingIntention_MRP_Results_260706_w.pdf",
      methodologyUrl: "https://yougov.co.uk/about/panel-methodology",
      bpcMember: true,
      uncertainty: null,
    },
  ],
  aggregation: {
    method: "none",
    explanation: "public-data.org shows each publication separately.",
  },
  evidencePolicy: {
    sourceClass: "primary-pollster-publication",
    bpcDisclosureRequired: true,
    secondaryAggregatorsUsedAsData: false,
  },
};

function result(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLive: true,
    lastUpdated: new Date("2026-07-06T12:00:00Z"),
    source: "worker",
    cacheState: "fresh",
    observationPeriod: "2026-07-05/2026-07-06",
    observationStatus: "current",
    observedAt: new Date("2026-07-06T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
});

afterEach(() => {
  cleanup();
  useMetrics.mockReset();
  vi.useRealTimers();
});

describe("ElectionPolling evidence integrity", () => {
  it("renders one primary publication with the complete editorial contract", () => {
    useMetrics.mockReturnValue(result(current));

    render(<ElectionPolling />);

    expect(
      screen.getByRole("heading", { name: "YouGov reports Reform UK at 24%." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "YouGov reports Reform UK at 24%." })
        .compareDocumentPosition(screen.getByRole("heading", { name: "Polling lab" })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText(/2,285 GB adults/i)).toBeInTheDocument();
    expect(screen.getByText(/This is one poll publication, not a polling average/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Polling lab" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1 verified publications.")).toBeInTheDocument();
    expect(screen.getByText("What changed?")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "One current publication; no trend is inferred" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why it matters" })).toBeInTheDocument();
    expect(screen.getByText("Explain this number")).toBeInTheDocument();
    expect(screen.getByText("Important caveat")).toBeInTheDocument();
    expect(screen.getByText("Source and date")).toBeInTheDocument();
    expect(screen.getByText(/do not directly forecast seats, turnout or the eventual election result/i)).toBeInTheDocument();
    expect(screen.getByText(/public-data\.org does not scrape Wikipedia or calculate an unweighted average/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open YouGov publication" })).toHaveAttribute(
      "href",
      current.polls[0].sourceUrl
    );
    expect(screen.getByRole("link", { name: "methodology" })).toHaveAttribute(
      "href",
      current.polls[0].methodologyUrl
    );
    expect(screen.queryByText(/public-data\.org polling average/i)).not.toBeInTheDocument();
  });

  it("does not draw a time chart from a single poll publication", () => {
    useMetrics.mockReturnValue(result(current));

    render(<ElectionPolling />);

    expect(screen.queryByRole("img", { name: /Scatter plot of individual poll publications/i })).not.toBeInTheDocument();
    expect(screen.getByText(/A timeline needs more than one verified poll publication/i)).toBeInTheDocument();
  });

  it("shows one fieldwork range when multiple publications share the same dates", () => {
    const samePeriodPoll = {
      ...current.polls[0],
      id: "ipsos-2026-07-05-06",
      pollster: "Ipsos",
      title: "Ipsos voting intention publication",
    };
    useMetrics.mockReturnValue(result({ ...current, polls: [current.polls[0], samePeriodPoll] }));

    render(<ElectionPolling />);

    expect(screen.getByRole("img", { name: /Scatter plot of individual poll publications/i })).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Period shown: 5 Jul 2026–6 Jul 2026. No average")
    );
  });

  it("filters actual pollster publications by fieldwork without combining them", () => {
    const secondPoll = {
      ...current.polls[0],
      id: "ipsos-2026-07-12",
      pollster: "Ipsos",
      title: "Ipsos voting intention publication",
      publicationDate: "2026-07-12",
      fieldworkStart: "2026-07-11",
      fieldworkEnd: "2026-07-12",
      sourceUrl: "https://www.ipsos.com/en-uk/voting-intention",
      methodologyUrl: "https://www.ipsos.com/en-uk/methodology",
    };
    useMetrics.mockReturnValue(result({ ...current, polls: [current.polls[0], secondPoll] }));

    render(<ElectionPolling />);
    fireEvent.change(screen.getByRole("combobox", { name: "Filter polling by pollster" }), { target: { value: "Ipsos" } });

    expect(screen.getByText("Showing 1 of 2 verified publications.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ipsos reports Reform UK at 24%." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "YouGov reports Reform UK at 24%." })).not.toBeInTheDocument();
  });

  it("shows the publication disclosure register", () => {
    useMetrics.mockReturnValue(result(current));

    render(<ElectionPolling />);

    expect(screen.getByRole("heading", { name: "Verified primary poll publications" })).toBeInTheDocument();
    expect(screen.getAllByText("YouGov").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 Jul 2026–6 Jul 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MRP model/i).length).toBeGreaterThan(0);
  });

  it("does not turn sample size into an uncertainty interval or a polling average", () => {
    useMetrics.mockReturnValue(result(current));

    render(<ElectionPolling />);

    expect(
      screen.getByRole("heading", { name: "Individual publications and disclosed uncertainty, not an average" })
    ).toBeInTheDocument();
    expect(screen.getByText(/does not compute, show, or imply a/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample size alone is not used to estimate one/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2,285/).length).toBeGreaterThan(1);
    expect(screen.queryByText(/\u00b12\.1pp/)).not.toBeInTheDocument();
    expect(screen.getByText(/No publication-specific numeric interval was verified/)).toBeInTheDocument();
    expect(screen.queryByText(/polling average/i, { selector: "h3, h4" })).not.toBeInTheDocument();
  });

  it("fails closed when a required disclosure field is absent", () => {
    useMetrics.mockReturnValue(
      result({
        ...current,
        polls: [{ ...current.polls[0], population: undefined }],
      })
    );

    render(<ElectionPolling />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current primary polling evidence unavailable"
    );
  });

  it("fails closed when the publication or Worker cache is stale", () => {
    useMetrics.mockReturnValue(
      result(
        { ...current, expiresAt: "2026-07-10T00:00:00.000Z" },
        { cacheState: "stale" }
      )
    );

    render(<ElectionPolling />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current primary polling evidence unavailable"
    );
    expect(screen.queryByText(/YouGov reports/i)).not.toBeInTheDocument();
  });

  it("fails closed for the legacy secondary aggregation shape", () => {
    useMetrics.mockReturnValue(
      result({
        pollingData: [{ party: "REF", pct: 28 }],
        recentPolls: [{ pollster: "Wikipedia", date: "Mar 2026" }],
      })
    );

    render(<ElectionPolling />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current primary polling evidence unavailable"
    );
  });

  it("uses an unavailable embedded fallback instead of old poll values", () => {
    useMetrics.mockImplementation((_section: string, fallback: unknown) =>
      result(fallback, { isLive: false, cacheState: null })
    );

    render(<ElectionPolling />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "It will not fall back to a secondary aggregation or an old embedded average"
    );
  });
});
