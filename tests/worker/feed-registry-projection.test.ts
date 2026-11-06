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
  releaseFamilies,
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

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const FEEDS_DIR = join(process.cwd(), "feeds");

describe("feed index", () => {
  it("lists every feeds/* folder", () => {
    const folders = readdirSync(FEEDS_DIR).filter(
      (name) => !name.startsWith("_") && statSync(join(FEEDS_DIR, name)).isDirectory() && existsSync(join(FEEDS_DIR, name, "feed.js")),
    );
    expect(FEEDS.map((feed) => feed.definition.slug).sort()).toEqual(folders.sort());
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

describe("projection parity with the legacy hand-written registries (realWages)", () => {
  it("catalog entry equals legacy FEED_CATALOG.realWages", () => {
    expect(plain(feedCatalog().realWages)).toEqual(legacy.feedCatalog.realWages);
    expect(plain(FEED_CATALOG.realWages)).toEqual(legacy.feedCatalog.realWages);
  });

  it("the whole live FEED_CATALOG is unchanged", () => {
    expect(plain(FEED_CATALOG)).toEqual(legacy.feedCatalog);
  });

  it("collection plan equals legacy", () => {
    expect(plain(collectionPlan().realWages)).toEqual(legacy.collectionPlan.realWages);
    expect(plain(SECTION_COLLECTION_PLAN)).toEqual(legacy.collectionPlan);
    expect(Object.keys(SECTION_COLLECTION_PLAN)).toEqual(Object.keys(legacy.collectionPlan));
  });

  it("observation contract keeps maxAgeDays and extractor name", () => {
    expect(observationContracts().realWages).toEqual(legacy.observationContracts.realWages);
    const live = OBSERVATION_CONTRACTS.realWages;
    expect({ maxAgeDays: live.maxAgeDays, extractor: live.extract.name }).toEqual(legacy.observationContracts.realWages);
    expect(Object.keys(OBSERVATION_CONTRACTS)).toEqual(Object.keys(legacy.observationContracts));
  });

  it("section discovery equals legacy", () => {
    expect(plain(sectionDiscovery()["real-wages"])).toEqual((legacy.sectionDiscovery as Record<string, unknown>)["real-wages"]);
    expect(plain((discovery.sections as Record<string, unknown>)["real-wages"])).toEqual(
      plain(sectionDiscovery()["real-wages"]),
    );
  });

  it("measure definitions equal legacy", () => {
    const expected = legacy.measureDefinitions.filter((m: { section: string }) => m.section === "realWages");
    expect(expected).toHaveLength(2);
    expect(plain(measureDefinitions())).toEqual(expected);
    expect(plain(measureFile.measures.filter((m) => m.section === "realWages"))).toEqual(expected);
  });

  it("download ids keep the legacy list and order", () => {
    expect(downloadIds()).toEqual(["realWages"]);
    expect([...SECTION_DOWNLOAD_IDS]).toEqual(legacy.downloadIds);
  });

  it("release families equal the legacy realWages families", () => {
    const expected = legacy.releaseFamilies
      .filter((family: { familyIds: string[] }) => family.familyIds.includes("realWages"))
      .map((family: { pattern: string; flags: string; exclude?: string; excludeFlags?: string }) => ({
        pattern: family.pattern,
        flags: family.flags,
        ...(family.exclude ? { exclude: family.exclude, excludeFlags: family.excludeFlags } : {}),
      }));
    const actual = releaseFamilies().map((family) => ({
      pattern: family.pattern.source,
      flags: family.pattern.flags,
      ...(family.exclude ? { exclude: family.exclude.source, excludeFlags: family.exclude.flags } : {}),
    }));
    expect(actual).toEqual(expected);
    expect(releaseFamilies().every((family) => family.feedId === "realWages")).toBe(true);
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
