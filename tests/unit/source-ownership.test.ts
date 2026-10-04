import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_SOURCES } from "@/app/lib/config";
import { WITHDRAWN_SECTION_IDS } from "@/app/lib/sections";
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

  it("covers every withdrawn source and route from application metadata", () => {
    const expectedSources = Object.entries(DATA_SOURCES)
      .filter(([, definition]) => definition.automation === "withdrawn")
      .map(([section]) => section)
      .sort();
    const actualSources = inventory.withdrawnSources
      .map((source: { section: string }) => source.section)
      .sort();
    expect(actualSources).toEqual(expectedSources);

    const actualRoutes = inventory.withdrawnRoutes
      .map((route: { route: string }) => route.route)
      .sort();
    expect(actualRoutes).toEqual([...WITHDRAWN_SECTION_IDS].sort());
  });

  it("rejects duplicate or missing active section ownership", () => {
    const duplicate = structuredClone(inventory);
    duplicate.sources.push(structuredClone(duplicate.sources[0]));
    expect(validateSourceOwnership(duplicate).join(" ")).toMatch(/unique section/i);

    const missing = structuredClone(inventory);
    missing.sources = missing.sources.slice(1);
    expect(validateSourceOwnership(missing).join(" ")).toMatch(/missing sections/i);
  });

  it("rejects current collection on withdrawn sources while allowing a read-only archive", () => {
    const invalid = structuredClone(inventory);
    invalid.withdrawnSources[0].collector = "worker/index.js";
    invalid.withdrawnSources[0].schedule = "daily";
    invalid.withdrawnSources[0].storage = "read-only historical archive";
    const failures = validateSourceOwnership(invalid).join(" ");
    expect(failures).toMatch(/null collector and normalizer/i);
    expect(failures).toMatch(/must not schedule current collection/i);
    expect(failures).not.toMatch(/storage/i);
  });

  it("rejects nonexistent source implementation paths", () => {
    const invalid = structuredClone(inventory);
    invalid.sources[0].collector = ["worker/DoesNotExist.js", "worker/economic-indicators.js"];
    const failures = validateSourceOwnership(invalid).join(" ");
    expect(failures).toMatch(/collector.*does not exist/i);

    const route = structuredClone(inventory);
    route.withdrawnRoutes[0].consumer = "app/components/DoesNotExist.tsx";
    expect(validateSourceOwnership(route).join(" ")).toMatch(/consumer path/i);
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
