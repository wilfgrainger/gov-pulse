import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_SOURCES } from "@/app/lib/config";
import { WITHDRAWN_SECTION_IDS } from "@/app/lib/sections";
import {
  EXPECTED_PUBLICATION,
  validateSourceOwnership,
} from "@/scripts/check-source-ownership.mjs";

const inventory = JSON.parse(
  fs.readFileSync("docs/architecture/source-ownership.json", "utf8")
);

describe("source ownership inventory", () => {
  it("covers every active feed with one existing collector, normalizer and entrypoint", () => {
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

  it("records curated static evidence separately from automated feeds", () => {
    expect(inventory.staticSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "earlyYears",
          automation: "static",
          consumer: "app/components/EarlyYearsStats.tsx",
          observationPeriod: "2024/25",
        }),
      ]),
    );
  });

  it("rejects duplicate or missing active section ownership", () => {
    const duplicate = structuredClone(inventory);
    duplicate.sources.push(structuredClone(duplicate.sources[0]));
    expect(validateSourceOwnership(duplicate).join(" ")).toMatch(/unique section/i);

    const missing = structuredClone(inventory);
    missing.sources = missing.sources.slice(1);
    expect(validateSourceOwnership(missing).join(" ")).toMatch(/missing sections/i);
  });

  it("rejects collection or storage attached to withdrawn sources", () => {
    const invalid = structuredClone(inventory);
    invalid.withdrawnSources[0].collector = "worker/index.js";
    invalid.withdrawnSources[0].schedule = "daily";
    invalid.withdrawnSources[0].storage = "KV";
    const failures = validateSourceOwnership(invalid).join(" ");
    expect(failures).toMatch(/null collector and normalizer/i);
    expect(failures).toMatch(/must not schedule collection or store values/i);
  });

  it("rejects retired, nonexistent or unreferenced ownership paths", () => {
    const retired = structuredClone(inventory);
    retired.sources[0].collector = "fetch_intel.py";
    const failures = validateSourceOwnership(retired).join(" ");
    expect(failures).toMatch(/does not exist/i);
    expect(failures).toMatch(/retired path/i);

    const route = structuredClone(inventory);
    route.withdrawnRoutes[0].consumer = "app/components/DoesNotExist.tsx";
    expect(validateSourceOwnership(route).join(" ")).toMatch(/consumer path/i);
  });

  // Workflow-line reduction is measured from the GitHub compare diff; issue #231 tracks deleted-path PR description support.
  it("records the duplicate execution paths and scheduled runs removed", () => {
    expect(inventory.simplification).toMatchObject({
      retiredCollectorImplementations: 1,
      retiredCollectorLines: 1368,
      workflowFilesRemoved: 3,
      workflowLinesRemoved: 144,
      ciJobsRemoved: 3,
      scheduledRunsPerDayRemoved: 2,
      testFilesRemoved: 0,
    });
    for (const workflow of inventory.simplification.removedDedicatedWorkflows) {
      expect(fs.existsSync(workflow)).toBe(false);
    }
  });

  it("keeps the browser on the same-origin Cloudflare publication route", () => {
    expect(inventory).toMatchObject({
      ...EXPECTED_PUBLICATION,
      browserConsumer: "app/lib/useMetrics.ts",
    });

    for (const [field, replacement] of [
      ["publicationArtifact", "https://worker.example/metrics"],
      ["publicRoute", "https://worker.example/metrics"],
      ["livePublicationKey", "legacy:publication"],
      ["publicPublicationKey", "legacy:public"],
    ] as const) {
      const invalid = structuredClone(inventory);
      invalid[field] = replacement;
      expect(validateSourceOwnership(invalid).join(" ")).toContain(
        `${field} must be '${EXPECTED_PUBLICATION[field]}'`
      );
    }
  });
});
