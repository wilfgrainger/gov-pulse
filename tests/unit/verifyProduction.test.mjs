import { describe, expect, it, vi } from "vitest";
import {
  PUBLIC_DOWNLOAD_SECTION_IDS,
  PUBLIC_SECTION_PATHS,
  verifyHealthJson,
  verifyEvidenceFeed,
  verifyGdpHtml,
  verifyInternationalComparisonJson,
  verifyProduction,
  verifyProductionHtml,
  verifyRobotsTxt,
  verifySectionHtml,
  verifySnapshotJson,
  verifyDownload,
  verifySitemapXml,
  verifySourcesHtml,
} from "../../scripts/verify-production.mjs";

const revision = "abc123";
const validHtml = `<!doctype html><html><head><title>public-data.org — UK Public Evidence</title><meta name="public-data-revision" content="${revision}"><link rel="canonical" href="https://public-data.org/"></head><body><script type="application/ld+json">{"@type":"WebSite"}</script><h1>public-data.org</h1><a href = "https://www.ons.gov.uk">ONS</a></body></html>`;
const validSourcesHtml = `<!doctype html><html><head><link rel="canonical" href="https://public-data.org/sources/"></head><body><main data-production-route="sources"><section data-production-marker="current-publications"></section><section data-production-marker="evidence-gaps"></section></main></body></html>`;
const validGdpHtml = `<!doctype html><html><head><title>UK GDP growth | public-data.org</title><link rel="canonical" href="https://public-data.org/section/gdp/"><link rel="alternate" type="application/rss+xml" href="https://public-data.org/feed.xml"></head><body><script type="application/ld+json">{"@type":"Dataset"}</script><p>Latest ONS monthly estimate</p><h1>UK GDP grew in May 2026 by 0.1%.</h1><p>Published 16 July 2026. Monthly GDP is an early estimate and can be revised.</p></body></html>`;
const validSitemap = `<?xml version="1.0"?><urlset><url><loc>https://public-data.org/sources/</loc></url><url><loc>https://public-data.org/section/gdp/</loc></url><url><loc>https://public-data.org/section/uk-in-context/</loc></url></urlset>`;
const validRobots = `User-Agent: *\nAllow: /\nSitemap: https://public-data.org/sitemap.xml\n`;
const validFeed = `<?xml version="1.0"?><rss><channel><title>public-data.org — latest verified evidence</title><item><link>https://public-data.org/section/gdp/</link></item></channel></rss>`;

const validHealth = JSON.stringify({ status: "ready", ready: true });
const requiredSections = [
  "sentimentPulse",
  "gdpTracker",
  "employmentStats",
  "nationalDebt",
  "taxRevenue",
  "migrationStats",
  "electionPolling",
  "nhsStats",
];
const validSnapshot = JSON.stringify({
  meta: {
    registryVersion: "2026-08-02.1",
    sources: Object.fromEntries(requiredSections.map((section) => [section, { status: "ok" }])),
  },
  ...Object.fromEntries(requiredSections.map((section) => [section, {}])),
});
const comparisonMeasureIds = [
  "governmentDebt",
  "officialDevelopmentAssistance",
  "defenceSpending",
  "publicSocialExpenditure",
  "healthcareSpending",
  "taxRevenue",
  "debtInterest",
];
const validInternationalComparison = JSON.stringify({
  meta: {
    schemaVersion: 1,
    generatedAt: "2026-08-19T09:00:00.000Z",
    checkedAt: "2026-08-19T09:00:00.000Z",
    comparisonSetId: "uk-context-13-v1",
    countries: ["GBR", "USA"],
  },
  measures: Object.fromEntries(
    comparisonMeasureIds.map((id) => [
      id,
      {
        id,
        comparableCountryCount: 2,
        countries: [
          { country: "GBR", value: 1000, rank: 1 },
          { country: "USA", value: 900, rank: 2 },
        ],
      },
    ]),
  ),
});

function validSectionHtml(path) {
  return `<html><head><link rel="canonical" href="https://public-data.org/${path}"></head><body><main><h1>Section</h1></main></body></html>`;
}

