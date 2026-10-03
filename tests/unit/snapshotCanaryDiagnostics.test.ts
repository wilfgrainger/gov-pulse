// @vitest-environment node

import { describe, expect, it } from "vitest";
import { validatePublicationState } from "@/scripts/snapshot-canary.mjs";
import {
  OPTIONAL_PUBLISHED_SECTION_IDS,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "@/worker/feed-registry";

const publishedSections = [
  ...REQUIRED_PUBLISHED_SECTION_IDS,
  ...OPTIONAL_PUBLISHED_SECTION_IDS,
];

function publication(unavailableSections: string[] = []) {
  const verified = publishedSections.filter((section) => !unavailableSections.includes(section));
  const missingRequiredSections = REQUIRED_PUBLISHED_SECTION_IDS.filter(
    (section) => unavailableSections.includes(section)
  );
  const now = new Date();
  const fetchedAt = new Date(now.getTime() - 30_000).toISOString();
  const observedAt = new Date(now.getTime() - 60_000).toISOString();
  const validUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
  const snapshot = {
    meta: {
      sources: Object.fromEntries(verified.map((section) => [section, {
        status: "ok",
        cacheState: "fresh",
        fetchedAt,
        provenance: { section },
      }])),
      publicationState: missingRequiredSections.length ? "degraded" : "ready",
      missingRequiredSections,
    } as Record<string, unknown>,
  };
  for (const section of verified) {
    const data: Record<string, unknown> = {
      expiresAt: validUntil,
      __observation: {
        status: "current",
        period: "Current test period",
        observedAt,
        maxAgeDays: 30,
      },
    };
    if (section === "sentimentPulse") {
      data.__measureValidity = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [id, { validUntil }]),
      );
      data.series = Object.fromEntries(
        ["inflation", "bankRate", "unemployment"].map((id) => [id, { status: "current", value: 1 }]),
      );
    }
    Object.assign(snapshot, { [section]: data });
  }
  return snapshot;
}

describe("snapshot publication state", () => {
  it("accepts an unavailable optional source without publishing a diagnostic code", () => {
    const unavailable = publishedSections.at(-1)!;
    expect(REQUIRED_PUBLISHED_SECTION_IDS).not.toContain(unavailable);
    const snapshot = publication([unavailable]);

    expect(validatePublicationState(snapshot)).toEqual({
      requiredUnavailableSections: [],
      optionalUnavailableSections: [unavailable],
    });
    expect(snapshot.meta).not.toHaveProperty("publicationDiagnostics");
  });

  it("accepts an explicitly degraded required source such as migration", () => {
    const unavailable = "migrationStats";
    expect(REQUIRED_PUBLISHED_SECTION_IDS).toContain(unavailable);
    const snapshot = publication([unavailable]);

    expect(validatePublicationState(snapshot)).toEqual({
      requiredUnavailableSections: [unavailable],
      optionalUnavailableSections: [],
    });
  });

  it("rejects leaked private diagnostics and raw source errors", () => {
    const snapshot = publication();
    snapshot.meta.publicationDiagnostics = { nhsStats: { code: "upstream_fetch_failure" } };
    snapshot.meta.measureCatalogDiagnostics = [{ measureId: "bankRate", reason: "expired-value" }];
    snapshot.meta.sources = {
      ...(snapshot.meta.sources as object),
      gdpTracker: { error: "private source response detail" },
    };

    expect(() => validatePublicationState(snapshot)).toThrow(
      "Published snapshot exposes private diagnostics"
    );
  });

  it("rejects measure-catalog diagnostics even when no section errors are present", () => {
    const snapshot = publication();
    snapshot.meta.measureCatalogDiagnostics = [{ measureId: "bankRate", reason: "expired-value" }];
    expect(() => validatePublicationState(snapshot)).toThrow(
      "Published snapshot exposes private diagnostics",
    );
  });

  it("rejects a missing-section manifest that disagrees with the evidence", () => {
    const snapshot = publication(["migrationStats"]);
    snapshot.meta.missingRequiredSections = [];

    expect(() => validatePublicationState(snapshot)).toThrow(
      "Published snapshot missing-section manifest is inconsistent"
    );
  });
});
