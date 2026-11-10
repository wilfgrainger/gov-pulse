import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeasureDetail, ScorecardYearNote, UkStandout } from "@/app/components/InternationalComparison";
import CountryPeersNotice from "@/app/components/CountryPeersNotice";
import type { ComparisonMeasure, ComparisonObservation, InternationalComparisonPublication } from "@/app/lib/internationalComparison";

const source = { publisher: "OECD", url: "https://example.test/oecd", series: "fixture" };
const obs = (country: ComparisonObservation["country"], value: number | null, rank: number | null, year: number, valueType: ComparisonObservation["valueType"]): ComparisonObservation => ({
  country, value, rank, observationYear: year, valueType, source: value === null ? null : source,
  ...(value === null ? { exclusionReason: "publisher-reported-no-value" } : {}),
});
const measure = (id: ComparisonMeasure["id"], year: number, type: ComparisonObservation["valueType"], countries: ComparisonObservation[]): ComparisonMeasure => ({
  id, label: id, definition: "fixture", unit: "USD per resident", rankDirection: "highest-first", observationYear: year,
  comparableCountryCount: countries.filter((c) => c.value !== null).length, countries,
});
const a = measure("governmentDebt", 2026, "projection", [obs("GBR", 100, 1, 2026, "projection"), obs("USA", 90, 2, 2026, "projection"), obs("DEU", 80, 3, 2026, "projection")]);
const b = measure("officialDevelopmentAssistance", 2023, "historical", [obs("GBR", 50, 1, 2023, "historical"), obs("USA", 40, 2, 2023, "historical"), obs("FRA", null, null, 2023, "historical")]);
const pub = (x: ComparisonMeasure, y: ComparisonMeasure) => ({ measures: { governmentDebt: x, officialDevelopmentAssistance: y } }) as unknown as InternationalComparisonPublication;

describe("international comparison disclosure and export", () => {
  it("states year, status and rank of M in the standout aside", () => {
    const html = renderToStaticMarkup(createElement(UkStandout, { publication: pub(a, b) }));
    expect(html).toMatch(/2026|2023/);
    expect(html).toMatch(/Projection|Historical/);
    expect(html).toMatch(/rank \d+ of \d+ countries with a value/);
  });

  it("notes when scorecard measures do not share a year", () => {
    expect(renderToStaticMarkup(createElement(ScorecardYearNote, { publication: pub(a, b) }))).toContain("2023");
    const same = measure("officialDevelopmentAssistance", 2026, "projection", b.countries);
    expect(renderToStaticMarkup(createElement(ScorecardYearNote, { publication: pub(a, same) }))).toBe("");
  });

  it("offers CSV and JSON download on the measure table", () => {
    const html = renderToStaticMarkup(createElement(MeasureDetail, { measure: b }));
    expect(html).toContain("CSV");
    expect(html).toContain("JSON");
  });

  it("compare page links when published and shows an honest held message otherwise", () => {
    expect(renderToStaticMarkup(createElement(CountryPeersNotice, { published: true }))).toMatch(/href="\/section\/uk-in-context\/?"/);
    const held = renderToStaticMarkup(createElement(CountryPeersNotice, { published: false }));
    expect(held).not.toContain("/section/uk-in-context/");
    expect(held).toMatch(/held/i);
    expect(fs.readFileSync("app/compare/page.tsx", "utf8")).not.toContain("stay unavailable while UK-in-context is offline");
  });

  it("documents caveats for ODA, defence and healthcare", () => {
    const src = fs.readFileSync("feeds/international-comparison/compare.js", "utf8");
    for (const id of ["officialDevelopmentAssistance", "defenceSpending", "healthcareSpending"]) {
      const block = src.slice(src.indexOf(`id: "${id}"`)).split("Object.freeze")[0];
      expect(block, id).toContain("caveat:");
    }
  });
});
