// Per-page evidence: each route embeds only the feeds it renders
// (app/lib/routeEvidence.js), so a hold or expiry affects only that route.
import fs from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/publication/current-snapshot.json";
import { DEFINITIONS } from "@/feeds/definitions.generated.js";
import { PUBLICATION_CONFIG } from "@/contracts/evidence-policy";
import { evidenceValuesByFeed } from "@/app/lib/editionManifest";
import { publicationStatusSnapshot, routeEvidenceFeeds, routeForEmittedFile, snapshotForRoute } from "@/app/lib/routeEvidence";
import { MetricsSnapshotProvider } from "@/app/lib/MetricsSnapshotProvider";
import { createClientMetricsSnapshot, type MetricsSnapshot } from "@/app/lib/metricsSnapshot";
import { healthReportFromSnapshot } from "@/app/lib/usePublicationHealth";
import { selectNationalEvidenceEdition } from "@/app/lib/nationalEvidence";
import { measureForDisplay } from "@/app/lib/measureCatalog";
import NationalDebtCounter from "@/app/components/NationalDebtCounter";
import GDPTracker from "@/app/components/GDPTracker";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const full = structuredClone(fixture) as unknown as MetricsSnapshot;
type Loose = Record<string, unknown> & { meta: Record<string, unknown> & { sources: Record<string, unknown> } };

function withChanges(): Loose {
  const snapshot = structuredClone(fixture) as unknown as Loose;
  const change = (measureId: string) => ({
    measureId, kind: "new-observation", observedAt: "2026-09-30", period: "2026 SEP",
    previousSourceEditionId: null, nextSourceEditionId: `ed-${measureId}`, previousRevisionId: null, nextRevisionId: `rev-${measureId}`,
    previous: null, next: 1,
  });
  (snapshot.meta.editionSummary as { changes: unknown[] }).changes = [change("debt-ratio"), change("gdp-monthlyGrowth")];
  return snapshot;
}

