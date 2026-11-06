// @vitest-environment node
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ROUTES from "@/contracts/routes.json";
import PUBLICATION_CONFIG from "@/config/publications.json";
import PRODUCT_CAPABILITIES from "@/config/product-capabilities.json";
import definitions from "@/contracts/measure-definitions.json";
import { FEED_CATALOG } from "@/contracts/source-catalog.js";
import { gateRouteWith, routeManifest } from "@/contracts/route-manifest.js";
import { gateRoute, routeServes } from "@/app/lib/gateRoute";
import { SECTION_DOWNLOAD_IDS } from "@/app/lib/sectionDownloads";

const ROOT = process.cwd();
const NOW = new Date("2026-11-06T12:00:00Z");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

// app/(publication)/[trust]/page.tsx -> /[trust]/ ; app/sitemap.ts -> /sitemap.xml
function routePathOf(file: string): string {
  const rel = file.slice(join(ROOT, "app").length + 1).replaceAll("\\", "/");
  if (rel === "sitemap.ts") return "/sitemap.xml";
  if (rel === "robots.ts") return "/robots.txt";
  const dir = rel.replace(/\/?(page\.tsx|route\.ts)$/, "").split("/").filter((s) => !/^\(.*\)$/.test(s));
  const last = dir.at(-1) ?? "";
  return `/${dir.join("/")}${last.includes(".") ? "" : "/"}`.replace(/^\/\/$/, "/");
}

function patternMatches(filePattern: string, entryPath: string): boolean {
  const a = filePattern.split("/").filter(Boolean);
  const b = entryPath.split("/").filter(Boolean);
  return a.length === b.length && a.every((seg, i) => /^\[.+\]$/.test(seg) || seg === b[i]);
}

describe("route manifest", () => {
  it("every app route file has a manifest entry", () => {
    const files = walk(join(ROOT, "app")).filter((f) => /(\/|\\)(page\.tsx|route\.ts)$/.test(f) || /app(\/|\\)(sitemap|robots)\.ts$/.test(f));
    expect(files.length).toBeGreaterThan(15);
    const manifest = routeManifest();
    const missing = files.map(routePathOf).filter((p) => !manifest.some((entry) => patternMatches(p, entry.path)));
    expect(missing).toEqual([]);
  });

  it("section routes are derived from the feed catalogue, not routes.json", () => {
    const manifest = routeManifest();
    for (const [id, entry] of Object.entries(PUBLICATION_CONFIG.publications) as [string, { sections?: string[] }][]) {
      for (const slug of entry.sections ?? []) {
        const route = manifest.find((r) => r.path === `/section/${slug}/`);
        expect(route, slug).toMatchObject({ feeds: [id], gate: "any-published", kind: "evidence" });
      }
    }
    for (const id of Object.entries(FEED_CATALOG).filter(([, f]) => f.registry === "feed").map(([k]) => k)) {
      for (const ext of ["json", "csv"]) {
        expect(manifest.find((r) => r.path === `/data/sections/${id}.${ext}`), `${id}.${ext}`).toMatchObject({ feeds: [id], kind: "api" });
      }
    }
    for (const id of SECTION_DOWNLOAD_IDS) {
      expect(manifest.some((r) => r.path === `/data/sections/${id}.json`), id).toBe(true);
    }
    const paths = (ROUTES.routes as { path: string }[]).map((r) => r.path);
    expect(paths.filter((p) => p.startsWith("/section/") || p.startsWith("/data/sections/"))).toEqual([]);
  });

  it("every entry has a known kind and gate and only references configured publications", () => {
    for (const entry of routeManifest()) {
      expect(["static", "evidence", "api"]).toContain(entry.kind);
      expect(["none", "any-published", "all-of", "product"]).toContain(entry.gate);
      for (const feed of entry.feeds) expect(Object.hasOwn(PUBLICATION_CONFIG.publications, feed), `${entry.path} -> ${feed}`).toBe(true);
    }
  });
});

const allHeld = {
  ...PUBLICATION_CONFIG,
  publications: Object.fromEntries(
    Object.entries(PUBLICATION_CONFIG.publications).map(([id, d]) => [id, { ...d, state: "held" }]),
  ),
};

describe("gateRoute", () => {
  it("held-only evidence route is unavailable not 404", () => {
    const held = gateRouteWith("/section/national-debt/", NOW, { config: allHeld });
    expect(held).toEqual({ access: "unavailable", heldFeeds: ["nationalDebt"] });
    expect(gateRouteWith("/section/national-debt/", NOW)).toEqual({ access: "serve", heldFeeds: [] });
    expect(gateRoute("/section/nhs/")).toEqual({ access: "unavailable", heldFeeds: ["nhsStats"] });
  });

  it("unknown path is not-found", () => {
    expect(gateRoute("/no-such-page/").access).toBe("not-found");
    expect(gateRoute("/section/not-a-section/").access).toBe("not-found");
    expect(gateRoute("/data/sections/unknown.json").access).toBe("not-found");
    expect(gateRoute("/constructor/").access).toBe("not-found");
  });

  it("missing evidence is unavailable, never served", () => {
    expect(gateRoute("/measure/not-a-measure/").access).toBe("unavailable");
    expect(gateRoute("/stories/not-a-story/").access).toBe("unavailable");
    expect(gateRoute("/data/sections/nhsStats.csv")).toEqual({ access: "unavailable", heldFeeds: ["nhsStats"] });
  });

  it("a product capability that is off makes a published route unavailable without naming a held feed", () => {
    const caps = { ...PRODUCT_CAPABILITIES, capabilities: { ...PRODUCT_CAPABILITIES.capabilities, editionArchive: { available: false } } };
    expect(gateRouteWith("/editions/", NOW, { capabilities: caps })).toEqual({ access: "unavailable", heldFeeds: [] });
  });

  it("strips query and trailing slash", () => {
    expect(gateRoute("/section/national-debt?x=1").access).toBe("serve");
    expect(gateRoute("/section/national-debt").access).toBe("serve");
  });
});

