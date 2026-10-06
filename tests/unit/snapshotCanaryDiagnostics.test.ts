// @vitest-environment node

import { describe, expect, it } from "vitest";
import { validatePublicationState } from "@/scripts/snapshot-canary.mjs";

function publication(sections = ["nationalDebt"]) {
  return {
    meta: {
      sources: Object.fromEntries(
        sections.map((section) => [
          section,
          {
            status: "ok",
            cacheState: "fresh",
          },
        ])
      ),
      publicProjection: {
        state: "published",
        publishedSections: [...sections],
      },
    } as Record<string, unknown>,
  };
}

describe("reader publication projection", () => {
  it("accepts an explicit published projection without internal readiness state", () => {
    const snapshot = publication(["nationalDebt"]);

    expect(validatePublicationState(snapshot)).toEqual({
      publishedSections: ["nationalDebt"],
    });
    expect(snapshot.meta).not.toHaveProperty("publicationState");
    expect(snapshot.meta).not.toHaveProperty("missingRequiredSections");
  });

  it("accepts any honest published subset rather than requiring internal feed completeness", () => {
    const snapshot = publication(["nationalDebt", "gdpTracker"]);

    expect(validatePublicationState(snapshot)).toEqual({
      publishedSections: ["gdpTracker", "nationalDebt"],
    });
  });

  it("rejects leaked private readiness and raw source errors", () => {
    const snapshot = publication();
    snapshot.meta.publicationState = "degraded";
    snapshot.meta.sources = {
      ...(snapshot.meta.sources as object),
      nationalDebt: {
        status: "ok",
        cacheState: "fresh",
        error: "private source response detail",
      },
    };

    expect(() => validatePublicationState(snapshot)).toThrow(
      "private publication state"
    );
  });

  it("rejects private diagnostics even when source records are otherwise clean", () => {
    const snapshot = publication();
    snapshot.meta.measureCatalogDiagnostics = [
      { measureId: "bankRate", reason: "expired-value" },
    ];

    expect(() => validatePublicationState(snapshot)).toThrow(
      "private publication state"
    );
  });

  it("rejects a projection that disagrees with the exposed source manifest", () => {
    const snapshot = publication(["nationalDebt"]);
    snapshot.meta.publicProjection = {
      state: "published",
      publishedSections: ["gdpTracker"],
    };

    expect(() => validatePublicationState(snapshot)).toThrow(
      "does not match its source manifest"
    );
  });
});
