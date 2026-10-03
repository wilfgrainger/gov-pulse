import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ElectionPolling from "@/app/components/ElectionPolling";
import { HISTORICAL_POLL_CORRECTIONS } from "@/app/lib/pollingLab";

const useMetrics = vi.fn();
const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

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
  vi.restoreAllMocks();
  useMetrics.mockReset();
  vi.useRealTimers();
  if (createObjectUrlDescriptor) Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (revokeObjectUrlDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("ElectionPolling evidence integrity", () => {
  it("shows and exports historical same-poll corrections separately from current results", async () => {
    useMetrics.mockReturnValue(result({
      ...current,
      correctionHistory: [{
        id: "ipsos-scottish-parliament-first-vote-september-2013",
        pollster: "Ipsos",
        title: "Scottish Parliament first vote intention",
        geography: "Scotland",
        observationPeriod: "September 2013",
        measure: "Certain to vote",
        unit: "%",
        correctedAt: "2013-10-03",
        reason: "A data-processing error omitted minor-party responses, making major-party percentages too high.",
        sourceUrl: "https://www.ipsos.com/en-uk/statement-voting-intention-figures-scottish-parliament-elections",
        results: [
          { partyId: "snp", label: "Scottish National Party (SNP)", original: 41, corrected: 39 },
          { partyId: "labour", label: "Scottish Labour", original: 37, corrected: 35 },
        ],
      }],
    }));

    render(<ElectionPolling />);

    expect(screen.getByRole("heading", { name: "Poll correction history" })).toBeInTheDocument();
    expect(screen.getByText("Scottish Parliament first vote intention")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Scottish National Party.*41%.*39%/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ipsos correction notice/ })).toHaveAttribute(
      "href",
      "https://www.ipsos.com/en-uk/statement-voting-intention-figures-scottish-parliament-elections"
    );
    expect(screen.getByRole("button", { name: "Download correction history CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download correction history JSON" })).toBeInTheDocument();

    const blobs: Blob[] = [];
    const filenames: string[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => { blobs.push(blob); return `blob:poll-correction-${blobs.length}`; }),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filenames.push(this.download);
    });
    fireEvent.click(screen.getByRole("button", { name: "Download correction history JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Download correction history CSV" }));
    expect(filenames).toEqual(["poll-correction-history.json", "poll-correction-history.csv"]);
    vi.useRealTimers();
    const readBlob = (blob: Blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    const json = JSON.parse(await readBlob(blobs[0]));
    const csv = await readBlob(blobs[1]);
    expect(json.correctionHistory[0].results[0]).toMatchObject({ original: 41, corrected: 39 });
    expect(csv).toContain('"41","39"');
  });

  it("renders one primary publication with the complete editorial contract", () => {
    useMetrics.mockReturnValue(result(current));

    render(<ElectionPolling />);

    expect(
      screen.getByRole("heading", { name: "Reform UK" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reform UK" })
        .compareDocumentPosition(screen.getByRole("heading", { name: "Polling lab" })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText(/2,285 GB adults/i)).toBeInTheDocument();
    expect(screen.getByText(/One poll publication, not a polling average/i)).toBeInTheDocument();
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
    expect(screen.getByText("Latest verified poll · Ipsos")).toBeInTheDocument();
    expect(screen.queryByText("Latest verified poll · YouGov")).not.toBeInTheDocument();
  });

  it("filters disclosed publication dates while leaving the unknown date explicit", () => {
    const undated = {
      ...current.polls[0],
      id: "more-in-common-undated",
      pollster: "More in Common",
      publicationDate: null,
      publicationDateStatus: "not-disclosed" as const,
      fieldworkStart: "2026-07-03",
      fieldworkEnd: "2026-07-06",
      sourceUrl: "https://www.moreincommon.org.uk/wp-content/uploads/2026/07/voting-intention.xlsx",
      methodologyUrl: "https://www.moreincommon.org.uk/polling-tables/",
    };
    useMetrics.mockReturnValue(result({ ...current, polls: [current.polls[0], undated] }));

    render(<ElectionPolling />);
    fireEvent.change(screen.getByLabelText("Polling publication from"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Polling publication to"), { target: { value: "2026-07-31" } });

    expect(screen.getByText("Showing 1 of 2 verified publications.")).toBeInTheDocument();
    expect(screen.getByText("Latest verified poll · YouGov")).toBeInTheDocument();
  });

  it("shows the publication disclosure register", () => {
    useMetrics.mockReturnValue(result(current));

    render(<ElectionPolling />);

    expect(screen.getByRole("heading", { name: "Verified primary poll publications" })).toBeInTheDocument();
    expect(screen.getAllByText("YouGov").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 Jul 2026–6 Jul 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MRP model/i).length).toBeGreaterThan(0);
  });

  it("shows an unknown publication date and partial historical-source coverage honestly", () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00.000Z"));
    const moreInCommon = {
      ...current.polls[0],
      id: "more-in-common-2026-09-29",
      pollster: "More in Common",
      commissioner: null,
      title: "GB Voting Intention & Trackers",
      questionText: null,
      publicationDate: null,
      publicationDateStatus: "not-disclosed",
      fieldworkStart: "2026-09-25",
      fieldworkEnd: "2026-09-29",
      sampleSize: 1514,
      sampleSizeNote: "Unweighted N on the headline table; workbook cover reports 2,041 total respondents.",
      population: "GB adults (excludes Northern Ireland)",
      mode: null,
      headlineMethod: "Publisher-weighted voting-intention headline; weight GBNatRepWeight.",
      parties: { conservative: 22.1, labour: 26.9, liberalDemocrats: 11.1, reformUK: 20.9, green: 8.5 },
      sourceUrl: "https://www.moreincommon.org.uk/wp-content/uploads/2026/09/Voting-Intention-and-Trackers-25-29-Sept.xlsx",
      methodologyUrl: "https://www.moreincommon.org.uk/polling-tables/",
    };
    useMetrics.mockReturnValue(result({
      ...current,
      latestPublicationDate: "2026-07-06",
      latestFieldworkEnd: "2026-09-29",
      expiresAt: "2026-10-13T00:00:00.000Z",
      polls: [moreInCommon, current.polls[0]],
      sources: [
        { pollster: "YouGov", status: "current", recordCount: 1 },
        { pollster: "More in Common", status: "partial", recordCount: 1, archiveFilesRequested: 12, archiveFilesValidated: 1, archiveFilesUnavailable: 11 },
      ],
    }));

    render(<ElectionPolling />);

    expect(screen.getByText("Latest verified poll · More in Common")).toBeInTheDocument();
    expect(screen.getByText(/More in Common reports Labour at 27%/)).toBeInTheDocument();
    expect(screen.getAllByText("Publisher did not disclose a publication date").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unweighted N on the headline table; workbook cover reports 2,041 total respondents/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/More in Common: 1 publications verified; 11 historical archive files could not be checked/i)).toBeInTheDocument();
    expect(screen.getByText(/Question wording is not disclosed in this publication/i)).toBeInTheDocument();
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
      "older polls and secondary averages are not presented as current"
    );
    expect(screen.getByRole("heading", { name: "Poll correction history" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ipsos correction notice/ })).toHaveAttribute(
      "href",
      HISTORICAL_POLL_CORRECTIONS[0].sourceUrl
    );
  });
});