// Frozen copy of the pre-manifest publicRouteAvailable, used as the parity oracle.
type Cfg = typeof PUBLICATION_CONFIG;
function oracle(path: string, cfg: Cfg, caps: typeof PRODUCT_CAPABILITIES): boolean {
  const published = (id: string) => (cfg.publications as Record<string, { state: string }>)[id]?.state === "published";
  const cap = (id: string) => (caps.capabilities as Record<string, { available?: boolean }>)[id]?.available === true;
  const sectionPublication = (id: string) =>
    Object.entries(cfg.publications as Record<string, { sections?: string[] }>).find(([, e]) => e.sections?.includes(id))?.[0] ?? "";
  const parts = path.split("?")[0].replace(/\/$/, "").split("/").filter(Boolean);
  if (parts.length === 0) return cap("home");
  if (parts[0] === "section") return published(sectionPublication(parts[1]));
  if (parts[0] === "money") return cap("publicMoney") && published("governmentContracts");
  if (parts[0] === "editions") return cap("editionArchive") && published("editionArchive");
  if (parts[0] === "stories") {
    const id = ({ "household-budgets": "storyHouseholdBudgets", "public-finances": "storyPublicFinances" } as Record<string, string>)[parts[1]] ?? "";
    return cap(id) && published(id);
  }
  if (parts[0] === "measure" && parts[1]) {
    return published((definitions.measures as { id: string; section: string }[]).find((m) => m.id === parts[1])?.section ?? "");
  }
  if (parts[0] === "sources" && parts[1]) return cap("sources") && published(parts[1]);
  if (parts[0] === "calendar") return cap("calendar") && (published("releaseCalendar") || published("nhsReleaseCalendar"));
  const generic = ({ explore: "explore", measure: "measureLibrary", compare: "compare", briefing: "briefing", "cost-of-living": "costOfLiving", sources: "sources" } as Record<string, string>)[parts[0]];
  return generic ? cap(generic) : true;
}

describe("gateRoute parity with the legacy route resolver", () => {
  const publicationIds = Object.keys(PUBLICATION_CONFIG.publications);
  const sections = publicationIds.flatMap((id) => (PUBLICATION_CONFIG.publications as Record<string, { sections?: string[] }>)[id].sections ?? []);
  const paths = [
    "/", "/explore/", "/measure/", "/compare/", "/briefing/", "/cost-of-living/", "/sources/", "/calendar/", "/money/", "/editions/",
    "/feed.xml", "/about/", "/editorial-policy/", "/independence/", "/contact/", "/corrections/",
    "/editions/some-id/", "/money/buyer/x/", "/money/supplier/x/",
    "/stories/household-budgets/", "/stories/public-finances/", "/stories/unknown/",
    "/measure/unknown-measure/", "/sources/unknown-source/",
    ...sections.map((s) => `/section/${s}/`),
    ...publicationIds.map((id) => `/sources/${id}/`),
    ...Object.keys(FEED_CATALOG).map((id) => `/sources/${id}/`),
    ...(definitions.measures as { id: string }[]).map((m) => `/measure/${m.id}/`),
  ];
  const allCaps = { ...PRODUCT_CAPABILITIES, capabilities: Object.fromEntries(Object.keys(PRODUCT_CAPABILITIES.capabilities).map((k) => [k, { available: true }])) };
  const noCaps = { ...PRODUCT_CAPABILITIES, capabilities: Object.fromEntries(Object.keys(PRODUCT_CAPABILITIES.capabilities).map((k) => [k, { available: false }])) };
  const allPublished = { ...PUBLICATION_CONFIG, publications: Object.fromEntries(publicationIds.map((id) => [id, { ...(PUBLICATION_CONFIG.publications as Record<string, object>)[id], state: "published" }])) } as Cfg;
  const onePublished = publicationIds.map((only) => ({
    ...PUBLICATION_CONFIG,
    publications: Object.fromEntries(publicationIds.map((id) => [id, { ...(PUBLICATION_CONFIG.publications as Record<string, object>)[id], state: id === only ? "published" : "held" }])),
  })) as Cfg[];
  const configs: [string, Cfg][] = [["default", PUBLICATION_CONFIG], ["all held", allHeld as Cfg], ["all published", allPublished], ...onePublished.map((c, i) => [`only ${publicationIds[i]}`, c] as [string, Cfg])];

  it("serves exactly the paths the legacy resolver served", () => {
    const diffs: string[] = [];
    for (const [name, cfg] of configs) {
      for (const [capName, caps] of [["default", PRODUCT_CAPABILITIES], ["all on", allCaps], ["all off", noCaps]] as const) {
        for (const path of paths) {
          const served = gateRouteWith(path, NOW, { config: cfg, capabilities: caps }).access === "serve";
          if (served !== oracle(path, cfg, caps)) diffs.push(`${name}/${capName}: ${path}`);
        }
      }
    }
    expect(diffs).toEqual([]);
  });

  it("routeServes uses production config", () => {
    expect(routeServes("/calendar/")).toBe(false);
    expect(routeServes("/compare/")).toBe(true);
  });
});
