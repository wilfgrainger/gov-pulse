import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MeasureLibrary from "@/app/components/MeasureLibrary";
import type { MeasureRecord } from "@/app/lib/measureCatalog";

afterEach(cleanup);

const record = {
  id: "uk-unemployment-rate", label: "Unemployment rate", evidenceClass: "official-statistics",
  comparisonKey: "uk-ilo-unemployment", cadence: "monthly", unit: "%", basis: "Share of the economically active population", geography: { code: "GB", label: "Great Britain" },
  sourceId: "ons-labour", sourceUrl: "https://www.ons.gov.uk/labour-market", sourceEditionId: "ons-2026-05",
  observationPeriod: { start: "2026-01-01", end: "2026-03-31", label: "Jan to Mar 2026" }, publishedAt: "2026-05-01T00:00:00.000Z", fetchedAt: "2026-05-02T00:00:00.000Z", validUntil: "2026-06-01T00:00:00.000Z", availability: "current", value: 4.8, revisionId: "ons-2026-05",
  points: [{ period: "Jan to Mar 2026", observedAt: "2026-03-31", value: 4.8, valueStatus: "estimate", revisionId: "ons-2026-05" }], caveats: [],
} as MeasureRecord;

describe("measure library", () => {
  it("links a registered measure to its canonical evidence page", () => {
    render(<MeasureLibrary measures={[record]} />);
    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toHaveAttribute("href", "/measure/uk-unemployment-rate");
    expect(screen.getByText(/Great Britain · % · monthly/i)).toBeInTheDocument();
  });

  it("filters registered records by source, unit, geography and definition", () => {
    render(<MeasureLibrary measures={[record]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /Filter measures/i }), { target: { value: "ons-labour" } });
    expect(screen.getByRole("link", { name: /Unemployment rate/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /Filter measures/i }), { target: { value: "monthly rent" } });
    expect(screen.getByRole("status")).toHaveTextContent(/No registered measure matches/i);
  });
});
