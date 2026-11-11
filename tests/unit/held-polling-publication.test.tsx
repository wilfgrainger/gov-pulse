// Election polling is held (licence permission required) in the REAL config.
// The fixture still carries a stored polling record, as the live snapshot does
// until the next collection; none of its values may reach a public surface.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SectionPage from "@/app/section/[id]/page";
import { GET } from "@/app/data/sections/[file]/route";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { renderRssFeed } from "@/app/lib/rssFeed";
import { buildSitemap } from "@/app/lib/sitemapEntries";
import { projectPublic, publicationDecision } from "@/contracts/evidence-policy";
import fixture from "@/tests/fixtures/publication/current-snapshot.json";

vi.mock("@/app/lib/serverMetricsSnapshot", () => ({ readServerMetricsSnapshot: vi.fn(async () => null) }));
vi.mock("@/app/components/SectionNav", () => ({ default: () => null }));
vi.mock("@/app/components/SiteFooter", () => ({ default: () => null }));

const NOW = new Date("2026-11-05T12:00:00.000Z");
const POLL_VALUES = ["yougov-2026-11-02", "Lab 26%", "The Times and Sky News"];

afterEach(() => { vi.clearAllMocks(); });

function expectNoPollValues(text: string) {
  for (const value of POLL_VALUES) expect(text).not.toContain(value);
}

describe("held election polling", () => {
  it("is held for a licence reason", () => {
    expect(JSON.stringify(fixture)).toContain("yougov-2026-11-02");
    expect(publicationDecision("electionPolling")).toMatchObject({ state: "held", reasonCode: "licence-permission-required" });
  });

  it("section page shows the held notice, no figures and no Dataset structured data", async () => {
    vi.mocked(readServerMetricsSnapshot).mockResolvedValue(structuredClone(fixture) as never);
    const markup = renderToStaticMarkup(await SectionPage({ params: Promise.resolve({ id: "election-polls" }) }));
    expect(markup).toContain("section-publication-held");
    expect(markup).not.toContain("application/ld+json");
    expectNoPollValues(markup);
  });

  it.each(["electionPolling.json", "electionPolling.csv"])("download %s is unavailable", async (file) => {
    vi.mocked(readServerMetricsSnapshot).mockResolvedValue(structuredClone(fixture) as never);
    const response = await GET(new Request(`https://public-data.org/data/sections/${file}`), { params: Promise.resolve({ file }) });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expectNoPollValues(await response.text());
  });

  it("snapshot projection, RSS and sitemap carry no polling values", () => {
    const projected = projectPublic(structuredClone(fixture), NOW) as Record<string, unknown> | null;
    expect(projected).not.toHaveProperty("electionPolling");
    expectNoPollValues(JSON.stringify(projected));

    const rss = renderRssFeed(structuredClone(fixture), NOW);
    expect(rss).not.toContain("/section/election-polls/");
    expectNoPollValues(rss);

    const sitemap = buildSitemap(structuredClone(fixture), NOW);
    const polls = sitemap.find((entry) => new URL(entry.url).pathname === "/section/election-polls/");
    expect(polls?.lastModified).toBeUndefined();
    expectNoPollValues(JSON.stringify(sitemap));
  });
});
