import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Home from "@/app/page";
import SectionPage from "@/app/section/[id]/page";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { GET } from "@/app/data/sections/[file]/route";
import { renderRssFeed } from "@/app/feed.xml/route";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";

vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot: vi.fn(async () => null) }));
vi.mock("@/app/components/SectionNav", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("source-specific publication switches", () => {
  it("keeps the public edition available for the verified contracts source", async () => {
    render(await Home());
    expect(screen.getByRole("heading", { name: "Latest figures" })).toBeInTheDocument();
    expect(readServerMetricsSnapshot).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /Explore public-money records/ })).toHaveAttribute("href", "/money");
  });
  it.each(["gdp", "early-years", "election-polls", "uk-in-context"])("blocks dynamic and static evidence on %s", async (id) => {
    render(await SectionPage({ params: Promise.resolve({ id }) }));
    expect(screen.getByRole("heading", { name: /temporarily offline/i })).toBeInTheDocument();
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
  });
  it("blocks downloads before reading evidence", async () => {
    const response = await GET(new Request("https://public-data.org/data/sections/gdpTracker.json"), { params: Promise.resolve({ file: "gdpTracker.json" }) });
    expect(response.status).toBe(503);
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
  });
  it("publishes only the enabled contracts destination in RSS", () => {
    const feed = renderRssFeed(BUILD_METRICS_SNAPSHOT);
    const items = feed.split("<item>").slice(1).map((item) => item.split("</item>")[0]);
    expect(items).toHaveLength(1);
    expect(items[0]).toContain("/section/government-contracts/");
    expect(feed).not.toContain("/section/election-polls/");
    expect(feed).not.toContain("/section/national-debt/");
    expect(feed).not.toContain("/stories/");
  });
});
