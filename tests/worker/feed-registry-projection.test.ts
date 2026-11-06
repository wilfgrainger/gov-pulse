// @vitest-environment node
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import legacy from "@/tests/fixtures/registry/legacy-projections.json";
import { findDrift } from "@/scripts/generate-feed-projections.mjs";
import { defineFeed } from "@/feeds/define-feed.js";
import { FEEDS } from "@/feeds/index.js";
import {
  collectionPlan,
  downloadIds,
  feedCatalog,
  measureDefinitions,
  observationContracts,
  releaseFamilyGroups,
  routeManifest,
  sectionDiscovery,
} from "@/feeds/registry.js";
import { routeManifest as reExportedManifest } from "@/contracts/route-manifest.js";
import { FEED_CATALOG } from "@/contracts/source-catalog.js";
import { SECTION_COLLECTION_PLAN } from "@/worker/publication-plan.js";
import { OBSERVATION_CONTRACTS } from "@/worker/observation-contract.js";
import { SECTION_DOWNLOAD_IDS } from "@/app/lib/sectionDownloads";
import discovery from "@/contracts/section-discovery.json";
import measureFile from "@/contracts/measure-definitions.json";
import { definition as realWagesDefinition } from "@/feeds/real-wages/feed.js";

const plain = <T,>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const FEEDS_DIR = join(process.cwd(), "feeds");

