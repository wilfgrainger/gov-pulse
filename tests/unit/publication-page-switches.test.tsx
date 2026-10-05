import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Home from "@/app/page";
import SectionPage from "@/app/section/[id]/page";
import PublicMoneyPage from "@/app/money/page";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { GET } from "@/app/data/sections/[file]/route";
import { renderRssFeed } from "@/app/feed.xml/route";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";

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
  it("withdraws public-money dossiers before reading stored awards", async () => {
    render(await PublicMoneyPage());
    expect(screen.getByRole("heading", { name: "Public money is temporarily unavailable" })).toBeInTheDocument();
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });
  it.each(["government-contracts", "gdp", "early-years", "election-polls", "uk-in-context"])("blocks dynamic and static evidence on %s", async (id) => {
    render(await SectionPage({ params: Promise.resolve({ id }) }));
    expect(screen.getByRole("heading", { name: /temporarily (offline|unavailable)/i })).toBeInTheDocument();
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
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
  it("publishes only enabled nationalDebt entries in RSS", () => {
    const feed = renderRssFeed(BUILD_METRICS_SNAPSHOT);
    const items = feed.split("<item>").slice(1).map((item) => item.split("</item>")[0]);
    expect(items.length).toBeGreaterThan(0);
    expect(feed).toContain("/section/national-debt/");
    expect(feed).not.toContain("/section/government-contracts/");
    expect(feed).not.toContain("/section/election-polls/");
    expect(feed).not.toContain("/stories/");
  });
});
