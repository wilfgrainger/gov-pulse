import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CalendarPage from "@/app/calendar/page";
import PublicMoneyPage from "@/app/money/page";
import CostOfLivingPage from "@/app/cost-of-living/page";
import SectionPage from "@/app/section/[id]/page";
import SourceDetailPage from "@/app/sources/[id]/page";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";

vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot: vi.fn(async () => null) }));
vi.mock("@/app/lib/serverEditionArchive", () => ({ readEditionSummaries: vi.fn(async () => []) }));
vi.mock("@/app/components/SectionNav", () => ({ default: () => null }));
vi.mock("@/app/components/SiteFooter", () => ({ default: () => null }));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(readServerMetricsSnapshot).mockResolvedValue(null);
});

const watchlistSnapshot = {
  meta: {
    generatedAt: "2026-10-01T12:00:00.000Z",
    sources: { nationalDebt: { status: "ok", fetchedAt: "2026-10-01T12:00:00.000Z" } },
    measureCatalog: {
      schemaVersion: 2,
      editionId: "catalog-debt-1",
      generatedAt: "2026-10-01T12:00:00.000Z",
      validUntil: "2027-01-01T00:00:00.000Z",
      measures: {
        "debt-ratio": {
          id: "debt-ratio", label: "Public sector net debt as a share of GDP", evidenceClass: "official-statistics",
          comparisonKey: "public-sector-net-debt-gdp", cadence: "monthly", unit: "%", basis: "Public sector net debt divided by GDP",
          geography: { code: "UK", label: "United Kingdom" }, sourceId: "nationalDebt", sourceUrl: "https://www.ons.gov.uk/releases/publicsectorfinance",
          sourceEditionId: "ons-2026-08", observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "August 2026" },
          publishedAt: "2026-09-22T00:00:00.000Z", fetchedAt: "2026-10-01T12:00:00.000Z", validUntil: "2027-01-01T00:00:00.000Z",
          availability: "current", value: 93.8, revisionId: "debt-revision-1",
          points: [{ period: "August 2026", observedAt: "2026-08-31", value: 93.8, valueStatus: "observed", revisionId: "debt-revision-1" }], caveats: [],
        },
      },
    },
  },
  nationalDebt: {
    headline: { publicationDate: "2026-09-22", nextReleaseDate: "2026-10-30" },
    source: { debtUrl: "https://www.ons.gov.uk/releases/publicsectorfinance" },
  },
};

describe("reader experiences when data publication remains held", () => {
  it("keeps the release calendar and local watchlist available", async () => {
    vi.mocked(readServerMetricsSnapshot).mockResolvedValue(watchlistSnapshot as never);
    const markup = renderToStaticMarkup(await CalendarPage());
    expect(markup).toContain("Release calendar");
    expect(markup).toContain("release-calendar-publication-held");
    expect(markup).toContain("Your watchlist board");
    expect(markup).not.toContain("Public sector net debt publication");
  });

  it("keeps polling methodology available without showing unpublished poll results", async () => {
    const markup = renderToStaticMarkup(await SectionPage({ params: Promise.resolve({ id: "election-polls" }) }));
    expect(markup).toContain("Election polling");
    expect(markup).toContain("section-publication-held");
    expect(markup).not.toContain("YouGov reports");
  });

  it("keeps the public-money product page available without showing held awards", async () => {
    const markup = renderToStaticMarkup(await PublicMoneyPage());
    expect(markup).toContain("Public money dossiers");
    expect(markup).toContain("government-contracts-publication-held");
    expect(markup).not.toContain("Find a Tender update window");
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
  });

  it("keeps the cost-of-living lens visible with clear held evidence state", async () => {
    const markup = renderToStaticMarkup(await CostOfLivingPage());
    expect(markup).toContain("Cost of living");
    expect(markup).toContain("cost-of-living-publication-held");
    expect(markup).not.toContain("household affordability score");
  });

  it("keeps a held source's methodology page available without a data record", async () => {
    const markup = renderToStaticMarkup(await SourceDetailPage({
      params: Promise.resolve({ id: "governmentContracts" }),
      searchParams: Promise.resolve({}),
    }));
    expect(markup).toContain("Government contract award releases");
    expect(markup).toContain("source-publication-held");
    expect(markup).not.toContain("private diagnostics");
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
  });
});
