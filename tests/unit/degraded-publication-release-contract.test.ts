// @vitest-environment node
import { describe, expect, it } from "vitest";
import { verifyHealthJson, verifySnapshotJson } from "../../scripts/verify-production.mjs";
import { REQUIRED_PUBLISHED_SECTION_IDS } from "../../worker/feed-registry.js";

const required = REQUIRED_PUBLISHED_SECTION_IDS;

function publicationSnapshot(missing: string[] = [], now = new Date()) {
  const fetchedAt = new Date(now.getTime() - 30_000).toISOString();
  const observedAt = new Date(now.getTime() - 60_000).toISOString();
  const validUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
  const sources: Record<string, unknown> = {};
  const sections: Record<string, unknown> = {};
  for (const section of required) {
    if (missing.includes(section)) continue;
    sources[section] = {
      status: "ok",
      cacheState: "fresh",
      fetchedAt,
      provenance: { section },
    };
    sections[section] = {
      expiresAt: validUntil,
      __observation: {
        status: "current",
        period: "Current test period",
        observedAt,
        maxAgeDays: 30,
      },
    };
    if (section === "sentimentPulse") {
      Object.assign(sections[section] as Record<string, unknown>, {
        __measureValidity: Object.fromEntries(
          ["inflation", "bankRate", "unemployment"].map((id) => [id, { validUntil }]),
        ),
        series: Object.fromEntries(
          ["inflation", "bankRate", "unemployment"].map((id) => [id, { status: "current", value: 1 }]),
        ),
      });
    }
  }
  return {
    meta: {
      registryVersion: "2026-08-02.1",
      sources,
      publicProjection: {
        state: "published",
        publishedSections: Object.keys(sources).sort(),
      },
    },
    ...sections,
  };
}

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

  it("accepts a published subset independently of degraded health", () => {
    const now = new Date("2026-10-02T18:00:00.000Z");
    const snapshot = JSON.stringify(publicationSnapshot(["migrationStats"], now));

    expect(verifySnapshotJson(snapshot, { now })).toEqual([]);
  });

  it("rejects a projection that claims evidence which is not exposed", () => {
    const payload = publicationSnapshot(["migrationStats"]);
    payload.meta.publicProjection.publishedSections.push("migrationStats");

    expect(verifySnapshotJson(JSON.stringify(payload))).toContain(
      "public data snapshot public projection is invalid",
    );
  });

  it("rejects private diagnostics in the public snapshot", () => {
    const snapshot = publicationSnapshot();
    snapshot.meta.publicationDiagnostics = { nhsStats: { code: "upstream_fetch_failure" } };
    expect(verifySnapshotJson(JSON.stringify(snapshot))).toContain(
      "public data snapshot exposes private diagnostics"
    );
  });
});
