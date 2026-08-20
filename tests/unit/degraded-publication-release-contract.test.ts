// @vitest-environment node
import { describe, expect, it } from "vitest";
import { verifyHealthJson, verifySnapshotJson } from "../../scripts/verify-production.mjs";

const required = [
  "sentimentPulse",
  "gdpTracker",
  "employmentStats",
  "nationalDebt",
  "taxRevenue",
  "migrationStats",
  "electionPolling",
  "nhsStats",
];

describe("degraded publication release contract", () => {
  it("accepts a declared degraded health state when exactly one required source is unavailable", () => {
    const health = JSON.stringify({
      status: "degraded",
      ready: false,
      degraded: true,
      missingRequiredSections: ["migrationStats"],
    });

    expect(verifyHealthJson(health, { allowDegraded: true })).toEqual([]);
  });

  it("accepts a snapshot missing only the section declared unavailable", () => {
    const present = required.filter((section) => section !== "migrationStats");
    const snapshot = JSON.stringify({
      meta: {
        registryVersion: "2026-08-02.1",
        sources: Object.fromEntries(present.map((section) => [section, { status: "ok" }])),
        publicationDiagnostics: {
          migrationStats: { code: "upstream-fetch-failure" },
        },
      },
      ...Object.fromEntries(present.map((section) => [section, {}])),
    });

    expect(
      verifySnapshotJson(snapshot, { allowedMissingSections: ["migrationStats"] }),
    ).toEqual([]);
  });

  it("still rejects an undeclared missing required section", () => {
    const present = required.filter((section) => section !== "migrationStats");
    const snapshot = JSON.stringify({
      meta: {
        registryVersion: "2026-08-02.1",
        sources: Object.fromEntries(present.map((section) => [section, { status: "ok" }])),
      },
      ...Object.fromEntries(present.map((section) => [section, {}])),
    });

    expect(verifySnapshotJson(snapshot)).toContain(
      "public data snapshot is missing required section migrationStats",
    );
  });
});
