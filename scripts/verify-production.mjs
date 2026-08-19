const DEFAULT_ATTEMPTS = 12;
const DEFAULT_DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;
export const PUBLIC_SECTION_PATHS = [
  "section/pm-approval/",
  "section/election-polls/",
  "section/betting-odds/",
  "section/govt-approval/",
  "section/gov-trust-trend/",
  "section/national-debt/",
  "section/gdp/",
  "section/economy/",
  "section/tax/",
  "section/uk-in-context/",
  "section/employment/",
  "section/government-contracts/",
  "section/crime-stats/",
  "section/nhs/",
  "section/migration/",
  "section/early-years/",
  "section/uk-regions/",
  "section/policy-links/",
];
export const PUBLIC_DOWNLOAD_SECTION_IDS = [
  "electionPolling",
  "nationalDebt",
  "gdpTracker",
  "sentimentPulse",
  "taxRevenue",
  "employmentStats",
  "crimeStatistics",
  "nhsStats",
  "migrationStats",
];

const INTERNATIONAL_COMPARISON_MEASURE_IDS = [
  "governmentDebt",
  "officialDevelopmentAssistance",
  "defenceSpending",
  "publicSocialExpenditure",
  "healthcareSpending",
  "taxRevenue",
  "debtInterest",
];

export function verifyProductionHtml(html, expectedRevision) {
  const failures = [];

  if (!/<title>public-data\.org\s+—\s+UK Public Evidence<\/title>/i.test(html)) {
    failures.push("public-data.org identity marker was not found");
  }

  const revisionPattern = new RegExp(
    `<meta[^>]+name=["']public-data-revision["'][^>]+content=["']${escapeRegExp(expectedRevision)}["']|<meta[^>]+content=["']${escapeRegExp(expectedRevision)}["'][^>]+name=["']public-data-revision["']`,
    "i",
  );
  if (!revisionPattern.test(html)) {
    failures.push(`expected deployed revision ${expectedRevision} was not found`);
  }

  if (!/href\s*=\s*["']https:\/\/(?:www\.)?ons\.gov\.uk/i.test(html)) {
    failures.push("representative ONS provenance link was not found");
  }

  if (!/rel=["']canonical["'][^>]+href=["']https:\/\/public-data\.org\/["']/i.test(html)) {
    failures.push("homepage self-canonical URL was not found");
  }

  if (!/["']@type["']\s*:\s*["']WebSite["']/i.test(html)) {
    failures.push("publication WebSite structured data was not found");
  }

  return failures;
}

export function verifySourcesHtml(html) {
  const failures = [];

  if (!/data-production-route=["']sources["']/i.test(html)) {
    failures.push("sources route identity marker was not found");
  }

  if (!/data-production-marker=["']current-publications["']/i.test(html)) {
    failures.push("current-publication register was not found on the sources route");
  }

  if (!/data-production-marker=["']evidence-gaps["']/i.test(html)) {
    failures.push("evidence-gap register was not found on the sources route");
  }

  if (!/rel=["']canonical["'][^>]+href=["']https:\/\/public-data\.org\/sources\/["']/i.test(html)) {
    failures.push("sources self-canonical URL was not found");
  }

  return failures;
}

export function verifyGdpHtml(html) {
  const failures = [];
  const normalizedHtml = html.replace(/<!--[\s\S]*?-->/g, "");

  if (/Current GDP estimate unavailable/i.test(normalizedHtml)) {
    failures.push("GDP route rendered the empty fallback in initial HTML");
  }

  if (!/Latest ONS monthly estimate/i.test(normalizedHtml)) {
    failures.push("GDP route did not pre-render the verified publication");
  }

  if (!/Published\s+[^<]+\.\s+Monthly GDP is an early estimate/i.test(normalizedHtml)) {
    failures.push("GDP route did not pre-render the publication date context");
  }

  if (!/<title>UK GDP growth \| public-data\.org<\/title>/i.test(normalizedHtml)) {
    failures.push("GDP-specific page title was not found");
  }

  if (!/rel=["']canonical["'][^>]+href=["']https:\/\/public-data\.org\/section\/gdp\/["']/i.test(normalizedHtml)) {
    failures.push("GDP self-canonical URL was not found");
  }

  if (!/["']@type["']\s*:\s*["']Dataset["']/i.test(normalizedHtml)) {
    failures.push("GDP Dataset structured data was not found");
  }

  if (!/rel=["']alternate["'][^>]+type=["']application\/rss\+xml["'][^>]+href=["']https:\/\/public-data\.org\/feed\.xml["']/i.test(normalizedHtml)) {
    failures.push("GDP RSS discovery link was not found");
  }

  return failures;
}

export function verifySectionHtml(html, path) {
  const failures = [];
  const normalizedHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const canonical = `https://public-data.org/${path}`;

  if (!/<main\b/i.test(normalizedHtml)) {
    failures.push(`${path} did not render a main content landmark`);
  }
  if (!new RegExp(`rel=["']canonical["'][^>]+href=["']${escapeRegExp(canonical)}["']`, "i").test(normalizedHtml)) {
    failures.push(`${path} self-canonical URL was not found`);
  }
  if (!/<h1\b/i.test(normalizedHtml)) {
    failures.push(`${path} did not render a page heading`);
  }

  return failures;
}

export function verifyHealthJson(text) {
  try {
    const payload = JSON.parse(text);
    return payload?.status === "ready" && payload?.ready === true
      ? []
      : ["public data health endpoint did not report ready"];
  } catch {
    return ["public data health endpoint returned invalid JSON"];
  }
}

export function verifySnapshotJson(text) {
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

  try {
    const payload = JSON.parse(text);
    const failures = [];
    if (!payload?.meta || typeof payload.meta.registryVersion !== "string") {
      failures.push("public data snapshot registry version was not found");
    }
    if (!payload?.meta?.sources || typeof payload.meta.sources !== "object") {
      failures.push("public data snapshot source manifest was not found");
    }
    for (const section of requiredSections) {
      if (!payload?.[section] || !payload?.meta?.sources?.[section]) {
        failures.push(`public data snapshot is missing required section ${section}`);
      }
    }
    return failures;
  } catch {
    return ["public data snapshot returned invalid JSON"];
  }
}

export function verifyInternationalComparisonJson(text) {
  try {
    const payload = JSON.parse(text);
    const failures = [];
    if (payload?.meta?.schemaVersion !== 1) {
      failures.push("international comparison schema version was not found");
    }
    if (payload?.meta?.comparisonSetId !== "uk-context-13-v1") {
      failures.push("international comparison set identity was not found");
    }
    if (!payload?.measures || typeof payload.measures !== "object") {
      failures.push("international comparison measures were not found");
      return failures;
    }

    for (const id of INTERNATIONAL_COMPARISON_MEASURE_IDS) {
      const measure = payload.measures[id];
      if (!measure || typeof measure !== "object") {
        failures.push(`international comparison is missing measure ${id}`);
        continue;
      }
      if (!Array.isArray(measure.countries)) {
        failures.push(`international comparison measure ${id} has no country observations`);
        continue;
      }
      if (!measure.countries.some((observation) => observation?.country === "GBR")) {
        failures.push(`international comparison measure ${id} has no UK observation`);
      }
      if (!Number.isInteger(measure.comparableCountryCount) || measure.comparableCountryCount < 0) {
        failures.push(`international comparison measure ${id} has an invalid comparable-country count`);
      }
    }
    return failures;
  } catch {
    return ["international comparison returned invalid JSON"];
  }
}

export function verifyDownload(text, section, extension) {
  if (!text.trim()) return [`${section}.${extension} download was empty`];
  if (extension !== "json") return [];
  try {
    JSON.parse(text);
    return [];
  } catch {
    return [`${section}.json download returned invalid JSON`];
  }
}

export function verifySitemapXml(xml) {
  const failures = [];
  if (!/<urlset\b/i.test(xml)) failures.push("sitemap urlset was not found");
  if (!/https:\/\/public-data\.org\/section\/gdp\//i.test(xml)) {
    failures.push("GDP route was not found in sitemap");
  }
  if (!/https:\/\/public-data\.org\/section\/uk-in-context\//i.test(xml)) {
    failures.push("UK in context route was not found in sitemap");
  }
  if (!/https:\/\/public-data\.org\/sources\//i.test(xml)) {
    failures.push("sources route was not found in sitemap");
  }
  return failures;
}

export function verifyRobotsTxt(text) {
  const failures = [];
  if (!/User-Agent:\s*\*/i.test(text)) failures.push("robots user-agent rule was not found");
  if (!/Allow:\s*\//i.test(text)) failures.push("robots allow rule was not found");
  if (!/Sitemap:\s*https:\/\/public-data\.org\/sitemap\.xml/i.test(text)) {
    failures.push("robots sitemap route was not found");
  }
  return failures;
}

export function verifyEvidenceFeed(xml) {
  const failures = [];
  if (!/<rss\b/i.test(xml)) failures.push("RSS document was not found");
  if (!/<title>public-data\.org — latest verified evidence<\/title>/i.test(xml)) {
    failures.push("RSS publication title was not found");
  }
  if (!/https:\/\/public-data\.org\/section\/gdp\//i.test(xml)) {
    failures.push("GDP publication was not found in RSS feed");
  }
  return failures;
}

export async function verifyProduction({
  url,
  expectedRevision,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  fetchImpl = fetch,
  log = console,
}) {
  let lastFailure = "verification did not run";
  const rootUrl = ensureTrailingSlash(url);
  const sourcesUrl = new URL("sources/", rootUrl).toString();
  const gdpUrl = new URL("section/gdp/", rootUrl).toString();
  const healthUrl = new URL("data/health.json", rootUrl).toString();
  const snapshotUrl = new URL("data/metrics-snapshot.json", rootUrl).toString();
  const internationalComparisonUrl = new URL(
    "data/international-comparison.json",
    rootUrl,
  ).toString();
  const sitemapUrl = new URL("sitemap.xml", rootUrl).toString();
  const robotsUrl = new URL("robots.txt", rootUrl).toString();
  const feedUrl = new URL("feed.xml", rootUrl).toString();
  const sectionUrls = PUBLIC_SECTION_PATHS.map((path) => ({
    path,
    url: new URL(path, rootUrl).toString(),
  }));
  const downloadUrls = PUBLIC_DOWNLOAD_SECTION_IDS.flatMap((section) =>
    ["json", "csv"].map((extension) => ({
      section,
      extension,
      url: new URL(`data/sections/${section}.${extension}`, rootUrl).toString(),
    })),
  );

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const [
        homeHtml,
        sourcesHtml,
        gdpHtml,
        healthJson,
        snapshotJson,
        internationalComparisonJson,
        ...remaining
      ] = await Promise.all([
        fetchText(rootUrl, fetchImpl),
        fetchText(sourcesUrl, fetchImpl),
        fetchText(gdpUrl, fetchImpl),
        fetchText(healthUrl, fetchImpl),
        fetchText(snapshotUrl, fetchImpl),
        fetchText(internationalComparisonUrl, fetchImpl),
        ...sectionUrls.map(({ url }) => fetchText(url, fetchImpl)),
        ...downloadUrls.map(({ url }) => fetchText(url, fetchImpl)),
        fetchText(sitemapUrl, fetchImpl),
        fetchText(robotsUrl, fetchImpl),
        fetchText(feedUrl, fetchImpl),
      ]);
      const sectionHtml = remaining.slice(0, sectionUrls.length);
      const downloadText = remaining.slice(
        sectionUrls.length,
        sectionUrls.length + downloadUrls.length,
      );
      const sitemapXml = remaining[sectionUrls.length + downloadUrls.length];
      const robotsTxt = remaining[sectionUrls.length + downloadUrls.length + 1];
      const feedXml = remaining[sectionUrls.length + downloadUrls.length + 2];
      const failures = [
        ...verifyProductionHtml(homeHtml, expectedRevision),
        ...verifySourcesHtml(sourcesHtml),
        ...verifyGdpHtml(gdpHtml),
        ...verifyHealthJson(healthJson),
        ...verifySnapshotJson(snapshotJson),
        ...verifyInternationalComparisonJson(internationalComparisonJson),
        ...sectionUrls.flatMap(({ path }, index) => verifySectionHtml(sectionHtml[index], path)),
        ...downloadUrls.flatMap(({ section, extension }, index) =>
          verifyDownload(downloadText[index], section, extension),
        ),
        ...verifySitemapXml(sitemapXml),
        ...verifyRobotsTxt(robotsTxt),
        ...verifyEvidenceFeed(feedXml),
      ];

      if (failures.length === 0) {
        log.info(
          `Verified ${rootUrl} serves revision ${expectedRevision}, ready public data, the international comparison publication, all public section routes including UK in context, server-rendered GDP evidence, discovery metadata, sitemap, robots and RSS.`,
        );
        return;
      }

      lastFailure = failures.join("; ");
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    log.warn(`Production verification attempt ${attempt}/${attempts} failed: ${lastFailure}`);
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Production verification failed after ${attempts} attempts: ${lastFailure}`);
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    redirect: "follow",
    headers: { "user-agent": "public-data-production-smoke/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.text();
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const [url, expectedRevision] = process.argv.slice(2);
  if (!url || !expectedRevision) {
    throw new Error("Usage: node scripts/verify-production.mjs <url> <expected-revision>");
  }

  await verifyProduction({ url, expectedRevision });
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
