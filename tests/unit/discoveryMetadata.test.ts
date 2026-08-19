import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_SOURCES } from "@/app/lib/config";
import {
  PUBLIC_SECTION_IDS,
  SECTION_DISCOVERY,
  SITE_DISCOVERY,
  absoluteUrl,
  sectionPath,
  serializeJsonLd,
  socialImagePath,
  structuredDataForSection,
} from "@/app/lib/discovery";
import { SECTION_CONTENT } from "@/app/lib/sectionContent";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("section discovery contract", () => {
  it("covers every public section exactly once", () => {
    expect(PUBLIC_SECTION_IDS.sort()).toEqual(Object.keys(SECTION_CONTENT).sort());
    expect(Object.keys(SECTION_DISCOVERY).sort()).toEqual(Object.keys(SECTION_CONTENT).sort());
    expect(PUBLIC_SECTION_IDS).not.toContain("political-compass");
  });

  it("uses unique, substantial titles and descriptions", () => {
    const sections = Object.values(SECTION_DISCOVERY);
    expect(new Set(sections.map((section) => section.title)).size).toBe(sections.length);
    expect(new Set(sections.map((section) => section.description)).size).toBe(sections.length);

    for (const section of sections) {
      expect(section.title.length).toBeGreaterThan(5);
      expect(section.description.length).toBeGreaterThan(50);
      expect(["dataset", "withdrawn"]).toContain(section.kind);
    }
  });

  it("maps every section to an owned source contract", () => {
    for (const section of Object.values(SECTION_DISCOVERY)) {
      if (section.sourceKey === "internationalComparison") {
        expect(section.title).toBe("UK in context");
      } else {
        expect(DATA_SOURCES[section.sourceKey]).toBeDefined();
      }
      if (section.kind === "dataset") {
        expect(section.sameAs.length).toBeGreaterThan(0);
        expect(section.sameAs.every((url) => url.startsWith("https://"))).toBe(true);
      }
    }
  });

  it("creates self-referential section and social URLs", () => {
    expect(sectionPath("gdp")).toBe("/section/gdp/");
    expect(socialImagePath("gdp")).toBe("/social/gdp.svg");
    expect(absoluteUrl(sectionPath("gdp"))).toBe(
      "https://public-data.org/section/gdp/"
    );
    expect(SITE_DISCOVERY.origin).toBe("https://public-data.org");
  });

  it("escapes script-closing input in JSON-LD", () => {
    const serialized = serializeJsonLd({ value: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003c/script>");
  });

  it("publishes Dataset and Article structured data by evidence kind", () => {
    expect(structuredDataForSection("gdp")).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: SECTION_DISCOVERY.gdp.title,
      url: "https://public-data.org/section/gdp/",
      license:
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    });
    expect(structuredDataForSection("uk-in-context")).toMatchObject({
      "@type": "Dataset",
      name: "UK in context",
      url: "https://public-data.org/section/uk-in-context/",
    });
    expect(structuredDataForSection("pm-approval")).toMatchObject({
      "@type": "Article",
      articleSection: "Politics",
    });
  });

  it("uses the published snapshot edition rather than retrieval or wall-clock time", () => {
    const discoverySource = source("app/lib/discovery.ts");
    const feedSource = source("app/feed.xml/route.ts");

    expect(discoverySource).toContain("snapshot.meta.generatedAt");
    expect(discoverySource).not.toContain("source.fetchedAt");
    expect(feedSource).not.toContain("new Date().toUTCString()");
    expect(feedSource).toContain("lastBuildDate.toUTCString()");
  });

  it("does not promote stale fallback data as a latest verified publication", () => {
    const discoverySource = source("app/lib/discovery.ts");

    expect(discoverySource).toContain('source.status !== "ok"');
    expect(discoverySource).not.toContain('source.status !== "ok" && source.status !== "stale"');
  });

  it("keeps per-page metadata, feed and discovery routes in the static application", () => {
    const sectionPage = source("app/section/[id]/page.tsx");
    const layout = source("app/layout.tsx");
    const sitemap = source("app/sitemap.ts");
    const robots = source("app/robots.ts");
    const feed = source("app/feed.xml/route.ts");

    expect(sectionPage).toContain("generateMetadata");
    expect(sectionPage).toContain("structuredDataForSection");
    expect(sectionPage).toContain("serializeJsonLd");
    expect(sectionPage).toContain("canonical,");
    expect(sectionPage).toContain('card: "summary_large_image"');
    expect(sectionPage).toContain("/data/sections/");
    expect(layout).toContain('"@type": "Organization"');
    expect(layout).toContain('"@type": "WebSite"');
    expect(layout).toContain("serializeJsonLd");
    expect(sitemap).toContain('absoluteUrl("/feed.xml")');
    expect(sitemap).toContain('export const dynamic = "force-static"');
    expect(robots).toContain('absoluteUrl("/sitemap.xml")');
    expect(robots).toContain('export const dynamic = "force-static"');
    expect(feed).toContain('export const dynamic = "force-static"');
    expect(feed).toContain('"content-type": "application/rss+xml; charset=utf-8"');
  });
});
