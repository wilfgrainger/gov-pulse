import { describe, expect, it } from "vitest";
import { normalizeEvidenceSearchText, searchEvidence } from "@/app/lib/evidenceSearch";

describe("evidenceSearch", () => {
  it("normalises case, punctuation and repeated whitespace", () => {
    expect(normalizeEvidenceSearchText("  Bank-Rate & CPI!  ")).toBe("bank rate and cpi");
  });

  it.each([
    ["inflation", "Prices, rates and jobs", "/section/economy"],
    ["jobs", "Employment", "/section/employment"],
    ["NHS waiting list", "NHS waiting times", "/section/nhs"],
    ["what is UK net migration?", "Migration", "/section/migration"],
    ["where did this number come from?", "Sources, dates and methods", "/sources"],
  ])("ranks %s deterministically", (query, expectedTitle, expectedHref) => {
    const [first] = searchEvidence(query);
    expect(first?.title).toBe(expectedTitle);
    expect(first?.href).toBe(expectedHref);
  });

  it("does not expose withdrawn or unsupported evidence as a current result", () => {
    expect(searchEvidence("PM approval")).toEqual([]);
    expect(searchEvidence("crime statistics")).toEqual([]);
    expect(searchEvidence("polarization score")).toEqual([]);
  });

  it("uses stable priority ordering and honours the result limit", () => {
    const firstRun = searchEvidence("official", 3).map((item) => item.id);
    const secondRun = searchEvidence("official", 3).map((item) => item.id);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun).toHaveLength(3);
  });
});
