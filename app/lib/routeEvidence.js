// Which feeds' evidence each route embeds, and the snapshot projected to them.
// The one place pages (server rendering, OpenNext and the static export) and
// the edition build (scripts/build-edition-site.mjs, manifest `feeds`) agree on
// a route's evidence. Isomorphic and dependency-free so the build can import it.
//
// Derived, not re-declared:
// - section, measure, source, money, calendar, edition and download routes: the
//   route manifest `feeds` (feeds/registry.js, contracts/routes.json);
// - story routes: the story's `measureIds` mapped through measure-definitions `section`;
// - product routes (home, explore, compare...): `evidence` in contracts/routes.json,
//   a feed list or "all" for routes that show every published measure.
import definitions from "../../contracts/measure-definitions.json" with { type: "json" };
import { matchRoute, normalizePath } from "../../contracts/route-manifest.js";
import { PUBLICATION_CONFIG, filterPublicationSnapshot, publicationPublished } from "../../contracts/evidence-policy.js";
import householdStory from "../content/stories/household-budgets.js";
import financeStory from "../content/stories/public-finances.js";

/** Section views that also read a second feed (useMetrics calls); tests/unit/route-evidence.test.ts checks this against the components. */
const SECTION_VIEW_ALSO_READS = Object.freeze({ housePriceIndex: ["realWages"] });

const MEASURE_SECTION = new Map(definitions.measures.map((measure) => [measure.id, measure.section]));
const STORY_FEEDS = new Map([householdStory, financeStory].map((story) => [
  `/stories/${story.slug}`,
  story.measureIds.map((id) => MEASURE_SECTION.get(id)).filter(Boolean),
]));

/**
 * Feeds whose evidence a route renders: a sorted feed-id list, or "all" (every
 * published feed in the edition). Unknown paths render no evidence.
 * @param {string} path
 * @param {import("../../contracts/evidence-policy.js").PublicationConfig} [config]
 * @returns {string[] | "all"}
 */
export function routeEvidenceFeeds(path, config = PUBLICATION_CONFIG) {
  const entry = matchRoute(path, config);
  if (!entry) return [];
  if (entry.evidence === "all") return "all";
  const feeds = [
    ...entry.feeds,
    ...(Array.isArray(entry.evidence) ? entry.evidence : []),
    ...(STORY_FEEDS.get(normalizePath(path)) ?? []),
    ...(entry.path.startsWith("/section/") ? entry.feeds.flatMap((id) => SECTION_VIEW_ALSO_READS[id] ?? []) : []),
  ];
  return [...new Set(feeds)].sort();
}

/**
 * The feeds of `available` (the edition's published feeds) that a route embeds.
 * @param {string} path @param {string[]} available
 */
export function embeddedFeedsForRoute(path, available, config = PUBLICATION_CONFIG) {
  const declared = routeEvidenceFeeds(path, config);
  return available.filter((id) => declared === "all" || declared.includes(id)).sort();
}

/**
 * The route a statically exported file belongs to: "section/gdp/index.html",
 * "section/gdp/__next._full.txt" -> "/section/gdp/"; "feed.xml" -> "/feed.xml".
 * @param {string} file output-relative path
 */
export function routeForEmittedFile(file) {
  const page = /^(?:(.*)\/)?(?:index\.(?:html|txt)|__next\.[^/]*\.txt)$/.exec(file);
  if (page) return page[1] ? `/${page[1]}/` : "/";
  return `/${file}`;
}

/**
 * The snapshot projected to one route's feeds: sections, `meta.sources`,
 * verified sections, catalogue measures and edition-summary changes of other
 * feeds are removed. It reuses filterPublicationSnapshot with a configuration
 * narrowed to the route, so a feed held by the real configuration can never be
 * included. A route whose feeds are all absent keeps an empty edition shell, so
 * pages show their existing "section unavailable" state.
 *
 * @template {{ meta: Record<string, any> } & Record<string, any>} T
 * @param {T | null | undefined} snapshot a publication-filtered snapshot
 * @param {string} path
 * @returns {T | null}
 */
export function snapshotForRoute(snapshot, path, config = PUBLICATION_CONFIG) {
  if (!snapshot?.meta?.sources) return null;
  const feeds = embeddedFeedsForRoute(path, Object.keys(snapshot.meta.sources), config);
  const allowed = [...feeds, "editionArchive"].filter((id) => publicationPublished(id, config));
  const narrowed = { publications: Object.fromEntries(allowed.map((id) => [id, config.publications[id]])) };
  const projected = filterPublicationSnapshot(snapshot, narrowed);
  if (projected) return /** @type {T} */ (projected);
  const meta = snapshot.meta;
  return /** @type {T} */ ({
    meta: {
      registryVersion: meta.registryVersion,
      generatedAt: meta.generatedAt,
      sources: {},
      verifiedSections: [],
      measureCatalog: meta.measureCatalog ? { ...meta.measureCatalog, measures: {} } : null,
      publicProjection: { state: "published", publishedSections: [] },
    },
  });
}

/**
 * Global chrome (the navigation freshness indicator) needs only each feed's
 * status and check time, never evidence values.
 * @template {{ meta: Record<string, any> }} T
 * @param {T | null | undefined} snapshot
 * @returns {T | null}
 */
export function publicationStatusSnapshot(snapshot) {
  if (!snapshot?.meta?.sources) return null;
  const sources = Object.fromEntries(Object.entries(snapshot.meta.sources).map(([id, source]) => [
    id,
    { status: source?.status, ...(typeof source?.fetchedAt === "string" ? { fetchedAt: source.fetchedAt } : {}) },
  ]));
  return /** @type {T} */ ({
    meta: { registryVersion: snapshot.meta.registryVersion, generatedAt: snapshot.meta.generatedAt, sources },
  });
}
