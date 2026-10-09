import { describe, expect, it, vi } from "vitest";
import {
  PUBLIC_DOWNLOAD_SECTION_IDS,
  PUBLIC_SECTION_PATHS,
  RETIRED_SECTION_PATHS,
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
  verifyDownloadMatchesSnapshot,
  verifySitemapXml,
  verifySourcesHtml,
} from "../../scripts/verify-production.mjs";
import { REQUIRED_PUBLISHED_SECTION_IDS } from "../../worker/feed-registry.js";

const revision = "abc123";
const currentGeneratedAt = "2026-08-19T09:00:00.000Z";
const validHtml = `<!doctype html><html><head><title>public-data.org — UK Public Evidence</title><meta name="public-data-revision" content="${revision}"><link rel="canonical" href="https://public-data.org/"></head><body><script type="application/ld+json">{"@type":"WebSite"}</script><h1>public-data.org</h1><a href = "https://www.ons.gov.uk">ONS</a></body></html>`;
const validSourcesHtml = `<!doctype html><html><head><link rel="canonical" href="https://public-data.org/sources/"></head><body><main data-production-route="sources"><section data-production-marker="current-publications"></section><section data-production-marker="evidence-gaps"></section></main></body></html>`;
const validGdpHtml = `<!doctype html><html><head><title>UK GDP growth | public-data.org</title><link rel="canonical" href="https://public-data.org/section/gdp/"><link rel="alternate" type="application/rss+xml" href="https://public-data.org/feed.xml"></head><body><script type="application/ld+json">{"@type":"Dataset"}</script><p>Latest ONS monthly estimate</p><h1>UK GDP grew in May 2026 by 0.1%.</h1><p>Published 16 July 2026. Monthly GDP is an early estimate and can be revised.</p></body></html>`;
const validSitemap = `<?xml version="1.0"?><urlset><url><loc>https://public-data.org/sources/</loc></url><url><loc>https://public-data.org/section/gdp/</loc></url><url><loc>https://public-data.org/section/uk-in-context/</loc></url></urlset>`;
const validRobots = `User-Agent: *\nAllow: /\nSitemap: https://public-data.org/sitemap.xml\n`;
const validFeed = `<?xml version="1.0"?><rss><channel><title>public-data.org — latest verified evidence</title><item><link>https://public-data.org/section/gdp/</link></item></channel></rss>`;

const validHealth = JSON.stringify({ status: "ready", ready: true });
const requiredSections = REQUIRED_PUBLISHED_SECTION_IDS;
function publicationSnapshot({ missing = [], now = new Date() } = {}) {
  const fetchedAt = new Date(now.getTime() - 30_000).toISOString();
  const observedAt = new Date(now.getTime() - 60_000).toISOString();
  const validUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
  const sources = {};
  const sections = {};
  for (const section of requiredSections) {
    if (missing.includes(section)) continue;
    sources[section] = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt,
      provenance: { section },
    };
    sections[section] = {
      expiresAt: validUntil,
      __observation: {
        status: "current",
        period: "Current test period",
        observedAt,
        maxAgeDays: 30,
      },
    };
    if (section === "sentimentPulse") {
      sections[section].__measureValidity = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [id, { validUntil }]),
      );
      sections[section].series = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [id, { status: "current", value: 1 }]),
      );
    }
  }
  return {
    meta: {
      registryVersion: "2026-08-02.1",
      generatedAt: currentGeneratedAt,
      sources,
      publicProjection: {
        state: "published",
        publishedSections: Object.keys(sources).sort(),
      },
    },
    ...sections,
  };
}
const validSnapshot = JSON.stringify(publicationSnapshot());
const comparisonMeasureIds = [
  "governmentDebt",
  "officialDevelopmentAssistance",
  "defenceSpending",
  "publicSocialExpenditure",
  "healthcareSpending",
  "taxRevenue",
  "debtInterest",
];
const comparisonCountryIds = [
  "GBR",
  "USA",
  "CHN",
  "RUS",
  "UKR",
  "DEU",
  "FRA",
  "ITA",
  "ESP",
  "IRL",
  "NLD",
  "CHE",
  "POL",
];
const comparisonObservations = comparisonCountryIds.map((country, index) => ({
  country,
  value: 1_000 - index,
  rank: index + 1,
}));
const validInternationalComparison = JSON.stringify({
  meta: {
    schemaVersion: 1,
    generatedAt: "2026-08-19T09:00:00.000Z",
    checkedAt: "2026-08-19T09:00:00.000Z",
    comparisonSetId: "uk-context-13-v2",
    countries: comparisonCountryIds,
  },
  measures: Object.fromEntries(
    comparisonMeasureIds.map((id) => [
      id,
      {
        id,
        comparableCountryCount: comparisonCountryIds.length,
        countries: comparisonObservations,
      },
    ]),
  ),
});

function validSectionHtml(path) {
  return `<html><head><link rel="canonical" href="https://public-data.org/${path}"></head><body><main><h1>Section</h1></main></body></html>`;
}

function validDownload(section, extension) {
  return extension === "json"
    ? JSON.stringify({ section, generatedAt: currentGeneratedAt })
    : `path,value\n$.generatedAt,${currentGeneratedAt}\n$.section,${section}\n`;
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
  ].map(okResponse).concat(RETIRED_SECTION_PATHS.map(() => notFoundResponse()));
}

