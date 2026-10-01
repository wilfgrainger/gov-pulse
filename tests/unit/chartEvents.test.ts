// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CHART_EVENTS, visibleChartEvents } from "@/app/lib/chartEvents";

describe("chart events registry", () => {
  it("holds only label + exact ISO date, no causal language", () => {
    expect(CHART_EVENTS.length).toBeGreaterThan(0);
    for (const event of CHART_EVENTS) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.label.toLowerCase()).not.toMatch(/caused|driven by|because|led to|resulted in/);
    }
  });

  it("filters events to the visible date range", () => {
    const start = Date.UTC(2019, 0, 1);
    const end = Date.UTC(2021, 11, 31);
    const events = visibleChartEvents(start, end);
    expect(events.map((e) => e.id)).toContain("covid-lockdown-1");
    expect(events.map((e) => e.id)).toContain("brexit-transition-end");
    expect(events.map((e) => e.id)).not.toContain("general-election-2024");
  });

  it("returns nothing when the range excludes every known event", () => {
    const events = visibleChartEvents(Date.UTC(1990, 0, 1), Date.UTC(1995, 0, 1));
    expect(events).toEqual([]);
  });

  it("returns nothing for an invalid or inverted range rather than throwing", () => {
    expect(visibleChartEvents(Number.NaN, Date.UTC(2020, 0, 1))).toEqual([]);
    expect(visibleChartEvents(Date.UTC(2020, 0, 1), Date.UTC(2019, 0, 1))).toEqual([]);
  });
});
