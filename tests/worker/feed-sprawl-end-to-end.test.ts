// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { addProbeFeed, copyRepo, probeJson, regenerateProjections } from "./feed-probe";

const root = process.cwd();

// Every layer a new feed reaches: the route manifest, the sitemap's section list
// and its serve filter, the collection schedule and the page gate.
const LAYERS = `
  import { routeManifest } from "./feeds/registry.js";
  import { gateRouteWith } from "./contracts/route-manifest.js";
  import { dueFeeds } from "./worker/pipeline.js";
  import discovery from "./contracts/section-discovery.json" with { type: "json" };
  const now = new Date("2026-11-09T12:00:00.000Z");
  const paths = new Set(routeManifest().map((entry) => entry.path));
  console.log(JSON.stringify({
    routes: ["/section/probe-feed/", "/data/sections/probeFeed.json", "/data/sections/probeFeed.csv"].filter((path) => paths.has(path)),
    sitemapSource: Object.hasOwn(discovery.sections, "probe-feed"),
    sectionAccess: gateRouteWith("/section/probe-feed/", now).access,
    downloadAccess: gateRouteWith("/data/sections/probeFeed.json", now).access,
    dueDaily: dueFeeds(now, "daily").includes("probeFeed"),
  }));
`;

describe("feed sprawl", () => {
  const work = mkdtempSync(join(tmpdir(), "feed-sprawl-e2e-"));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it("probe feed is registered everywhere and held everywhere", () => {
    copyRepo(root, work);
    addProbeFeed(work);
    regenerateProjections(work);
    const configPath = join(work, "config/publications.json");
    const setDecision = (state: string) => {
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      config.publications.probeFeed = { state };
      writeFileSync(configPath, JSON.stringify(config));
    };

    // New feed, no publication decision (G1): registered for discovery and downloads,
    // but its page is not routed, nothing serves and nothing is collected.
    expect(probeJson(work, LAYERS)).toEqual({
      routes: ["/data/sections/probeFeed.json", "/data/sections/probeFeed.csv"],
      sitemapSource: true,
      sectionAccess: "not-found",
      downloadAccess: expect.not.stringMatching(/^serve$/),
      dueDaily: false,
    });

    // A held decision routes the page as an unavailable notice. The sitemap lists a
    // section only when its route serves (app/lib/sitemapEntries.ts), so it stays out.
    setDecision("held");
    expect(probeJson(work, LAYERS)).toEqual({
      routes: ["/section/probe-feed/", "/data/sections/probeFeed.json", "/data/sections/probeFeed.csv"],
      sitemapSource: true,
      sectionAccess: "unavailable",
      downloadAccess: expect.not.stringMatching(/^serve$/),
      dueDaily: false,
    });

    // Published, every layer opens, so the holds above are real gates.
    setDecision("published");
    expect(probeJson(work, LAYERS)).toMatchObject({ sectionAccess: "serve", downloadAccess: "serve", dueDaily: true });
  }, 60_000);
});
