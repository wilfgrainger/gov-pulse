import { describe, expect, it } from "vitest";
import { nextScheduledCheck } from "@/app/lib/publicationSchedule";

describe("nextScheduledCheck", () => {
  it("returns the next :47 slot inside the current 3-hour window", () => {
    // */3 boundaries are 00, 03, 06, ...; 00:10 is in the 00:xx window and
    // its :47 fire time hasn't happened yet, so it's the next due check.
    const next = nextScheduledCheck(new Date("2026-07-14T00:10:00Z"));
    expect(next?.toISOString()).toBe("2026-07-14T00:47:00.000Z");
  });

  it("rolls over to the next 3-hour window once the current slot has passed", () => {
    const next = nextScheduledCheck(new Date("2026-07-14T05:50:00Z"));
    expect(next?.toISOString()).toBe("2026-07-14T06:47:00.000Z");
  });

  it("rolls over the day boundary correctly", () => {
    const next = nextScheduledCheck(new Date("2026-07-14T23:50:00Z"));
    expect(next?.toISOString()).toBe("2026-07-15T00:47:00.000Z");
  });

  it("returns null for a non-finite date", () => {
    expect(nextScheduledCheck(new Date(NaN))).toBeNull();
  });
});
