import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ScrollRegion from "@/app/components/ScrollRegion";
import HousingAffordabilityVisual from "@/app/components/visuals/HousingAffordabilityVisual";
import ComparisonStudio from "@/app/components/ComparisonStudio";
import { SERIES_STYLES } from "@/app/lib/seriesStyles";
import type { MeasureCatalog, MeasureRecord } from "@/app/lib/measureCatalog";

afterEach(cleanup);

function appSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return appSourceFiles(full);
    return /\.(tsx|ts|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("ScrollRegion", () => {
  it("every overflow-x-auto in app/ is rendered through ScrollRegion", () => {
    const offenders = appSourceFiles("app")
      .filter((file) => !file.endsWith(path.join("components", "ScrollRegion.tsx")))
      .filter((file) => /overflow-(x-)?auto/.test(fs.readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("renders a focusable, named region that keeps horizontal scrolling", () => {
    render(<ScrollRegion label="Example table"><p>Wide content</p></ScrollRegion>);
    const region = screen.getByRole("region", { name: "Example table" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("overflow-x-auto");
    expect(region.className).toContain("scroll-region");
  });

  it("styles a visible focus ring for scroll regions", () => {
    const css = fs.readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.scroll-region:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/);
  });
});

describe("housing chart accessibility", () => {
  const points = (offset: number) => [
    { period: "Jun 2026", observedAt: Date.UTC(2026, 5, 30), value: 1 + offset },
    { period: "Jul 2026", observedAt: Date.UTC(2026, 6, 31), value: 2 + offset },
  ];

  it("the housing chart has an accessible name and keyboard-reachable values", () => {
    render(<HousingAffordabilityVisual housePrice={points(0)} realPay={points(1)} hpiPeriod="Jul 2026" wagesPeriod="Jul 2026" />);
    const chart = screen.getByRole("group", { name: /House price annual change.*Real regular pay growth.*shared date axis/i });
    expect(chart.tagName.toLowerCase()).toBe("svg");
    const values = [...chart.querySelectorAll("circle")];
    expect(values).toHaveLength(4);
    expect(values.every((value) => value.getAttribute("tabindex") === "0" && Boolean(value.getAttribute("aria-label")))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /screen-reader tables/i }));
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(document.querySelector("[aria-hidden='true'] [tabindex='0']")).toBeNull();
    expect(screen.getAllByRole("region", { name: /data table/i }).length).toBeGreaterThan(0);
  });
});

function measure(id: string): MeasureRecord {
  return {
    id, label: `Measure ${id}`, evidenceClass: "official-statistics", comparisonKey: "monthly-rate", cadence: "monthly", unit: "%",
    basis: "Monthly published rate", geography: { code: "GB", label: "Great Britain" }, sourceId: `source-${id}`,
    sourceUrl: `https://example.gov.uk/${id}`, sourceEditionId: `edition-${id}`,
    observationPeriod: { start: "2026-08-01", end: "2026-08-01", label: "Aug 2026" },
    publishedAt: "2026-09-01T00:00:00.000Z", fetchedAt: "2026-09-01T00:00:00.000Z", validUntil: "2030-10-01T00:00:00.000Z",
    availability: "current", value: 5, revisionId: `revision-${id}`,
    points: [
      { period: "Jul 2026", observedAt: "2026-07-01", value: 4, valueStatus: "observed", revisionId: `revision-${id}` },
      { period: "Aug 2026", observedAt: "2026-08-01", value: 5, valueStatus: "observed", revisionId: `revision-${id}` },
    ],
    caveats: [],
  };
}

describe("comparison series cues", () => {
  it("comparison series differ by marker or dash, not colour alone", () => {
    const signatures = SERIES_STYLES.map((style) => `${style.dash}|${style.marker}`);
    expect(new Set(signatures).size).toBe(SERIES_STYLES.length);
    expect(SERIES_STYLES.length).toBeGreaterThanOrEqual(8);

    const first = measure("first"); const second = measure("second"); const third = measure("third");
    const catalog: MeasureCatalog = { schemaVersion: 2, editionId: "e", generatedAt: "2026-09-01T00:00:00.000Z", validUntil: "2030-10-01T00:00:00.000Z", measures: { first, second, third } };
    const { container } = render(<ComparisonStudio catalog={catalog} measures={[first, second, third]} initial={{ version: 1, measureIds: ["first", "second", "third"], window: { start: "2026-07-01", end: "2026-08-01" }, mode: "overlay" }} initialError={null} />);
    const chart = screen.getByRole("img", { name: /Comparable measures/ });
    const lines = [...chart.querySelectorAll("path[data-series]")];
    expect(lines).toHaveLength(3);
    expect(new Set(lines.map((line) => `${line.getAttribute("stroke-dasharray")}|${line.getAttribute("data-marker")}`)).size).toBe(3);
    expect(chart.querySelectorAll("[data-marker-shape]").length).toBeGreaterThanOrEqual(6);
    const legend = [...container.querySelectorAll("svg[data-legend-swatch]")];
    expect(legend).toHaveLength(3);
    expect(new Set(legend.map((swatch) => swatch.getAttribute("data-legend-swatch"))).size).toBe(3);
  });
});
