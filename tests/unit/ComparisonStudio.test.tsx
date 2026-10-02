import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonStudio from "@/app/components/ComparisonStudio";
import type { MeasureRecord } from "@/app/lib/measureCatalog";

function measure(id: string): MeasureRecord {
  return {
    id,
    label: `Measure ${id}`,
    evidenceClass: "official-statistics",
    comparisonKey: "monthly-rate",
    cadence: "monthly",
    unit: "%",
    basis: "Monthly published rate",
    geography: { code: "GB", label: "Great Britain" },
    sourceId: `source-${id}`,
    sourceUrl: `https://example.gov.uk/${id}`,
    sourceEditionId: `edition-${id}`,
    observationPeriod: { start: "2026-08-01", end: "2026-08-01", label: "Aug 2026" },
    publishedAt: "2026-09-01T00:00:00.000Z",
    fetchedAt: "2026-09-01T00:00:00.000Z",
    validUntil: "2026-10-01T00:00:00.000Z",
    availability: "current",
    value: 5,
    revisionId: `revision-${id}`,
    points: [{ period: "Aug 2026", observedAt: "2026-08-01", value: 5, valueStatus: "observed", revisionId: `revision-${id}` }],
    caveats: [],
  };
}

describe("ComparisonStudio overlay", () => {
  it("renders isolated publications as visible chart points", () => {
    render(
      <ComparisonStudio
        measures={[measure("first"), measure("second")]}
        initial={{ version: 1, measureIds: ["first", "second"], window: { start: "2026-08-01", end: "2026-08-01" }, mode: "overlay" }}
        initialError={null}
      />,
    );

    const chart = screen.getByRole("img", { name: /Comparable measures from 2026-08-01 to 2026-08-01/ });
    expect(chart.querySelectorAll("circle")).toHaveLength(2);
  });
});
