import { describe, expect, it } from "vitest";

describe("chart date axes", () => {
  it("pads a collapsed time domain without adding observations", async () => {
    const chartModel = await import("@/app/lib/chartModel") as Record<string, unknown>;
    const timeAxisDomain = chartModel.timeAxisDomain as ((values: number[]) => [number, number]) | undefined;

    expect(timeAxisDomain).toBeTypeOf("function");
    expect(timeAxisDomain?.([Date.UTC(2026, 8, 27)])).toEqual([
      Date.UTC(2026, 7, 27),
      Date.UTC(2026, 9, 28),
    ]);
    expect(timeAxisDomain?.([Date.UTC(2026, 8, 27), Date.UTC(2026, 9, 27)])).toEqual([
      Date.UTC(2026, 8, 27),
      Date.UTC(2026, 9, 27),
    ]);
    expect(timeAxisDomain?.([])).toEqual([0, 1]);
  });

  it("uses explicit edge ticks on a single-date domain", async () => {
    const chartModel = await import("@/app/lib/chartModel") as Record<string, unknown>;
    const timeAxisTicks = chartModel.timeAxisTicks as ((values: number[]) => number[] | undefined) | undefined;
    const point = Date.UTC(2026, 8, 27);

    expect(timeAxisTicks).toBeTypeOf("function");
    expect(timeAxisTicks?.([point])).toEqual([Date.UTC(2026, 7, 27), Date.UTC(2026, 9, 28)]);
    expect(timeAxisTicks?.([point, point + 86_400_000])).toBeUndefined();
  });
});
