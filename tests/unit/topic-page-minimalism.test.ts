import fs from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("topic-page minimalism", () => {
  it("keeps the shared evidence footer reader-facing", () => {
    const status = source("app/components/MetricsStatus.tsx");

    expect(status).toContain("Evidence & sources");
    expect(status).toContain("What to know:");
    expect(status).toContain("View all sources");
    expect(status).not.toContain("How this evidence was produced");
    expect(status).not.toContain("Expected update window");
    expect(status).not.toContain("Publication cadence");
    expect(status).not.toContain("Update method");
    expect(status).not.toContain("Verification rule:");
    expect(status).not.toContain("EVIDENCE_CLASS_DESCRIPTIONS");
  });

  it("does not keep implementation history on active evidence pages", () => {
    const gdp = source("app/components/GDPTracker.tsx");
    const employment = source("app/components/EmploymentStats.tsx");

    expect(gdp).not.toContain("Forecast and comparison tables withdrawn");
    expect(gdp).not.toContain("gdp-withdrawn-title");
    expect(employment).not.toContain("Workforce breakdowns withdrawn");
    expect(employment).not.toContain("employment-withdrawn-title");
  });

  it("removes permanently disabled procurement branches from government receipts", () => {
    const receipts = source("app/components/TaxRevenue.tsx");

    expect(receipts).not.toContain("procurementVerified");
    expect(receipts).not.toContain("procurementData");
    expect(receipts).not.toContain("Spending by Sector");
    expect(receipts).not.toContain("Top 50 Contracts");
    expect(receipts).not.toContain("Largest Outsourcers");
    expect(fs.existsSync("data/contracts-procurement/procurement-data.json")).toBe(false);
  });
});
