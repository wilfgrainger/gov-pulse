import { describe, expect, it } from "vitest";
import { csvCell, sectionCsv, sectionDistribution } from "@/app/lib/sectionDownloads";

const source = {
  status: "ok",
  cacheState: "fresh",
  fetchedAt: "2026-09-27T10:00:00.000Z",
  provenance: { section: "gdpTracker", upstreams: [{ url: "https://www.ons.gov.uk/" }] },
};
const snapshot = {
  meta: { registryVersion: "test", generatedAt: "2026-09-27T10:00:00.000Z", sources: { gdpTracker: source } },
  gdpTracker: { headline: { period: "August 2026", value: 0.2 }, note: '=HYPERLINK("bad")' },
};

describe("section distributions", () => {
  it("keeps source, dates, licence and geography in both formats", () => {
    const distribution = sectionDistribution(snapshot, "gdpTracker");
    expect(distribution).toMatchObject({
      section: "gdpTracker",
      geography: "United Kingdom",
      source,
      data: snapshot.gdpTracker,
      licence: { name: expect.stringContaining("Open Government Licence") },
    });
    const csv = sectionCsv(distribution!);
    expect(csv).toContain("$.source.fetchedAt,2026-09-27T10:00:00.000Z");
    expect(csv).toContain("$.geography,United Kingdom");
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  });

  it("rejects unlisted and absent sections", () => {
    expect(sectionDistribution(snapshot, "__proto__")).toBeNull();
    expect(sectionDistribution(snapshot, "nhsStats")).toBeNull();
  });

  it("neutralises formulas preceded by whitespace in CSV", () => {
    expect(csvCell("\t=HYPERLINK(\"bad\")")).toBe('"\'\t=HYPERLINK(""bad"")"');
    expect(csvCell("  +SUM(1,2)")).toBe('"\'  +SUM(1,2)"');
  });
});
