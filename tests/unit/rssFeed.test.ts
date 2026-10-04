import { describe, expect, it, vi } from "vitest";
import { GET, renderRssFeed } from "@/app/feed.xml/route";
import { BUILD_METRICS_SNAPSHOT } from "@/app/generated/metricsSnapshot";
import { SITE_DISCOVERY } from "@/app/lib/discovery";
import type { MetricsSnapshot } from "@/app/lib/metricsSnapshot";
import type { MeasureRecord } from "@/app/lib/measureCatalog";
import { publicSnapshot } from "@/worker/public-snapshot";

function rssSnapshot() {
  const snapshot = publicSnapshot(BUILD_METRICS_SNAPSHOT) as MetricsSnapshot;
  const publishedAt = "2026-09-11T06:00:00.000Z";
  const gdp: MeasureRecord = {
    id: "gdp-monthlyGrowth",
    label: "GDP monthly growth",
    evidenceClass: "official-statistics",
    comparisonKey: "uk-real-gdp-monthly-growth",
    cadence: "monthly",
    unit: "%",
    basis: "Monthly change in real gross domestic product",
    geography: { code: "UK", label: "United Kingdom" },
    sourceId: "gdpTracker",
    sourceUrl: "https://www.ons.gov.uk/economy/grossdomesticproductgdp",
    sourceEditionId: "source-gdp-2026-09-11",
    observationPeriod: { start: "2026-07-01", end: "2026-07-31", label: "July 2026" },
    publishedAt,
    fetchedAt: "2026-10-03T00:00:00.000Z",
    validUntil: "2026-11-20T00:00:00.000Z",
    availability: "current",
    value: 0.4,
    revisionId: "source-gdp-2026-09-11-revision-a",
    points: [{ period: "July 2026", observedAt: "2026-07-31", value: 0.4, valueStatus: "estimate", revisionId: "source-gdp-2026-09-11-revision-a" }],
    caveats: ["Monthly growth is volatile and subject to revision."],
  };

  snapshot.meta.sources.gdpTracker = { status: "ok", fetchedAt: "2026-10-03T00:00:00.000Z" };
  snapshot.meta.measureCatalog = {
    schemaVersion: 2,
    editionId: "catalog-rss-test",
    generatedAt: "2026-10-03T00:00:00.000Z",
    validUntil: "2026-10-22T00:00:00.000Z",
    measures: { [gdp.id]: gdp },
  };
  snapshot.meta.editionSummary = {
    id: "catalog-rss-test",
    publishedAt: "2026-09-22T00:00:00.000Z",
    previousEditionId: null,
    sourceEditionIds: [gdp.sourceEditionId],
    changes: [],
  };
  snapshot.gdpTracker = {
    publishedAt,
    __observation: { period: "July 2026", observedAt: "2026-07-31", status: "published" },
  };
  return snapshot;
}

