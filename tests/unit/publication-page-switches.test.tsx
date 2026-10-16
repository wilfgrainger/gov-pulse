import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Home from "@/app/page";
import SectionPage from "@/app/section/[id]/page";
import PublicMoneyPage from "@/app/money/page";
import EditionsPage from "@/app/editions/page";
import { generateMetadata as storyMetadata } from "@/app/stories/[slug]/page";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { GET } from "@/app/data/sections/[file]/route";
import { renderRssFeed } from "@/app/lib/rssFeed";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import { PUBLICATION_CONFIG } from "@/contracts/publication-policy";
import StoryEvidence from "@/app/components/StoryEvidence";

vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot: vi.fn(async () => null) }));
vi.mock("@/app/components/SectionNav", () => ({ default: () => null }));
vi.mock("@/app/components/NationalEvidenceEdition", () => ({ default: () => <div>National evidence</div> }));
vi.mock("@/app/components/HomepageIntro", () => ({ default: () => <h1>Britain, in evidence.</h1> }));
vi.mock("@/app/components/SocialShare", () => ({ default: () => null }));
vi.mock("@/app/components/SiteFooter", () => ({ default: () => null }));
vi.mock("@/app/components/NationalDebtCounter", () => ({ default: () => <div>National debt counter</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("source-specific publication switches", () => {
  it("opens the public edition once nationalDebt is enabled", async () => {
    render(await Home());
    expect(screen.queryByRole("heading", { name: /temporarily offline/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Britain, in evidence/i })).toBeInTheDocument();
    expect(readServerMetricsSnapshot).toHaveBeenCalled();
  });

  it("opens the edition archive pages once editionArchive is enabled", async () => {
    render(await EditionsPage());
    expect(screen.queryByRole("heading", { name: /temporarily offline/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Editions and revisions/i })).toBeInTheDocument();
  });
  it("keeps public-money dossiers visible while withholding stored awards", async () => {
    render(await PublicMoneyPage());
    expect(screen.getByRole("heading", { name: "Public money dossiers" })).toBeInTheDocument();
    expect(screen.getByTestId("government-contracts-publication-held")).toBeInTheDocument();
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });
  it.each(["government-contracts", "gdp", "early-years", "election-polls", "uk-in-context"])("keeps the %s product page available while evidence stays held", async (id) => {
    render(await SectionPage({ params: Promise.resolve({ id }) }));
    expect(screen.getByTestId("section-publication-held")).toBeInTheDocument();
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
  });
  it("does not advertise a held dataset as a public Dataset in structured metadata", async () => {
    const { container } = render(await SectionPage({ params: Promise.resolve({ id: "gdp" }) }));
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
  it("keeps the national debt section available while other publications stay paused", async () => {
    render(await SectionPage({ params: Promise.resolve({ id: "national-debt" }) }));
    expect(screen.queryByRole("heading", { name: /temporarily (offline|unavailable)/i })).not.toBeInTheDocument();
    expect(screen.getByText("National debt counter")).toBeInTheDocument();
    expect(readServerMetricsSnapshot).toHaveBeenCalled();
  });
  it("blocks downloads before reading evidence", async () => {
    const response = await GET(new Request("https://public-data.org/data/sections/gdpTracker.json"), { params: Promise.resolve({ file: "gdpTracker.json" }) });
    expect(response.status).toBe(503);
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
  });
  it("does not index story metadata while story publication is held", async () => {
    const storySwitch = PUBLICATION_CONFIG.publications.storyHouseholdBudgets;
    const enabled = storySwitch.enabled;
    storySwitch.enabled = false;
    try {
      const metadata = await storyMetadata({ params: Promise.resolve({ slug: "household-budgets" }) });
      expect(metadata.robots?.index).toBe(false);
      expect(metadata.robots?.follow).toBe(false);
      expect(metadata.title).not.toContain("household pressure signals");
    } finally {
      storySwitch.enabled = enabled;
    }
  });
  it("publishes only enabled evidence entries in RSS", () => {
    const feed = renderRssFeed(BUILD_METRICS_SNAPSHOT);
    const items = feed.split("<item>").slice(1).map((item) => item.split("</item>")[0]);
    expect(items.length).toBeGreaterThan(0);
    expect(feed).toContain("/section/national-debt/");
    expect(feed).not.toContain("/section/government-contracts/");
    expect(feed).not.toContain("/section/election-polls/");
    expect(feed).toContain("/stories/household-budgets/");
    expect(feed).toContain("/stories/public-finances/");
  });
  it("keeps held story measures out of the evidence panel even if given an unfiltered catalog", () => {
    const catalog = {
      schemaVersion: 2,
      editionId: "held-story-fixture",
      generatedAt: "2026-10-12T00:00:00.000Z",
      validUntil: null,
      measures: {
        "gdp-monthlyGrowth": {
          id: "gdp-monthlyGrowth", label: "GDP monthly growth", evidenceClass: "official-statistics",
          comparisonKey: "uk-real-gdp-monthly-growth", cadence: "monthly", unit: "%", basis: "Monthly change in real GDP",
          geography: { code: "UK", label: "United Kingdom" }, sourceId: "gdpTracker", sourceUrl: "https://www.ons.gov.uk/economy/grossdomesticproductgdp",
          sourceEditionId: "unapproved-edition", observationPeriod: { start: "2026-08-01", end: "2026-08-31", label: "August 2026" },
          publishedAt: "2026-09-12T07:00:00.000Z", fetchedAt: "2026-09-12T08:00:00.000Z", validUntil: "2026-10-20T00:00:00.000Z",
          availability: "current", value: 99, revisionId: "unapproved-edition",
          points: [{ period: "August 2026", observedAt: "2026-08-31", value: 99, valueStatus: "estimate", revisionId: "unapproved-edition" }], caveats: [],
        },
      },
    };
    render(<StoryEvidence measureIds={["gdp-monthlyGrowth"]} catalog={catalog} />);
    expect(screen.getByText("Source evidence held from publication")).toBeInTheDocument();
    expect(screen.queryByText("99 %")).not.toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
});
