// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  EXTERNAL_SECTIONS,
  GENERIC_SECTIONS,
  PUBLISHED_SECTIONS,
  SECTION_COLLECTION_PLAN,
  collectionPlanFor,
  jobsForDay,
  refreshJobs,
} from "@/worker/publication-plan";

describe("publication collection plan", () => {
  it("owns the daily collection routing for every national section exactly once", () => {
    expect(GENERIC_SECTIONS).toHaveLength(9);
    expect(EXTERNAL_SECTIONS).toHaveLength(5);
    expect(PUBLISHED_SECTIONS).toHaveLength(14);
    expect(new Set(PUBLISHED_SECTIONS).size).toBe(PUBLISHED_SECTIONS.length);
    expect(Object.keys(SECTION_COLLECTION_PLAN)).toEqual([...PUBLISHED_SECTIONS]);

    expect(collectionPlanFor("taxRevenue")).toEqual({
      jobType: "refresh-section",
      collector: "tax-revenue-live",
    });
    expect(collectionPlanFor("electionPolling")).toEqual({
      jobType: "refresh-external-section",
      collector: "external",
    });
  });

  it("generates the complete daily plan plus contracts", () => {
    const jobs = jobsForDay("daily-run");

    expect(jobs).toHaveLength(15);
    expect(jobs.filter((job) => job.type === "refresh-section")).toHaveLength(9);
    expect(jobs.filter((job) => job.type === "refresh-external-section")).toHaveLength(5);
    expect(jobs.at(-1)).toEqual({ type: "refresh-contracts" });
  });

  it("limits bootstrap to required evidence and makes contracts explicitly opt-in", () => {
    const jobs = refreshJobs("bootstrap-run", "bootstrap");
    expect(jobs.map((job) => job.section)).toEqual([
      "gdpTracker",
      "sentimentPulse",
      "employmentStats",
      "taxRevenue",
      "nationalDebt",
      "migrationStats",
      "housePriceIndex",
      "realWages",
      "electionPolling",
      "nhsStats",
    ]);
    expect(jobs.some((job) => job.type === "refresh-contracts")).toBe(false);

    expect(refreshJobs("bootstrap-run", "bootstrap", { includeContracts: true }).at(-1))
      .toEqual({
        type: "refresh-contracts",
        runId: "bootstrap-run",
        jobId: "contracts",
        force: true,
      });
  });

  it("keeps betting refresh isolated and rejects unknown scopes", () => {
    expect(refreshJobs("betting-run", "betting")).toEqual([
      {
        type: "refresh-external-section",
        section: "bettingOdds",
        runId: "betting-run",
        jobId: "external:bettingOdds",
      },
    ]);
    expect(() => refreshJobs("run", "mystery")).toThrow(/Unknown publication refresh scope/);
  });
});