describe("RSS publication feed", () => {
  it("emits parseable source publications and authored stories with stable identities", async () => {
    const response = GET();
    const xml = renderRssFeed(rssSnapshot());
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const items = [...document.querySelectorAll("channel > item")];
    const snapshot = rssSnapshot();
    const gdp = Object.values(snapshot.meta.measureCatalog.measures).find((measure) => measure.sourceId === "gdpTracker");
    const gdpItem = items.find((item) => item.querySelector("link")?.textContent === `${SITE_DISCOVERY.origin}/section/gdp/`);

    expect(response.headers.get("content-type")).toContain("application/rss+xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect(gdp).toBeDefined();
    expect(gdpItem?.querySelector("category")?.textContent).toBe("Source data publication");
    expect(new Date(gdpItem?.querySelector("pubDate")?.textContent ?? "").toISOString()).toBe(new Date(gdp!.publishedAt).toISOString());
    const edition = items.find((item) => item.querySelector("category")?.textContent === "Evidence edition");
    expect(edition?.querySelector("guid")?.textContent).toBe(`urn:public-data:edition:${snapshot.meta.editionSummary.id}`);
    expect(new Date(edition?.querySelector("pubDate")?.textContent ?? "").toISOString()).toBe(new Date(snapshot.meta.editionSummary.publishedAt).toISOString());
    if (snapshot.meta.editionSummary.changes.length === 0) {
      const description = edition?.querySelector("description")?.textContent ?? "";
      if (snapshot.meta.editionSummary.previousEditionId === null) {
        expect(description).toMatch(/no comparable earlier publication.*no evidence changes are inferred/i);
      } else if (snapshot.meta.editionSummary.previousEditionId) {
        expect(description).toMatch(new RegExp(`no observation, revision, metadata or method changes.*${snapshot.meta.editionSummary.previousEditionId}`));
      } else {
        expect(description).toMatch(/does not record whether a comparable earlier publication/i);
      }
    }

    const stories = items.filter((item) => item.querySelector("category")?.textContent === "Authored story");
    expect(stories.map((item) => item.querySelector("link")?.textContent)).toEqual([
      `${SITE_DISCOVERY.origin}/stories/household-budgets/`,
      `${SITE_DISCOVERY.origin}/stories/public-finances/`,
    ]);
    expect(stories.every((item) => item.querySelector("guid")?.textContent === item.querySelector("link")?.textContent)).toBe(true);
    expect(stories.map((item) => item.querySelector("pubDate")?.textContent)).toEqual([
      "Fri, 02 Oct 2026 16:37:38 GMT",
      "Fri, 02 Oct 2026 16:37:38 GMT",
    ]);
    expect(stories.every((item) => !item.textContent?.includes("Publication date not disclosed"))).toBe(true);
    expect(items.every((item) => Boolean(item.querySelector("title")?.textContent && item.querySelector("link")?.textContent && item.querySelector("guid")?.textContent && item.querySelector("description")?.textContent))).toBe(true);
    expect(new Set(items.map((item) => item.querySelector("guid")?.textContent)).size).toBe(items.length);
  });

  it("dates polling, debt and contract RSS entries from publisher records", () => {
    const snapshot = publicSnapshot(BUILD_METRICS_SNAPSHOT) as MetricsSnapshot;
    const document = new DOMParser().parseFromString(renderRssFeed(snapshot), "application/xml");
    const polling = snapshot.electionPolling as { latestPublicationDate?: string };
    const debt = snapshot.nationalDebt as { publicationDate?: string };
    const contracts = snapshot.governmentContracts as { awards?: Array<{ publishedAt?: string }> };
    const latestContractDate = contracts.awards
      ?.map((award) => award.publishedAt)
      .filter((date): date is string => Boolean(date))
      .map((date) => new Date(date).toISOString())
      .sort()
      .at(-1);

    for (const [sectionId, sourceDate] of [
      ["election-polls", polling.latestPublicationDate],
      ["national-debt", debt.publicationDate],
      ["government-contracts", latestContractDate],
    ] as const) {
      const item = [...document.querySelectorAll("channel > item")]
        .find((entry) => entry.querySelector("link")?.textContent === `${SITE_DISCOVERY.origin}/section/${sectionId}/`);

      expect(sourceDate, sectionId).toBeTruthy();
      expect(item?.querySelector("pubDate")?.textContent)
        .toBe(new Date(sourceDate!).toUTCString());
    }
  });

  it.each([
    [null, /no comparable earlier publication/i],
    ["catalog-prior", /no observation, revision, metadata or method changes.*catalog-prior/i],
    [undefined, /does not record whether a comparable earlier publication/i],
  ])("states the RSS baseline honestly when its identity is %s", (previousEditionId, expected) => {
    const snapshot = rssSnapshot();
    snapshot.meta.editionSummary = {
      ...snapshot.meta.editionSummary!,
      previousEditionId,
      changes: [],
    };
    const xml = renderRssFeed(snapshot);
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const edition = [...document.querySelectorAll("channel > item")]
      .find((item) => item.querySelector("category")?.textContent === "Evidence edition");

    expect(document.querySelector("parsererror")).toBeNull();
    expect(edition?.querySelector("description")?.textContent).toMatch(expected);
  });

  it("does not describe an edition as its own previous catalog", () => {
    const snapshot = rssSnapshot();
    snapshot.meta.editionSummary = {
      ...snapshot.meta.editionSummary!,
      id: "catalog-same",
      previousEditionId: "catalog-same",
      changes: [],
    };
    const xml = renderRssFeed(snapshot);
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const edition = [...document.querySelectorAll("channel > item")]
      .find((item) => item.querySelector("category")?.textContent === "Evidence edition");

    expect(document.querySelector("parsererror")).toBeNull();
    expect(edition?.querySelector("title")?.textContent).toContain("accepted edition is unchanged");
    expect(edition?.querySelector("description")?.textContent).toContain("The accepted edition is unchanged; no evidence changes were recorded.");
    expect(edition?.querySelector("description")?.textContent).not.toContain("previous catalog catalog-same");
  });

  it("describes metadata-only changes with both dated publisher links and no numeric delta", () => {
    const snapshot = rssSnapshot();
    snapshot.meta.editionSummary = {
      ...snapshot.meta.editionSummary!,
      changes: [{
        measureId: "inflation", kind: "metadata-change", observedAt: null, period: null,
        previousSourceEditionId: "ons-old", nextSourceEditionId: "ons-new",
        previousRevisionId: "revision-old", nextRevisionId: "revision-new",
        previousSourcePublishedAt: "2026-09-01T07:00:00.000Z", nextSourcePublishedAt: "2026-10-01T07:00:00.000Z",
        previousSourceUrl: "https://www.ons.gov.uk/prices/old", nextSourceUrl: "https://www.ons.gov.uk/prices/new",
        previousUnit: "%", nextUnit: "%", previous: null, next: null, changedFields: ["sourceUrl"],
      }],
    };
    const xml = renderRssFeed(snapshot);
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const edition = [...document.querySelectorAll("channel > item")]
      .find((item) => item.querySelector("category")?.textContent === "Evidence edition");
    const description = edition?.querySelector("description")?.textContent ?? "";

    expect(document.querySelector("parsererror")).toBeNull();
    expect(description).toContain("Source metadata changed (sourceUrl); no numeric change is inferred.");
    expect(description).toContain("2026-09-01 → 2026-10-01");
    expect(description).toContain("https://www.ons.gov.uk/prices/old");
    expect(description).toContain("https://www.ons.gov.uk/prices/new");
    expect(description).not.toContain("not previously reported → unavailable");
  });
});

// Exercise the enabled-publication behavior independently of the production pause.
vi.mock("@/config/publications.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{ default: { publications: Record<string, { enabled: boolean }> } }>();
  return { default: { ...config, publications: { ...Object.fromEntries(Object.entries(config.publications).map(([id, entry]) => [id, { ...entry, enabled: true }])), ons: { enabled: true } } } };
});
