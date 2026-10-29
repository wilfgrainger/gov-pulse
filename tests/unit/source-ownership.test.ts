import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLICATION_CONFIG } from "@/contracts/publication-policy.js";
import { FEED_CATALOG } from "@/contracts/source-catalog.js";
import { PUBLICATION_SOURCE_REGISTRY } from "@/worker/feed-registry";
import { INTERNATIONAL_SOURCES } from "@/worker/international-comparison-publication";
import {
  validateSourceOwnership,
} from "@/scripts/check-source-ownership.mjs";

const inventory = JSON.parse(
  fs.readFileSync("docs/architecture/source-ownership.json", "utf8")
);

describe("source ownership inventory", () => {
  it("registers comparison input membership in both runtime and architecture inventories", () => {
    const comparison = (PUBLICATION_SOURCE_REGISTRY as unknown as Record<string, { sourceIds?: string[] }>)
      .internationalComparison;

    expect(comparison?.sourceIds).toEqual(INTERNATIONAL_SOURCES);
    expect(inventory.publicationSources.map((source: { section: string }) => source.section))
      .toContain("internationalComparison");
  });

  it("rejects publication ownership drift from the runtime registry", () => {
    const missingPublication = structuredClone(inventory);
    missingPublication.publicationSources = missingPublication.publicationSources
      .filter((source: { section: string }) => source.section !== "internationalComparison");
    expect(validateSourceOwnership(missingPublication).join(" "))
      .toMatch(/publicationSources missing sections: internationalComparison/i);

    const missingInput = structuredClone(inventory);
    const comparison = missingInput.publicationSources
      .find((source: { section: string }) => source.section === "internationalComparison");
    comparison.sourceIds = comparison.sourceIds.slice(1);
    expect(validateSourceOwnership(missingInput).join(" "))
      .toMatch(/sourceIds must match the runtime publication source registry/i);
  });

  it("covers every active feed with existing collector, normalizer and entrypoint owners", () => {
    expect(validateSourceOwnership(inventory)).toEqual([]);
  });

  it("accounts for every canonical source exactly once with an explicit publication decision", () => {
    const inventoried = [
      ...inventory.sources,
      ...inventory.publicationSources,
      ...inventory.staticSources,
    ].map((source: { section: string }) => source.section).sort();
    expect(inventoried).toEqual(Object.keys(FEED_CATALOG).sort());
    for (const section of inventoried) {
      expect(["published", "held"]).toContain(
        (PUBLICATION_CONFIG.publications as Record<string, { state: string }>)[section]?.state,
      );
    }
    expect(inventory).not.toHaveProperty("withdrawnSources");
    expect(inventory).not.toHaveProperty("withdrawnRoutes");
  });

  it("rejects the legacy withdrawn inventory model", () => {
    const legacy = structuredClone(inventory);
    legacy.withdrawnSources = [];
    legacy.withdrawnRoutes = [];
    const failures = validateSourceOwnership(legacy).join(" ");
    expect(failures).toMatch(/withdrawnSources is no longer supported/i);
    expect(failures).toMatch(/withdrawnRoutes is no longer supported/i);
  });

  it("requires one published, held or retired decision per source and removes retired sources", () => {
    const missingDecision = structuredClone(PUBLICATION_CONFIG);
    delete missingDecision.publications.nationalDebt;
    expect(validateSourceOwnership(inventory, process.cwd(), { publicationConfig: missingDecision }).join(" "))
      .toMatch(/nationalDebt: no publication decision/i);

    const invalidState = structuredClone(PUBLICATION_CONFIG);
    (invalidState.publications.nationalDebt as { state: string }).state = "withdrawn";
    expect(validateSourceOwnership(inventory, process.cwd(), { publicationConfig: invalidState }).join(" "))
      .toMatch(/nationalDebt: publication state must be one of published, held, retired/i);

    const retired = structuredClone(PUBLICATION_CONFIG);
    (retired.publications.bettingOdds as { state: string }).state = "retired";
    expect(validateSourceOwnership(inventory, process.cwd(), { publicationConfig: retired }).join(" "))
      .toMatch(/bettingOdds: retired sources must be removed from source ownership/i);
  });

  it("rejects sources owned by more than one inventory list or absent from the catalog", () => {
    const duplicated = structuredClone(inventory);
    duplicated.staticSources.push({ ...structuredClone(duplicated.staticSources[0]), section: "nationalDebt" });
    expect(validateSourceOwnership(duplicated).join(" ")).toMatch(/nationalDebt: inventoried more than once/i);

    const unknown = structuredClone(inventory);
    unknown.staticSources.push({ ...structuredClone(unknown.staticSources[0]), section: "pmApproval" });
    expect(validateSourceOwnership(unknown).join(" ")).toMatch(/pmApproval: not declared in the canonical source catalog/i);

    const missingStatic = structuredClone(inventory);
    missingStatic.staticSources = [];
    expect(validateSourceOwnership(missingStatic).join(" ")).toMatch(/earlyYears: canonical source is not inventoried/i);
  });

  it("requires every public route to be owned by exactly one publication decision", () => {
    const surfaces = JSON.parse(fs.readFileSync("contracts/public-surfaces.json", "utf8"));

    const retiredRoute = structuredClone(surfaces);
    retiredRoute.topics.push({ id: "pm-approval", status: "withdrawn" });
    const retiredFailures = validateSourceOwnership(inventory, process.cwd(), { surfaces: retiredRoute }).join(" ");
    expect(retiredFailures).toMatch(/pm-approval: public topic status must be active/i);
    expect(retiredFailures).toMatch(/route 'pm-approval': no publication decision owns this route/i);

    const doubleClaim = structuredClone(PUBLICATION_CONFIG);
    doubleClaim.publications.gdpTracker.sections = ["gdp", "economy"];
    expect(validateSourceOwnership(inventory, process.cwd(), { publicationConfig: doubleClaim }).join(" "))
      .toMatch(/route 'economy': claimed by more than one publication decision/i);

    const unreviewed = structuredClone(PUBLICATION_CONFIG);
    unreviewed.publications.gdpTracker.sections = ["gdp", "gdp-beta"];
    expect(validateSourceOwnership(inventory, process.cwd(), { publicationConfig: unreviewed }).join(" "))
      .toMatch(/route 'gdp-beta': not a reviewed public topic/i);
  });

  it("rejects duplicate or missing active section ownership", () => {
    const duplicate = structuredClone(inventory);
    duplicate.sources.push(structuredClone(duplicate.sources[0]));
    expect(validateSourceOwnership(duplicate).join(" ")).toMatch(/unique section/i);

    const missing = structuredClone(inventory);
    missing.sources = missing.sources.slice(1);
    expect(validateSourceOwnership(missing).join(" ")).toMatch(/missing sections/i);
  });

  it("rejects nonexistent source implementation paths", () => {
    const invalid = structuredClone(inventory);
    invalid.sources[0].collector = ["worker/DoesNotExist.js", "worker/economic-indicators.js"];
    const failures = validateSourceOwnership(invalid).join(" ");
    expect(failures).toMatch(/collector.*does not exist/i);

    const staticConsumer = structuredClone(inventory);
    staticConsumer.staticSources[0].consumer = "app/components/DoesNotExist.tsx";
    expect(validateSourceOwnership(staticConsumer).join(" ")).toMatch(/consumer path/i);
  });

  it("allows multiple owners and new deployment contracts without a dated implementation veto", () => {
    const evolved = structuredClone(inventory);
    evolved.parentIssue = 999;
    evolved.publicationArtifact = "object-storage:publication-records";
    evolved.publicRoute = "/api/evidence/current";
    evolved.livePublicationKey = "publication:current";
    evolved.publicPublicationKey = "publication:public";
    evolved.sources[0].collector = [
      "worker/economic-indicators.js",
      "worker/economy-evidence.js",
    ];
    delete evolved.simplification;

    expect(validateSourceOwnership(evolved)).toEqual([]);
  });
});
