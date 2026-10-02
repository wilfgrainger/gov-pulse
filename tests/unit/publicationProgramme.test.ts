import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unsupportedWorkerIngress } from "../../scripts/check-static-architecture.mjs";
import { publicRouteAllowed } from "../../scripts/lib/public-surfaces.mjs";
import { SECTION_CONTENT } from "../../app/lib/sectionContent";
import { MEASURES } from "../../app/lib/dataExplorer";
import { MEASURE_IDS } from "../../worker/measure-catalog.js";
import { MEASURE_COUNTS_BY_ROUTE } from "../../app/lib/sections";

const wrangler = readFileSync("worker/wrangler.toml", "utf8");

describe("approved public evidence surfaces", () => {
  it("authorizes the exact edition archive routes and leaves retired endpoints closed", () => {
    expect(unsupportedWorkerIngress(wrangler)).toEqual([]);
    expect(publicRouteAllowed("/data/editions.json")).toBe(true);
    expect(publicRouteAllowed("/data/edition.json?edition=catalog-1.2-a")).toBe(true);
    expect(publicRouteAllowed("/data/measure-catalog.json")).toBe(false);
  });

  it("does not turn an approved data route into public collector access", () => {
    const collectorRoute = [
      "[[routes]]",
      'pattern = "public-data.org/data/collect/latest"',
      'zone_name = "public-data.org"',
      "",
    ].join("\n");

    expect(unsupportedWorkerIngress(`${wrangler}\n${collectorRoute}`)).not.toEqual([]);
    expect(publicRouteAllowed("/data/collect/latest")).toBe(false);
    expect(publicRouteAllowed("/internal/queue")).toBe(false);
  });

  it("only reads an edition selected by one validated query value", () => {
    expect(publicRouteAllowed("/data/edition.json?edition=2026-10-01-a1")).toBe(true);
    expect(publicRouteAllowed("/data/edition.json?edition=../../secret")).toBe(false);
    expect(publicRouteAllowed("https://attacker.example/data/edition.json?edition=a1")).toBe(false);
    expect(publicRouteAllowed("/data/edition.json?edition=a1&debug=true")).toBe(false);
  });

  it("keeps every topic and explorer measure in the presentation inventory", () => {
    const surfaces = JSON.parse(readFileSync("contracts/public-surfaces.json", "utf8"));
    const coverage = JSON.parse(readFileSync("contracts/measure-coverage.json", "utf8"));

    expect(Object.keys(SECTION_CONTENT).toSorted()).toEqual(
      surfaces.topics.map((topic: { id: string }) => topic.id).toSorted(),
    );
    expect(coverage.topics.toSorted()).toEqual(
      surfaces.topics.map((topic: { id: string }) => topic.id).toSorted(),
    );
    expect(MEASURES.map(({ id }) => id).toSorted()).toEqual(surfaces.explorerMeasureIds.toSorted());
    expect(MEASURE_IDS.toSorted()).toEqual(coverage.canonicalMeasureIds.toSorted());
    expect(MEASURE_IDS.toSorted()).toEqual(MEASURES.map(({ id }) => id).toSorted());
    expect(Object.values(MEASURE_COUNTS_BY_ROUTE).reduce((total, count) => total + count, 0)).toBe(MEASURE_IDS.length);
    expect(Object.keys(MEASURE_COUNTS_BY_ROUTE).toSorted()).toEqual([...new Set(MEASURES.map(({ route }) => route.replace(/\/$/, "")))].toSorted());
    expect(coverage.explorerMeasureIds.toSorted()).toEqual(surfaces.explorerMeasureIds.toSorted());
  });

  it("allows vibrant styling while the evidence accessibility rules remain active", () => {
    const guide = readFileSync("AGENTS.md", "utf8");
    expect(guide).toContain("vibrant, classic FiveThirtyEight-inspired redesign");
    expect(guide).toContain("keyboard access and visible focus");
    expect(guide).toContain("Cloudflare Free");
  });
});