function notFoundResponse() {
  return { ok: false, status: 404, text: async () => "" };
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

  it("requires retired product routes to be gone rather than kept alive as withdrawn pages", async () => {
    expect(RETIRED_SECTION_PATHS).toEqual([
      "section/pm-approval/",
      "section/govt-approval/",
      "section/gov-trust-trend/",
      "section/uk-regions/",
      "section/policy-links/",
    ]);
    for (const path of RETIRED_SECTION_PATHS) expect(PUBLIC_SECTION_PATHS).not.toContain(path);

    const responses = validResponses();
    responses[responses.length - RETIRED_SECTION_PATHS.length] = okResponse(validSectionHtml("section/pm-approval/"));
    const fetchImpl = vi.fn();
    for (const response of responses) fetchImpl.mockResolvedValueOnce(response);

    await expect(
      verifyProduction({
        url: "https://example.test/",
        expectedRevision: revision,
        attempts: 1,
        delayMs: 0,
        fetchImpl,
        log: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow("retired route https://example.test/section/pm-approval/ returned HTTP 200 instead of 404");
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

  it("rejects section downloads from a different publication edition", () => {
    const staleGeneratedAt = "2026-08-18T09:00:00.000Z";
    const staleJson = JSON.stringify({ section: "gdpTracker", generatedAt: staleGeneratedAt });
    const staleCsv = `path,value\n$.generatedAt,${staleGeneratedAt}\n$.section,gdpTracker\n`;

    expect(verifyDownloadMatchesSnapshot(staleJson, "gdpTracker", "json", currentGeneratedAt)).toContain(
      "gdpTracker.json download does not match the current snapshot edition",
    );
    expect(verifyDownloadMatchesSnapshot(staleCsv, "gdpTracker", "csv", currentGeneratedAt)).toContain(
      "gdpTracker.csv download does not match the current snapshot edition",
    );
    expect(
      verifyDownloadMatchesSnapshot(validDownload("gdpTracker", "json"), "gdpTracker", "json", currentGeneratedAt),
    ).toEqual([]);
    expect(
      verifyDownloadMatchesSnapshot(validDownload("gdpTracker", "csv"), "gdpTracker", "csv", currentGeneratedAt),
    ).toEqual([]);
  });

  it("rejects private measure-catalog diagnostics in a public snapshot", () => {
    const payload = JSON.parse(validSnapshot);
    payload.meta.measureCatalogDiagnostics = [{ measureId: "bankRate", reason: "expired-value" }];
    expect(verifySnapshotJson(JSON.stringify(payload))).toContain(
      "public data snapshot exposes private diagnostics",
    );
  });

  it("rejects stale evidence inside the explicitly published projection", () => {
    const now = new Date("2026-10-02T18:00:00.000Z");

    const expired = publicationSnapshot({ now });
    expired.nationalDebt.expiresAt = new Date(now.getTime() - 1).toISOString();
    expect(verifySnapshotJson(JSON.stringify(expired), { now })).toContain(
      "public data snapshot contains stale published section nationalDebt",
    );

    const staleWithoutExpiry = publicationSnapshot({ now });
    staleWithoutExpiry.meta.sources.employmentStats.cacheState = "stale";
    delete staleWithoutExpiry.employmentStats.expiresAt;
    expect(verifySnapshotJson(JSON.stringify(staleWithoutExpiry), { now })).toContain(
      "public data snapshot contains stale published section employmentStats",
    );
  });

  it("rejects an empty published projection", () => {
    const empty = JSON.stringify({
      meta: {
        registryVersion: "2026-08-02.1",
        sources: {},
        publicProjection: {
          state: "published",
          publishedSections: [],
        },
      },
    });

    expect(verifySnapshotJson(empty)).toContain(
      "public data snapshot has no published evidence",
    );
  });

  it("rejects an incomplete international comparison publication", () => {
    const payload = JSON.parse(validInternationalComparison);
    delete payload.measures.debtInterest;
    expect(verifyInternationalComparisonJson(JSON.stringify(payload))).toContain(
      "international comparison is missing measure debtInterest",
    );
  });

  it("rejects stale Türkiye membership even when the set has 13 countries", () => {
    const payload = JSON.parse(validInternationalComparison);
    payload.meta.comparisonSetId = "uk-context-13-v1";
    payload.meta.countries[9] = "TUR";
    for (const measure of Object.values(payload.measures)) {
      measure.countries[9].country = "TUR";
    }
    const failures = verifyInternationalComparisonJson(JSON.stringify(payload));
    expect(failures).toContain("international comparison set identity was not found");
    expect(failures).toContain("international comparison country universe was not found");
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
      "https://example.test/gov-metrics/section/election-polls/",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      38,
      "https://example.test/gov-metrics/sitemap.xml",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      39,
      "https://example.test/gov-metrics/robots.txt",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      40,
      "https://example.test/gov-metrics/feed.xml",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      41,
      "https://example.test/gov-metrics/section/pm-approval/",
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
      (PUBLIC_SECTION_PATHS.length + PUBLIC_DOWNLOAD_SECTION_IDS.length * 2 + RETIRED_SECTION_PATHS.length + 9) * 2,
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
    // Keep the fixture complete so the asserted /sources/ failure is deterministic
    // even though the verifier probes independent routes in parallel.
    fetchImpl.mockResolvedValue(okResponse(""));
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
