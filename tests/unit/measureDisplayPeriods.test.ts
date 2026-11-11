import { describe, expect, it } from "vitest";
import snapshot from "@/tests/fixtures/publication/current-snapshot.json";
import { availableMeasures, measureForDisplay } from "@/app/lib/measureCatalog";

const now = new Date(snapshot.meta.generatedAt);
const catalog = snapshot.meta.measureCatalog;
const raw = /^\d{4} [A-Z]{3}(-[A-Z]{3})?$/;

describe("measure records for display", () => {
  it("never show a publisher period code such as \"2026 AUG\"", () => {
    const records = availableMeasures(catalog, now);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.observationPeriod.label).not.toMatch(raw);
      for (const point of record.points) expect(point.period).not.toMatch(raw);
    }
    const debt = measureForDisplay(catalog, "debt-ratio", now);
    expect(debt?.observationPeriod.label).toBe("August 2026");
  });

  it("leaves the stored catalog untouched", () => {
    measureForDisplay(catalog, "debt-ratio", now);
    expect(JSON.stringify(catalog)).toContain("2026 AUG");
  });
});
