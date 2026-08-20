// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  classifyPublicationDiagnostic,
  PUBLICATION_DIAGNOSTIC_CODES,
} from "@/contracts/publication-diagnostics.js";
import { validatePublishedDiagnostics } from "@/scripts/snapshot-canary.mjs";
import {
  OPTIONAL_PUBLISHED_SECTION_IDS,
  REQUIRED_PUBLISHED_SECTION_IDS,
} from "@/worker/feed-registry";

const publishedSections = [
  ...REQUIRED_PUBLISHED_SECTION_IDS,
  ...OPTIONAL_PUBLISHED_SECTION_IDS,
];

describe("snapshot canary diagnostics", () => {
  it("accepts an exact public reason for every unavailable section", () => {
    const unavailable = publishedSections.at(-1)!;
    const verified = publishedSections.filter((section) => section !== unavailable);
    const diagnostic = classifyPublicationDiagnostic({
      section: unavailable,
      source: {
        status: "error",
        cacheState: "missing",
        error: "Official source returned 503",
      },
    });
    const snapshot = {
      meta: {
        publicationDiagnostics: { [unavailable]: diagnostic },
      },
    };

    expect(validatePublishedDiagnostics(snapshot, verified)).toEqual({
      [unavailable]: diagnostic,
    });
    expect(diagnostic?.code).toBe(
      PUBLICATION_DIAGNOSTIC_CODES.upstreamFetchFailure
    );
  });

  it("accepts a diagnosed unavailable required source such as migration", () => {
    const unavailable = "migrationStats";
    expect(REQUIRED_PUBLISHED_SECTION_IDS).toContain(unavailable);
    const verified = publishedSections.filter((section) => section !== unavailable);
    const diagnostic = classifyPublicationDiagnostic({
      section: unavailable,
      source: {
        status: "error",
        cacheState: "expired",
        error: "Official migration release is outside its retrieval window",
      },
    });

    expect(
      validatePublishedDiagnostics(
        { meta: { publicationDiagnostics: { [unavailable]: diagnostic } } },
        verified,
      ),
    ).toEqual({ [unavailable]: diagnostic });
  });

  it("rejects an unavailable section with no diagnostic reason", () => {
    const unavailable = publishedSections.at(-1)!;
    const verified = publishedSections.filter((section) => section !== unavailable);

    expect(() =>
      validatePublishedDiagnostics(
        { meta: { publicationDiagnostics: {} } },
        verified
      )
    ).toThrow(`Published diagnostics do not cover unavailable sections: ${unavailable}`);
  });
});
