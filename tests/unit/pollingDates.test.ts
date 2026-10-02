import { describe, expect, it } from "vitest";
import { fieldworkMidpointMs } from "@/app/lib/pollingDates";

describe("fieldworkMidpointMs", () => {
  it("returns the same timestamp when fieldwork is a single day", () => {
    const mid = fieldworkMidpointMs("2026-07-06", "2026-07-06");
    expect(mid).toBe(Date.parse("2026-07-06T00:00:00.000Z"));
  });

  it("returns the midpoint timestamp for a multi-day fieldwork window", () => {
    const mid = fieldworkMidpointMs("2026-07-05", "2026-07-06");
    const start = Date.parse("2026-07-05T00:00:00.000Z");
    const end = Date.parse("2026-07-06T00:00:00.000Z");
    expect(mid).toBe(start + (end - start) / 2);
  });

  it("throws rather than inventing a date for malformed input", () => {
    expect(() => fieldworkMidpointMs("not-a-date", "2026-07-06")).toThrow();
  });
});
