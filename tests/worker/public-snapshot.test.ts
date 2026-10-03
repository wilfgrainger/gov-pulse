// @vitest-environment node

import { describe, expect, it } from "vitest";
import { publicSnapshot } from "@/worker/public-snapshot.js";

describe("public snapshot privacy", () => {
  it("keeps source rejection diagnostics in private publication state", () => {
    const diagnostic = {
      section: "nhsStats",
      code: "upstream_fetch_failure",
      summary: "The official source could not be collected.",
      status: "error",
      cacheState: "missing",
      fetchedAt: null,
    };
    const publication = {
      meta: {
        registryVersion: "2026-08-02.1",
        publicationDiagnostics: { nhsStats: diagnostic },
        measureCatalogDiagnostics: [{ measureId: "waitingPathwaysEstimate", reason: "source-section-missing", category: "source-missing", availability: "unavailable" }],
        sources: {
          gdpTracker: { status: "error", error: "private response detail" },
        },
      },
    };

    const sanitized = publicSnapshot(publication);

    expect(sanitized.meta).not.toHaveProperty("publicationDiagnostics");
    expect(sanitized.meta).not.toHaveProperty("measureCatalogDiagnostics");
    expect(sanitized.meta.sources.gdpTracker).not.toHaveProperty("error");
    expect(JSON.stringify(sanitized)).not.toContain("private response detail");
    expect(publication.meta.publicationDiagnostics).toEqual({ nhsStats: diagnostic });
    expect(publication.meta.measureCatalogDiagnostics).toHaveLength(1);
    expect(publication.meta.sources.gdpTracker.error).toBe("private response detail");
  });
});