describe("feed index", () => {
  it("lists every feeds/* folder", () => {
    const folders = readdirSync(FEEDS_DIR).filter(
      (name) => !name.startsWith("_") && statSync(join(FEEDS_DIR, name)).isDirectory() && existsSync(join(FEEDS_DIR, name, "feed.js")),
    );
    expect(FEEDS.map((feed) => feed.definition.slug).sort()).toEqual(folders.sort());
  });

  it("registers a collect function for every feed except static ones", () => {
    for (const feed of FEEDS) {
      if (feed.definition.automation === "static") expect(feed.collect, feed.definition.id).toBeUndefined();
      else expect(typeof feed.collect, feed.definition.id).toBe("function");
    }
  });

  it("has unique ids and slugs", () => {
    const ids = FEEDS.map((feed) => feed.definition.id);
    const slugs = FEEDS.map((feed) => feed.definition.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("defineFeed", () => {
  const base = plain(realWagesDefinition);

  it("accepts the real-wages definition and freezes it", () => {
    const frozen = defineFeed(base);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.validity)).toBe(true);
  });

  it("rejects missing validity", () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.validity;
    expect(() => defineFeed(rest)).toThrow(/validity/);
  });

  it("rejects validity without an observation window", () => {
    expect(() => defineFeed({ ...base, validity: { retrievalMaxAgeMs: 1000 } })).toThrow(/validity/);
  });

  it("rejects slug not kebab", () => {
    expect(() => defineFeed({ ...base, slug: "RealWages" })).toThrow(/slug/);
    expect(() => defineFeed({ ...base, slug: "real_wages" })).toThrow(/slug/);
  });

  it("rejects source id not in SOURCE_CATALOG", () => {
    expect(() => defineFeed({ ...base, sources: ["no-such-source"] })).toThrow(/unknown source/);
  });

  it("rejects an unknown requirement and a non-camel id", () => {
    expect(() => defineFeed({ ...base, requirement: "maybe" })).toThrow(/requirement/);
    expect(() => defineFeed({ ...base, id: "real-wages" })).toThrow(/id/);
  });

  it("does not carry publication state", () => {
    expect(() => defineFeed({ ...base, publication: "published" })).toThrow(/publication state/);
  });
});

type LegacyFamily = { familyIds: string[]; pattern: string; flags: string; exclude?: string; excludeFlags?: string };
const legacyDiscovery = legacy.sectionDiscovery as Record<string, { sourceKey: string }>;
const migrated = FEEDS.map((feed) => feed.definition);

describe("projection parity with the legacy hand-written registries", () => {
  it("projects at least the first migrated feed", () => {
    expect(migrated.map((def) => def.id)).toContain("realWages");
  });

  it.each(migrated.map((def) => [def.id, def]))("%s catalog entry equals legacy FEED_CATALOG", (id) => {
    const expected = (legacy.feedCatalog as Record<string, unknown>)[id as string];
    expect(plain(feedCatalog()[id as string])).toEqual(expected);
    expect(plain((FEED_CATALOG as Record<string, unknown>)[id as string])).toEqual(expected);
  });

  it("the whole live FEED_CATALOG is unchanged, in order", () => {
    expect(plain(FEED_CATALOG)).toEqual(legacy.feedCatalog);
    expect(Object.keys(FEED_CATALOG)).toEqual(Object.keys(legacy.feedCatalog));
  });

  it.each(migrated.map((def) => [def.id]))("%s collection plan equals legacy", (id) => {
    const expected = (legacy.collectionPlan as Record<string, unknown>)[id];
    expect(collectionPlan()[id] as unknown).toEqual(expected);
    expect(plain((SECTION_COLLECTION_PLAN as Record<string, unknown>)[id])).toEqual(expected);
  });

  it("the whole live collection plan is unchanged, in order", () => {
    expect(plain(SECTION_COLLECTION_PLAN)).toEqual(legacy.collectionPlan);
    expect(Object.keys(SECTION_COLLECTION_PLAN)).toEqual(Object.keys(legacy.collectionPlan));
  });

  it.each(migrated.map((def) => [def.id]))("%s observation contract keeps maxAgeDays and extractor name", (id) => {
    const expected = (legacy.observationContracts as Record<string, unknown>)[id];
    expect(observationContracts()[id]).toEqual(expected);
    const live = (OBSERVATION_CONTRACTS as Record<string, { maxAgeDays: number; extract: { name: string } }>)[id];
    if (expected === undefined) {
      expect(live).toBeUndefined();
      return;
    }
    expect({ maxAgeDays: live.maxAgeDays, extractor: live.extract.name }).toEqual(expected);
  });

  it("the live observation contracts keep the legacy ids and order", () => {
    expect(Object.keys(OBSERVATION_CONTRACTS)).toEqual(Object.keys(legacy.observationContracts));
  });

  it.each(migrated.filter((def) => def.discovery).map((def) => [def.id, def.slug]))("%s section discovery equals legacy", (id, slug) => {
    const expected = (legacy.sectionDiscovery as Record<string, unknown>)[slug as string];
    expect((legacyDiscovery[slug as string] as { sourceKey: string }).sourceKey).toBe(id);
    expect(plain(sectionDiscovery()[slug as string])).toEqual(expected);
    expect(plain((discovery.sections as Record<string, unknown>)[slug as string])).toEqual(expected);
  });

  it.each(migrated.map((def) => [def.id]))("%s measure definitions equal legacy", (id) => {
    const expected = legacy.measureDefinitions.filter((m: { section: string }) => m.section === id);
    expect(plain(measureDefinitions().filter((m: { section: string }) => m.section === id))).toEqual(expected);
    expect(plain(measureFile.measures.filter((m) => m.section === id))).toEqual(expected);
  });

  it("download ids keep the legacy list and order", () => {
    expect([...SECTION_DOWNLOAD_IDS]).toEqual(legacy.downloadIds);
    const declared = downloadIds();
    expect([...SECTION_DOWNLOAD_IDS].filter((id) => declared.includes(id))).toEqual(declared);
  });

  it("release families equal the legacy ONS release-calendar families", () => {
    const describeFamily = (family: { familyIds: string[]; pattern: string; flags: string; exclude?: string; excludeFlags?: string }) =>
      JSON.stringify([family.pattern, family.flags, family.exclude ?? null, family.excludeFlags ?? null, family.familyIds]);
    const actual = releaseFamilyGroups()
      .map((family) =>
        describeFamily({
          familyIds: family.familyIds,
          pattern: family.pattern.source,
          flags: family.pattern.flags,
          ...(family.exclude ? { exclude: family.exclude.source, excludeFlags: family.exclude.flags } : {}),
        }),
      )
      .sort();
    const expected = (legacy.releaseFamilies as LegacyFamily[]).map(describeFamily).sort();
    expect(actual).toEqual(expected);
  });

  it.each([
    ["GDP monthly estimate, UK: May 2026", ["gdpTracker"]],
    ["GDP monthly estimate, UK: time series", []],
    ["Consumer price inflation, UK: June 2026", ["inflation"]],
    ["UK Labour Market: July 2026", ["employmentStats", "realWages"]],
    ["Average weekly earnings in Great Britain: July 2026", ["realWages"]],
    ["Public sector finances, UK: June 2026", ["nationalDebt", "taxRevenue"]],
    ["Private rent and house prices, UK: June 2026", ["housePriceIndex"]],
    ["Long-term international migration, provisional: year ending December 2025", ["migrationStats"]],
    ["Crime in England and Wales: year ending March 2026", ["crimeStatistics"]],
    ["Something else entirely", []],
  ])("release title %j maps to %j exactly as the legacy first-match list did", (title, expected) => {
    const legacyMatch = (legacy.releaseFamilies as LegacyFamily[]).find(
      (family) => new RegExp(family.pattern, family.flags).test(title) && !(family.exclude && new RegExp(family.exclude, family.excludeFlags).test(title)),
    );
    const projected = releaseFamilyGroups().find((family) => family.pattern.test(title) && !family.exclude?.test(title));
    expect(legacyMatch?.familyIds ?? []).toEqual(expected);
    expect(projected?.familyIds ?? []).toEqual(expected);
  });

  it("route manifest equals the manifest captured before the migration", () => {
    expect(plain(routeManifest())).toEqual(legacy.routeManifest);
    expect(reExportedManifest).toBe(routeManifest);
  });
});

describe("projection drift check", () => {
  it("reports no drift between feeds/ and the checked-in contracts", () => {
    expect(findDrift()).toEqual([]);
  });
});
