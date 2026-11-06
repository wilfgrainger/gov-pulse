import { describe, expect, it } from "vitest";
import { buildSitemap } from "@/app/lib/sitemapEntries";
import fixture from "@/tests/fixtures/publication/current-snapshot.json";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const lastModified = (entries: ReturnType<typeof buildSitemap>, path: string) =>
  entries.find((entry) => new URL(entry.url).pathname === path)?.lastModified;

describe("sitemap build evidence", () => {
  it("dates a section only from evidence that is current at build time", () => {
    const current = buildSitemap(structuredClone(fixture), NOW);
    expect(lastModified(current, "/section/national-debt/")).toBeInstanceOf(Date);

    const expired = buildSitemap(structuredClone(fixture), new Date("2027-06-01T00:00:00.000Z"));
    expect(lastModified(expired, "/section/national-debt/")).toBeUndefined();
  });

  it("still lists static routes when the build evidence is null", () => {
    const entries = buildSitemap(null, NOW);
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths).toEqual(expect.arrayContaining(["/", "/explore/", "/sources/", "/feed.xml"]));
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });
});