describe("route evidence declaration", () => {
  it("derives each route's feeds from the route manifest, routes.json evidence and story measures", () => {
    expect(routeEvidenceFeeds("/section/national-debt/")).toEqual(["nationalDebt"]);
    expect(routeEvidenceFeeds("/section/house-price-index/")).toEqual(["housePriceIndex", "realWages"]);
    expect(routeEvidenceFeeds("/measure/inflation/")).toEqual(["sentimentPulse"]);
    expect(routeEvidenceFeeds("/data/sections/gdpTracker.csv")).toEqual(["gdpTracker"]);
    expect(routeEvidenceFeeds("/sources/governmentContracts/")).toEqual(["governmentContracts"]);
    expect(routeEvidenceFeeds("/money/supplier/abc/")).toEqual(["governmentContracts"]);
    expect(routeEvidenceFeeds("/stories/public-finances/")).toEqual(["gdpTracker", "nationalDebt", "storyPublicFinances", "taxRevenue"]);
    expect(routeEvidenceFeeds("/")).not.toContain("gdpTracker");
    for (const path of ["/explore/", "/measure/", "/compare/", "/briefing/", "/calendar/", "/feed.xml", "/sitemap.xml"]) {
      expect(routeEvidenceFeeds(path), path).toBe("all");
    }
    expect(routeEvidenceFeeds("/about/")).toEqual([]);
    expect(routeEvidenceFeeds("/no-such-route/")).toEqual([]);
  });

  it("covers every feed a section view reads", () => {
    for (const def of DEFINITIONS as { slug: string; view?: string }[]) {
      if (!def.view) continue;
      const source = fs.readFileSync(`app/components/${def.view}.tsx`, "utf8");
      const read = [...source.matchAll(/useMetrics\("(\w+)"/g)].map((match) => match[1]);
      const declared = routeEvidenceFeeds(`/section/${def.slug}/`);
      for (const feed of read) expect(declared, `${def.view} reads ${feed}`).toContain(feed);
    }
  });

  it("maps emitted files to their route", () => {
    expect(routeForEmittedFile("index.html")).toBe("/");
    expect(routeForEmittedFile("__next._full.txt")).toBe("/");
    expect(routeForEmittedFile("section/gdp/__next.section.$d$id.__PAGE__.txt")).toBe("/section/gdp/");
    expect(routeForEmittedFile("measure/inflation/index.txt")).toBe("/measure/inflation/");
    expect(routeForEmittedFile("data/sections/gdpTracker.json")).toBe("/data/sections/gdpTracker.json");
  });
});

describe("snapshotForRoute", () => {
  it("restricts sections, sources, catalogue measures and edition changes to the route's feeds", () => {
    const projected = snapshotForRoute(withChanges(), "/section/national-debt/") as Loose;
    expect(Object.keys(projected).sort()).toEqual(["meta", "nationalDebt"]);
    expect(Object.keys(projected.meta.sources)).toEqual(["nationalDebt"]);
    expect(Object.keys((projected.meta.measureCatalog as { measures: object }).measures).sort()).toEqual(["debt-ratio", "debt-stock"]);
    const summary = projected.meta.editionSummary as { changes: { measureId: string }[]; sourceEditionIds: string[] };
    expect(summary.changes.map((change) => change.measureId)).toEqual(["debt-ratio"]);
    expect(summary.sourceEditionIds).toEqual(["ed-debt-ratio"]);
    expect((projected.meta.publicProjection as { publishedSections: string[] }).publishedSections).toEqual(["nationalDebt"]);
  });

  it("keeps every published feed for an all-feeds route", () => {
    const projected = snapshotForRoute(withChanges(), "/explore/") as Loose;
    expect(Object.keys(projected.meta.sources).sort()).toEqual(["gdpTracker", "nationalDebt"]);
    expect((projected.meta.editionSummary as { changes: unknown[] }).changes).toHaveLength(2);
  });

  it("never includes a held feed, even on an all-feeds route", () => {
    const config = { publications: { ...PUBLICATION_CONFIG.publications, gdpTracker: { state: "held" } } } as typeof PUBLICATION_CONFIG;
    for (const path of ["/explore/", "/section/gdp/", "/measure/gdp-monthlyGrowth/", "/stories/public-finances/"]) {
      const projected = snapshotForRoute(withChanges(), path, config) as Loose;
      const text = JSON.stringify(projected);
      expect(projected.gdpTracker, path).toBeUndefined();
      expect(projected.meta.sources.gdpTracker, path).toBeUndefined();
      expect(text, path).not.toContain("gdp-monthlyGrowth");
    }
  });

  it("keeps an empty edition shell when the route's feeds are absent, so pages show their unavailable state", () => {
    const projected = snapshotForRoute(full, "/section/crime-stats/") as Loose;
    expect(projected.meta.sources).toEqual({});
    expect(Object.keys(projected)).toEqual(["meta"]);
    expect(snapshotForRoute(null, "/section/gdp/")).toBeNull();
  });

  it("embeds no evidence value from an undeclared feed", () => {
    const byFeed = evidenceValuesByFeed(fixture);
    let checked = 0;
    for (const path of ["/", "/section/national-debt/", "/section/gdp/", "/measure/debt-ratio/", "/section/election-polls/", "/cost-of-living/"]) {
      const declared = routeEvidenceFeeds(path);
      const text = JSON.stringify(snapshotForRoute(full, path));
      for (const [feed, values] of Object.entries(byFeed)) {
        if (declared === "all" || declared.includes(feed)) continue;
        const others = new Set(Object.entries(byFeed).filter(([id]) => id !== feed).flatMap(([, list]) => list));
        const own = values.filter((value) => !others.has(value));
        // Poll shares are small integers, too common to scan for; GDP and debt values are distinctive.
        if (own.length > 0) checked += 1;
        expect(own.filter((value) => text.includes(value)), `${path} carries ${feed}`).toEqual([]);
      }
    }
    expect(checked).toBeGreaterThan(6);
  });

  it("global chrome gets status and check times only, and the same freshness report", () => {
    const status = publicationStatusSnapshot(full) as Loose;
    expect(Object.keys(status)).toEqual(["meta"]);
    expect(Object.keys(status.meta.sources).sort()).toEqual(["electionPolling", "gdpTracker", "nationalDebt"]);
    expect(evidenceValuesByFeed(full).nationalDebt.some((value) => JSON.stringify(status).includes(value))).toBe(false);
    expect(healthReportFromSnapshot(status as never)).toEqual(healthReportFromSnapshot(full));
  });
});

describe("rendered evidence is unchanged for current evidence", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  function markup(view: () => React.ReactNode, snapshot: MetricsSnapshot | null) {
    const { container, unmount } = render(<MetricsSnapshotProvider snapshot={createClientMetricsSnapshot(snapshot)}>{view()}</MetricsSnapshotProvider>);
    const html = container.innerHTML;
    unmount();
    return html;
  }

  it("section pages render the same markup from the projected snapshot", () => {
    for (const [path, View] of [["/section/national-debt/", NationalDebtCounter], ["/section/gdp/", GDPTracker]] as const) {
      const before = markup(() => <View />, full);
      expect(before, path).not.toEqual(markup(() => <View />, null));
      expect(markup(() => <View />, snapshotForRoute(full, path)), path).toEqual(before);
    }
  });

  it("the home page selects the same national evidence edition", () => {
    const before = selectNationalEvidenceEdition(full, NOW);
    expect(before.counts.current).toBeGreaterThan(0);
    expect(selectNationalEvidenceEdition(snapshotForRoute(full, "/"), NOW)).toEqual(before);
  });

  it("a measure page displays the same record and source", () => {
    for (const id of ["debt-ratio", "gdp-monthlyGrowth"]) {
      const projected = snapshotForRoute(full, `/measure/${id}/`)!;
      const before = measureForDisplay(full.meta.measureCatalog, id, NOW);
      expect(before, id).not.toBeNull();
      expect(measureForDisplay(projected.meta.measureCatalog, id, NOW)).toEqual(before);
      expect(projected.meta.measureCatalog?.editionId).toEqual(full.meta.measureCatalog?.editionId);
    }
  });
});
