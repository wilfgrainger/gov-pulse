import fs from "node:fs";
import { describe, expect, it } from "vitest";

// Source-level assertions keep deleted operational UI from quietly returning.
function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("public reader surface", () => {
  it("keeps deployment and feed health telemetry out of global navigation", () => {
    const navigation = source("app/components/SectionNav.tsx");

    expect(navigation).not.toContain("DataHealthBar");
    expect(navigation).not.toContain("core releases are current");
  });

  it("gets from the homepage proposition to evidence without repeated trust tutorials", () => {
    const intro = source("app/components/HomepageIntro.tsx");
    const homepage = source("app/page.tsx");
    const edition = source("app/components/NationalEvidenceEdition.tsx");

    expect(intro).toContain("Britain,");
    expect(intro).toContain("latest important public figures");
    expect(intro).not.toContain("Number, period, source.");
    expect(intro).not.toContain("Evidence promises");

    expect(homepage).not.toContain("Why trust the edition?");
    expect(homepage).not.toContain("publicationProvenanceFromSnapshot");

    expect(edition).not.toContain("Publication provenance");
    expect(edition).not.toContain("Ready edition");
    expect(edition).not.toContain("Registry ");
    expect(edition).not.toContain("App ");
    expect(edition).not.toContain("Four checks before a number becomes a claim.");
    expect(edition).not.toContain("Check sources and dates");
  });

  it("keeps the sources page about publishers and evidence rather than pipeline operations", () => {
    const sources = source("app/sources/page.tsx");

    expect(sources).toContain("Original publications");
    expect(sources).toContain("publisher website");
    expect(sources).not.toContain("DataAutomationSummary");
    expect(sources).not.toContain("PublicationLedger");
    expect(sources).not.toContain("Publication gate");
    expect(sources).not.toContain("Current publisher routes");
    expect(sources).not.toContain("Documented evidence gaps");
  });
});
