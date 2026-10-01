import { describe, expect, it } from "vitest";
import {
  fieldworkMidpointMs,
  marginOfErrorFromSampleSize,
} from "@/app/lib/pollingUncertainty";

describe("marginOfErrorFromSampleSize", () => {
  it("computes the standard 95% CI margin of error for n=1000 at the worst-case p=0.5", () => {
    // z * sqrt(0.5*0.5/1000) * 100 = 1.96 * 0.015811... * 100 ~= 3.0996 -> rounds to 3.1
    const result = marginOfErrorFromSampleSize(1000);
    expect(result.marginOfErrorPoints).toBeCloseTo(3.1, 1);
    expect(result.source).toBe("estimated-from-sample-size");
    expect(result.confidenceLevel).toBe(0.95);
  });

  it("computes a known value for n=2285 (actual YouGov sample size in the fixture data)", () => {
    // 1.96 * sqrt(0.25/2285) * 100 ~= 2.0514 -> rounds to 2.1
    const result = marginOfErrorFromSampleSize(2285);
    expect(result.marginOfErrorPoints).toBeCloseTo(2.1, 1);
  });

  it("produces a smaller margin of error for a larger sample size", () => {
    const small = marginOfErrorFromSampleSize(500);
    const large = marginOfErrorFromSampleSize(5000);
    expect(large.marginOfErrorPoints).toBeLessThan(small.marginOfErrorPoints);
  });

  it("matches the textbook value for n=100 (MoE ~= 9.8pp)", () => {
    const result = marginOfErrorFromSampleSize(100);
    expect(result.marginOfErrorPoints).toBeCloseTo(9.8, 1);
  });

  it("throws rather than inventing a value for a non-positive sample size", () => {
    expect(() => marginOfErrorFromSampleSize(0)).toThrow();
    expect(() => marginOfErrorFromSampleSize(-10)).toThrow();
    expect(() => marginOfErrorFromSampleSize(Number.NaN)).toThrow();
  });
});

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
