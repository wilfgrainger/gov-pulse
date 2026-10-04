import { describe, expect, it } from "vitest";
import { createClientMetricsSnapshot } from "@/app/lib/metricsSnapshot";

describe("createClientMetricsSnapshot", () => {
  it("keeps reader evidence and edition metadata without serializing the server catalog", () => {
    const snapshot = {
      meta: {
        registryVersion: "test",
        generatedAt: "2026-10-04T09:24:07.096Z",
        sources: { gdpTracker: { status: "ok", fetchedAt: "2026-10-04T09:00:00Z" } },
        measureCatalog: { measures: [{ id: "gdp", label: "Gross domestic product" }] },
        editionSummary: { id: "edition-1", publishedAt: "2026-10-04T09:00:00Z" },
      },
      gdpTracker: { headline: { threeMonthGrowth: 0.2 } },
    };

    const clientSnapshot = createClientMetricsSnapshot(snapshot as never);

    expect(clientSnapshot?.meta.measureCatalog).toBeUndefined();
    expect(clientSnapshot?.meta.sources).toEqual(snapshot.meta.sources);
    expect(clientSnapshot?.meta.editionSummary).toEqual(snapshot.meta.editionSummary);
    expect(clientSnapshot?.gdpTracker).toEqual(snapshot.gdpTracker);
    expect(snapshot.meta.measureCatalog).toBeDefined();
  });

  it("keeps an unavailable snapshot unavailable", () => {
    expect(createClientMetricsSnapshot(null)).toBeNull();
  });
});
