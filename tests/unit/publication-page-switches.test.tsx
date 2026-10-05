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

describe("offline publication pages", () => {
  it("replaces the homepage without loading a snapshot", async () => {
    render(await Home());
    expect(screen.getByRole("heading", { name: /data publications are temporarily offline/i })).toBeInTheDocument();
    expect(readServerMetricsSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByText("Latest figures")).not.toBeInTheDocument();
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
  it("does not publish stored figures or stories in the RSS feed", () => {
    expect(renderRssFeed(BUILD_METRICS_SNAPSHOT)).not.toContain("<item>");
  });
});