function validDownload(section, extension) {
  return extension === "json"
    ? JSON.stringify({ section })
    : `section,period\n${section},2026`;
}

function okResponse(text) {
  return { ok: true, status: 200, text: async () => text };
}

function validResponses(home = validHtml) {
  return [
    home,
    validSourcesHtml,
    validGdpHtml,
    validHealth,
    validSnapshot,
    validInternationalComparison,
    ...PUBLIC_SECTION_PATHS.map(validSectionHtml),
    ...PUBLIC_DOWNLOAD_SECTION_IDS.flatMap((section) =>
      ["json", "csv"].map((extension) => validDownload(section, extension)),
    ),
    validSitemap,
    validRobots,
    validFeed,
  ].map(okResponse);
}

describe("production deployment verifier", () => {
  it("accepts publication identity, revision, canonical and structured data", () => {
    expect(verifyProductionHtml(validHtml, revision)).toEqual([]);
  });

  it("accepts the current public sources route markers and canonical", () => {
    expect(verifySourcesHtml(validSourcesHtml)).toEqual([]);
  });

  it("accepts server-rendered GDP evidence and discovery metadata", () => {
    expect(verifyGdpHtml(validGdpHtml)).toEqual([]);
  });

  it("accepts GDP text split by Next.js hydration comments", () => {
    expect(
      verifyGdpHtml(
        validGdpHtml
          .replace("Latest ONS monthly estimate", "Latest <!-- -->ONS monthly estimate")
          .replace("Published 16 July 2026.", "Published <!-- -->16 July 2026<!-- -->."),
      ),
    ).toEqual([]);
  });

  it("accepts sitemap, robots and RSS discovery documents", () => {
    expect(verifySitemapXml(validSitemap)).toEqual([]);
    expect(verifyRobotsTxt(validRobots)).toEqual([]);
    expect(verifyEvidenceFeed(validFeed)).toEqual([]);
  });

  it("requires UK in context in the public route and sitemap contracts", () => {
    expect(PUBLIC_SECTION_PATHS).toContain("section/uk-in-context/");
    expect(verifySitemapXml(validSitemap)).toEqual([]);
    expect(verifySitemapXml(validSitemap.replace("<url><loc>https://public-data.org/section/uk-in-context/</loc></url>", ""))).toContain(
      "UK in context route was not found in sitemap",
    );
  });

  it("accepts ready health, complete national snapshot, international comparison and section routes", () => {
    expect(verifyHealthJson(validHealth)).toEqual([]);
    expect(verifySnapshotJson(validSnapshot)).toEqual([]);
    expect(verifyInternationalComparisonJson(validInternationalComparison)).toEqual([]);
    expect(verifySectionHtml(validSectionHtml("section/uk-in-context/"), "section/uk-in-context/")).toEqual([]);
    expect(verifyDownload(validDownload("gdpTracker", "json"), "gdpTracker", "json")).toEqual([]);
    expect(verifyDownload(validDownload("gdpTracker", "csv"), "gdpTracker", "csv")).toEqual([]);
  });

  it("rejects an incomplete international comparison publication", () => {
    const payload = JSON.parse(validInternationalComparison);
    delete payload.measures.debtInterest;
    expect(verifyInternationalComparisonJson(JSON.stringify(payload))).toContain(
      "international comparison is missing measure debtInterest",
    );
  });

  it("reports every missing homepage integrity marker", () => {
    expect(verifyProductionHtml("<html></html>", revision)).toEqual([
      "public-data.org identity marker was not found",
      `expected deployed revision ${revision} was not found`,
      "representative ONS provenance link was not found",
      "homepage self-canonical URL was not found",
      "publication WebSite structured data was not found",
    ]);
  });

  it("reports missing evidence audit and sources discovery markers", () => {
    expect(verifySourcesHtml("<html></html>")).toEqual([
      "sources route identity marker was not found",
      "current-publication register was not found on the sources route",
      "evidence-gap register was not found on the sources route",
      "sources self-canonical URL was not found",
    ]);
  });

  it("rejects GDP initial HTML that falls back to an unavailable panel", () => {
    expect(
      verifyGdpHtml(
        "<html><body><h1>Current GDP estimate unavailable</h1></body></html>"
      )
    ).toEqual([
      "GDP route rendered the empty fallback in initial HTML",
      "GDP route did not pre-render the verified publication",
      "GDP route did not pre-render the publication date context",
      "GDP-specific page title was not found",
      "GDP self-canonical URL was not found",
      "GDP Dataset structured data was not found",
      "GDP RSS discovery link was not found",
    ]);
  });

  it("reports incomplete discovery documents", () => {
    expect(verifySitemapXml("<xml></xml>")).toEqual([
      "sitemap urlset was not found",
      "GDP route was not found in sitemap",
      "UK in context route was not found in sitemap",
      "sources route was not found in sitemap",
    ]);
    expect(verifyRobotsTxt("")).toEqual([
      "robots user-agent rule was not found",
      "robots allow rule was not found",
      "robots sitemap route was not found",
    ]);
    expect(verifyEvidenceFeed("<xml></xml>")).toEqual([
      "RSS document was not found",
      "RSS publication title was not found",
      "GDP publication was not found in RSS feed",
    ]);
  });

  it("verifies pages, comparison data and discovery surfaces with bounded requests", async () => {
    const fetchImpl = vi.fn();
    for (const response of validResponses()) fetchImpl.mockResolvedValueOnce(response);
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      verifyProduction({
        url: "https://example.test/gov-metrics/",
        expectedRevision: revision,
        attempts: 1,
        delayMs: 0,
        fetchImpl,
        log,
      }),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://example.test/gov-metrics/",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://example.test/gov-metrics/sources/",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "https://example.test/gov-metrics/section/gdp/",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "https://example.test/gov-metrics/data/health.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      "https://example.test/gov-metrics/data/metrics-snapshot.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      "https://example.test/gov-metrics/data/international-comparison.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      "https://example.test/gov-metrics/section/pm-approval/",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      43,
      "https://example.test/gov-metrics/sitemap.xml",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      44,
      "https://example.test/gov-metrics/robots.txt",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      45,
      "https://example.test/gov-metrics/feed.xml",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(log.info).toHaveBeenCalledOnce();
  });

  it("retries a stale deployment and then succeeds", async () => {
    const fetchImpl = vi.fn();
    for (const response of validResponses(validHtml.replace(revision, "old123"))) {
      fetchImpl.mockResolvedValueOnce(response);
    }
    for (const response of validResponses()) fetchImpl.mockResolvedValueOnce(response);
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      verifyProduction({
        url: "https://example.test/",
        expectedRevision: revision,
        attempts: 2,
        delayMs: 0,
        fetchImpl,
        log,
      }),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(
      (PUBLIC_SECTION_PATHS.length + PUBLIC_DOWNLOAD_SECTION_IDS.length * 2 + 9) * 2,
    );
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledOnce();
  });

  it("fails visibly when the evidence route is unavailable", async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce(okResponse(validHtml));
    fetchImpl.mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" });
    for (const response of [validGdpHtml, validSitemap, validRobots, validFeed].map(okResponse)) {
      fetchImpl.mockResolvedValueOnce(response);
    }
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      verifyProduction({
        url: "https://example.test/gov-metrics/",
        expectedRevision: revision,
        attempts: 1,
        delayMs: 0,
        fetchImpl,
        log,
      }),
    ).rejects.toThrow(
      "Production verification failed after 1 attempts: https://example.test/gov-metrics/sources/ returned HTTP 404",
    );
  });

  it("fails visibly after exhausting retries", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "",
    });
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      verifyProduction({
        url: "https://example.test/",
        expectedRevision: revision,
        attempts: 2,
        delayMs: 0,
        fetchImpl,
        log,
      }),
    ).rejects.toThrow(
      "Production verification failed after 2 attempts: https://example.test/ returned HTTP 503",
    );

    expect(log.warn).toHaveBeenCalledTimes(2);
  });
});
